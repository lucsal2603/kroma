// Rotte ADMIN (richiedono login + ruolo amministratore):
//   GET    /admin/orders          -> tutti gli ordini, di tutti i clienti
//   POST   /admin/products        -> crea un nuovo prodotto (nome, prezzo, foto…)
//   PATCH  /admin/products/:id     -> aggiorna la giacenza (stock) di un casco
//   DELETE /admin/products/:id     -> elimina un prodotto
import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth, requireAdmin, requireOwner, isOwner } from "../lib/auth.js";
import { logActivity, getActivity } from "../lib/activity.js";

// Forma "pulita" del prodotto per il frontend (uguale a routes/products.js).
function toProduct(r) {
  return {
    id: r.id, code: r.code, name: r.name, brand: r.brand, model: r.model,
    color: r.color, price: Number(r.price),
    salePrice: r.sale_price == null ? null : Number(r.sale_price),
    stock: r.stock ?? 0,
    img: r.img_url, imgBack: r.img_back_url, gallery: r.gallery || [],
    swatch: r.swatch, tag: r.tag,
    bestSeller: r.best_seller, blurb: r.blurb, specs: r.specs || [],
  };
}

// Maschera l'email per privacy: tiene poche lettere e nasconde il resto.
// Es. "lucasalvemini03@gmail.com" -> "lu***@gm***.com"
function maskEmail(email) {
  const s = String(email || "");
  const at = s.indexOf("@");
  if (at < 1) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const shownLocal = local.length <= 2 ? local[0] + "*" : local.slice(0, 2) + "***";
  const dot = domain.lastIndexOf(".");
  let shownDomain = domain;
  if (dot > 1) {
    const namePart = domain.slice(0, dot);
    const ext = domain.slice(dot); // include il punto, es. ".com"
    const shownName = namePart.length <= 2 ? namePart[0] + "*" : namePart.slice(0, 2) + "***";
    shownDomain = shownName + ext;
  }
  return `${shownLocal}@${shownDomain}`;
}

// Accetta data URL di immagini (foto caricata dall'admin) oppure un URL http.
const isValidImage = (s) =>
  typeof s === "string" && /^(data:image\/|https?:\/\/)/.test(s.trim());

// Normalizza la lista di foto: accetta `images` (array) oppure i vecchi
// `img`/`imgBack`. Restituisce un array di stringhe valide (la prima è la
// copertina). Lancia un errore con statusCode 400 se non è valida.
function normalizeImages(b) {
  let images = Array.isArray(b.images)
    ? b.images.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  if (!images.length) {
    images = [String(b.img || "").trim(), String(b.imgBack || "").trim()].filter(Boolean);
  }
  if (!images.length) {
    const e = new Error("Serve almeno una foto del prodotto.");
    e.statusCode = 400;
    throw e;
  }
  if (!images.every(isValidImage)) {
    const e = new Error("Una delle foto non è valida.");
    e.statusCode = 400;
    throw e;
  }
  return images;
}

const router = Router();

// Tutte le rotte /admin passano prima da requireAuth e poi requireAdmin.
// IMPORTANT: il path "/admin" è obbligatorio. Senza di esso il middleware
// verrebbe applicato a OGNI richiesta che arriva fin qui (questo router è
// montato su "/"), bloccando con 401 anche rotte pubbliche come /paypal/config.
router.use("/admin", requireAuth, requireAdmin);

// --- GET /admin/orders ----------------------------------------------
// Tutti gli ordini con cliente, indirizzo e righe d'ordine.
router.get("/admin/orders", async (_req, res) => {
  try {
    // `discountCol` viene tolto se la colonna discount_percent non è migrata.
    const buildSql = (discountCol) =>
      `select o.id, o.status, o.total, o.created_at, o.shipping,
              o.customer_email, ${discountCol}u.username as customer_username,
              coalesce(json_agg(
                json_build_object(
                  'name', p.name, 'color', p.color, 'size', oi.size,
                  'quantity', oi.quantity, 'unitPrice', oi.unit_price
                ) order by oi.created_at
              ) filter (where oi.id is not null), '[]') as items
         from orders o
         join users u on u.id = o.user_id
         left join order_items oi on oi.order_id = o.id
         left join products p     on p.id = oi.product_id
        group by o.id, u.username
        order by o.created_at desc`;
    let rows;
    try {
      ({ rows } = await query(buildSql("o.discount_percent, ")));
    } catch (e) {
      if (e.code !== "42703") throw e;
      ({ rows } = await query(buildSql("")));
    }
    return res.json({
      orders: rows.map((o) => ({
        ...o,
        total: Number(o.total),
        discount_percent: Number(o.discount_percent || 0),
      })),
    });
  } catch (err) {
    console.error("admin orders error:", err);
    return res.status(500).json({ error: "Errore nel recupero degli ordini." });
  }
});

