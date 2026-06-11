// Rotte ADMIN (richiedono login + ruolo amministratore):
//   GET    /admin/orders          -> tutti gli ordini, di tutti i clienti
//   POST   /admin/products        -> crea un nuovo prodotto (nome, prezzo, foto…)
//   PATCH  /admin/products/:id     -> aggiorna la giacenza (stock) di un casco
//   DELETE /admin/products/:id     -> elimina un prodotto
import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth, requireAdmin } from "../lib/auth.js";

// Forma "pulita" del prodotto per il frontend (uguale a routes/products.js).
function toProduct(r) {
  return {
    id: r.id, code: r.code, name: r.name, brand: r.brand, model: r.model,
    color: r.color, price: Number(r.price), stock: r.stock ?? 0,
    img: r.img_url, imgBack: r.img_back_url, gallery: r.gallery || [],
    swatch: r.swatch, tag: r.tag,
    bestSeller: r.best_seller, blurb: r.blurb, specs: r.specs || [],
  };
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
    const { rows } = await query(`delete from products where id = $1 returning id`, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Prodotto non trovato." });
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
    // Galleria completa (più foto). Aggiunta PER ULTIMA così, se la colonna
    // gallery non è ancora migrata, basta togliere l'ultimo set e riprovare.
    let galleryAdded = false;
    if ("images" in b) {
      const images = normalizeImages(b);
      add("img_url", images[0]);
      add("img_back_url", images[1] || null);
      add("gallery", JSON.stringify(images));
      galleryAdded = true;
    }

    if (!sets.length) return res.status(400).json({ error: "Niente da aggiornare." });

    const exec = async () => {
      const params = [...vals, id];
      return query(
        `update products set ${sets.join(", ")} where id = $${params.length} returning *`,
        params
      );
    };
    let result;
    try {
      result = await exec();
    } catch (e) {
      if (e.code === "42703" && galleryAdded) {
        sets.pop(); // rimuove "gallery = $n"
        vals.pop();
        galleryAdded = false;
        result = await exec();
      } else {
        throw e;
      }
    }
    const { rows } = result;
    if (!rows[0]) return res.status(404).json({ error: "Prodotto non trovato." });
    return res.json({ product: toProduct(rows[0]) });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("admin update product error:", err);
    return res.status(500).json({ error: "Errore nell'aggiornamento del prodotto." });
  }
});

export default router;