// --- POST /admin/products -------------------------------------------
// Crea un nuovo prodotto. Campi minimi: name, price, img (foto fronte).
// Il "code" è generato in automatico ed è unico. brand="KROMA", model/color
// restano vuoti (prodotto generico, niente varianti colore come i caschi).
router.post("/admin/products", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const brand = String(req.body?.brand || "").trim() || "KROMA";
    const price = Number(req.body?.price);
    const blurb = String(req.body?.blurb || "").trim();
    const tag = String(req.body?.tag || "").trim();
    const stockRaw = req.body?.stock;
    const stock = stockRaw === undefined || stockRaw === "" ? 0 : Number(stockRaw);

    if (!name) return res.status(400).json({ error: "Il nome è obbligatorio." });
    if (!Number.isFinite(price) || price <= 0)
      return res.status(400).json({ error: "Il prezzo deve essere un numero maggiore di 0." });
    if (!Number.isInteger(stock) || stock < 0)
      return res.status(400).json({ error: "La giacenza deve essere un numero intero ≥ 0." });

    const images = normalizeImages(req.body || {}); // copertina = images[0]
    const img = images[0];
    const imgBack = images[1] || null;

    // Genera un code unico; in caso (rarissimo) di collisione, riprova.
    // useGallery=false ripiega se la colonna gallery non è ancora migrata.
    let row = null;
    let useGallery = true;
    for (let attempt = 0; attempt < 8 && !row; attempt++) {
      const code = "KR-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
      const cols = "code, name, brand, model, color, price, stock, img_url, img_back_url, tag, best_seller, blurb, specs"
        + (useGallery ? ", gallery" : "");
      const vals = [code, name, brand, price, stock, img, imgBack, tag || null, blurb || null];
      const placeholders = "$1,$2,$3,'','',$4,$5,$6,$7,$8,false,$9,'[]'::jsonb"
        + (useGallery ? `,$${vals.length + 1}` : "");
      if (useGallery) vals.push(JSON.stringify(images));
      try {
        const { rows } = await query(
          `insert into products (${cols}) values (${placeholders}) returning *`,
          vals
        );
        row = rows[0];
      } catch (e) {
        if (e.code === "23505") continue;       // code duplicato: riprova
        if (e.code === "42703") { useGallery = false; continue; } // colonna gallery assente
        throw e;
      }
    }
    if (!row) return res.status(500).json({ error: "Impossibile generare il prodotto. Riprova." });
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: "product.create",
      detail: row.name,
    });
    return res.status(201).json({ product: toProduct(row) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("admin create product error:", err);
    return res.status(500).json({ error: "Errore nella creazione del prodotto." });
  }
});

// --- DELETE /admin/products/:id -------------------------------------
router.delete("/admin/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`delete from products where id = $1 returning id, name`, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Prodotto non trovato." });
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: "product.delete",
      detail: rows[0].name,
    });
    return res.json({ deleted: rows[0].id });
  } catch (err) {
    // 23503 = foreign key: il prodotto è già presente in qualche ordine.
    if (err.code === "23503") {
      return res.status(409).json({
        error: "Non puoi eliminare un prodotto che è già stato ordinato. Metti la giacenza a 0 per nasconderlo.",
      });
    }
    console.error("admin delete product error:", err);
    return res.status(500).json({ error: "Errore nell'eliminazione del prodotto." });
  }
});

// --- PATCH /admin/products/:id --------------------------------------
// Aggiorna i campi passati (anche solo la giacenza). Aggiorna SOLO i campi
// presenti nel body, così resta compatibile con il salvataggio rapido stock.
router.patch("/admin/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const sets = [];
    const vals = [];
    const add = (col, val) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    };

    if ("name" in b) {
      const name = String(b.name || "").trim();
      if (!name) return res.status(400).json({ error: "Il nome non può essere vuoto." });
      add("name", name);
    }
    if ("brand" in b) add("brand", String(b.brand || "").trim() || "KROMA");
    if ("price" in b) {
      const price = Number(b.price);
      if (!Number.isFinite(price) || price <= 0)
        return res.status(400).json({ error: "Il prezzo deve essere un numero maggiore di 0." });
      add("price", price);
    }
    if ("stock" in b) {
      const stock = Number(b.stock);
      if (!Number.isInteger(stock) || stock < 0)
        return res.status(400).json({ error: "La giacenza deve essere un numero intero ≥ 0." });
      add("stock", stock);
    }
    if ("tag" in b) add("tag", String(b.tag || "").trim() || null);
    if ("blurb" in b) add("blurb", String(b.blurb || "").trim() || null);
    if ("img" in b) {
      const img = String(b.img || "").trim();
      if (!isValidImage(img)) return res.status(400).json({ error: "Foto principale non valida." });
      add("img_url", img);
    }
    if ("imgBack" in b) {
      const imgBack = String(b.imgBack || "").trim();
      if (imgBack && !isValidImage(imgBack)) return res.status(400).json({ error: "La seconda foto non è valida." });
      add("img_back_url", imgBack || null);
    }
    // Galleria completa (più foto). Aggiunta in coda così, se la colonna
    // gallery non è ancora migrata, basta togliere l'ultimo set e riprovare.
    if ("images" in b) {
      const images = normalizeImages(b);
      add("img_url", images[0]);
      add("img_back_url", images[1] || null);
      add("gallery", JSON.stringify(images));
    }

    // Sconto sul prodotto (prezzo scontato). Aggiunto PER ULTIMO: se la colonna
    // sale_price non è ancora migrata, il retry qui sotto lo toglie e riprova.
    if ("salePrice" in b) {
      const raw = b.salePrice;
      if (raw === null || raw === "" || raw === undefined) {
        add("sale_price", null); // togli lo sconto (torna al prezzo pieno)
      } else {
        const sp = Number(raw);
        if (!Number.isFinite(sp) || sp <= 0)
          return res.status(400).json({ error: "Il prezzo scontato deve essere un numero maggiore di 0." });
        if ("price" in b) {
          const full = Number(b.price);
          if (Number.isFinite(full) && sp >= full)
            return res.status(400).json({ error: "Il prezzo scontato deve essere minore del prezzo pieno." });
        }
        add("sale_price", sp);
      }
    }

    if (!sets.length) return res.status(400).json({ error: "Niente da aggiornare." });

    const exec = async () => {
      const params = [...vals, id];
      return query(
        `update products set ${sets.join(", ")} where id = $${params.length} returning *`,
        params
      );
    };
    // Colonne "in coda" che potrebbero non essere ancora migrate: se l'UPDATE
    // fallisce con 42703 (colonna assente) le togliamo dalla fine e riproviamo.
    const OPTIONAL_TAIL = new Set(["gallery", "sale_price"]);
    let result;
    while (true) {
      try {
        result = await exec();
        break;
      } catch (e) {
        const lastCol = sets[sets.length - 1]?.split(" = ")[0];
        if (e.code !== "42703" || !lastCol || !OPTIONAL_TAIL.has(lastCol)) throw e;
        sets.pop();
        vals.pop();
        if (!sets.length) throw e;
      }
    }
    const { rows } = result;
    if (!rows[0]) return res.status(404).json({ error: "Prodotto non trovato." });

    // Registro attività: capiamo dal body che tipo di modifica è stata fatta.
    const name = rows[0].name;
    let action = "product.update";
    let detail = name;
    if ("salePrice" in b) {
      const cleared = b.salePrice === null || b.salePrice === "" || b.salePrice === undefined;
      action = cleared ? "discount.remove" : "discount.set";
      detail = cleared ? name : `${name} → € ${Number(b.salePrice).toFixed(2)}`;
    } else if ("stock" in b && Object.keys(b).length === 1) {
      action = "stock.update";
      detail = `${name} (giacenza: ${Number(b.stock)})`;
    }
    await logActivity({ userId: req.user.id, username: req.user.username, action, detail });

    return res.json({ product: toProduct(rows[0]) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("admin update product error:", err);
    return res.status(500).json({ error: "Errore nell'aggiornamento del prodotto." });
  }
});

// --- GET /admin/users -----------------------------------------------
// Elenco degli iscritti: solo nome ed email MASCHERATA (privacy).
router.get("/admin/users", async (req, res) => {
  try {
    // Ricerca opzionale per nome o email (il match sull'email avviene qui sul
    // server, così possiamo confrontare l'email VERA senza mai inviarla in chiaro).
    const q = String(req.query.q || "").trim();
    const params = [];
    let where = "";
    if (q) {
      params.push(`%${q}%`);
      where = ` where username ilike $1 or email ilike $1`;
    }
    // marketing_consent può non essere migrato: ripiego senza quella colonna.
    const build = (consentCol) =>
      `select id, username, email, is_admin, created_at${consentCol}
         from users${where} order by created_at desc`;
    let rows;
    try {
      ({ rows } = await query(build(", marketing_consent"), params));
    } catch (e) {
      if (e.code !== "42703") throw e;
      ({ rows } = await query(build(""), params));
    }
    return res.json({
      users: rows.map((u) => ({
        id: u.id,
        username: u.username,
        email: maskEmail(u.email),
        isAdmin: Boolean(u.is_admin),
        subscribed: u.marketing_consent === undefined ? null : Boolean(u.marketing_consent),
        createdAt: u.created_at,
      })),
    });
  } catch (err) {
    console.error("admin users error:", err);
    return res.status(500).json({ error: "Errore nel recupero degli iscritti." });
  }
});

// --- GET /admin/users/:id -------------------------------------------
// Scheda del singolo iscritto: dati base, da quanto è registrato, i suoi
// acquisti, e se chi guarda è il proprietario (per mostrare i tasti speciali).
router.get("/admin/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `select id, username, email, is_admin, created_at from users where id = $1`,
      [id]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ error: "Iscritto non trovato." });

    // Colonne opzionali: potrebbero non essere ancora migrate.
    let disabled = false;
    try {
      const { rows: d } = await query(`select disabled from users where id = $1`, [id]);
      disabled = Boolean(d[0]?.disabled);
    } catch (e) {
      if (e.code !== "42703") throw e;
    }
    let subscribed = null;
    try {
      const { rows: m } = await query(`select marketing_consent from users where id = $1`, [id]);
      subscribed = Boolean(m[0]?.marketing_consent);
    } catch (e) {
      if (e.code !== "42703") throw e;
    }

    // Acquisti dell'utente (più recenti prima).
    const { rows: orders } = await query(
      `select o.id, o.status, o.total, o.created_at,
              coalesce(json_agg(
                json_build_object('name', p.name, 'color', p.color, 'size', oi.size,
                                  'quantity', oi.quantity, 'unitPrice', oi.unit_price)
                order by oi.created_at
              ) filter (where oi.id is not null), '[]') as items
         from orders o
         left join order_items oi on oi.order_id = o.id
         left join products p     on p.id = oi.product_id
        where o.user_id = $1
        group by o.id
        order by o.created_at desc`,
      [id]
    );

    return res.json({
      user: {
        id: u.id,
        username: u.username,
        email: maskEmail(u.email),
        isAdmin: Boolean(u.is_admin),
        disabled,
        subscribed,
        createdAt: u.created_at,
      },
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        total: Number(o.total),
        createdAt: o.created_at,
        items: o.items,
      })),
      viewerIsOwner: await isOwner(req.user.id),
    });
  } catch (err) {
    console.error("admin user detail error:", err);
    return res.status(500).json({ error: "Errore nel recupero dei dati dell'iscritto." });
  }
});

// --- PATCH /admin/users/:id/disabled (SOLO proprietario) ------------
router.patch("/admin/users/:id/disabled", requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const disabled = Boolean(req.body?.disabled);
    if (id === req.user.id && disabled) {
      return res.status(400).json({ error: "Non puoi disabilitare il tuo stesso account." });
    }
    const { rows } = await query(
      `update users set disabled = $1 where id = $2 returning username`,
      [disabled, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Iscritto non trovato." });
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: disabled ? "user.disable" : "user.enable",
      detail: rows[0].username,
    });
    return res.json({ disabled });
  } catch (err) {
    if (err.code === "42703") {
      return res.status(409).json({
        error: "Funzione non ancora disponibile: esegui la migrazione (add-user-disabled.sql) su Supabase.",
      });
    }
    console.error("admin disable user error:", err);
    return res.status(500).json({ error: "Errore nel cambio stato dell'account." });
  }
});

// --- PATCH /admin/users/:id/admin (SOLO proprietario) ---------------
router.patch("/admin/users/:id/admin", requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = Boolean(req.body?.isAdmin);
    if (id === req.user.id && !isAdmin) {
      return res.status(400).json({ error: "Non puoi togliere l'admin a te stesso." });
    }
    const { rows } = await query(
      `update users set is_admin = $1 where id = $2 returning username`,
      [isAdmin, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Iscritto non trovato." });
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: isAdmin ? "user.admin.grant" : "user.admin.revoke",
      detail: rows[0].username,
    });
    return res.json({ isAdmin });
  } catch (err) {
    console.error("admin set-admin error:", err);
    return res.status(500).json({ error: "Errore nel cambio dei permessi." });
  }
});

// --- GET /admin/users/:id/email -------------------------------------
// Rivela l'email in chiaro di un singolo iscritto (su richiesta dell'admin).
// L'azione viene registrata nel registro attività per trasparenza.
router.get("/admin/users/:id/email", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`select username, email from users where id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Iscritto non trovato." });
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: "user.reveal",
      detail: rows[0].username,
    });
    return res.json({ email: rows[0].email });
  } catch (err) {
    console.error("admin reveal email error:", err);
    return res.status(500).json({ error: "Errore nel recupero dell'email." });
  }
});

// --- GET /admin/activity --------------------------------------------
// Registro attività admin: chi ha fatto cosa e quando.
router.get("/admin/activity", async (_req, res) => {
  try {
    const logs = await getActivity(100);
    return res.json({ logs });
  } catch (err) {
    console.error("admin activity error:", err);
    return res.status(500).json({ error: "Errore nel recupero del registro attività." });
  }
});

export default router;
