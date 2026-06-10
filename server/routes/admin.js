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
    img: r.img_url, imgBack: r.img_back_url, swatch: r.swatch, tag: r.tag,
    bestSeller: r.best_seller, blurb: r.blurb, specs: r.specs || [],
  };
}

// Accetta data URL di immagini (foto caricata dall'admin) oppure un URL http.
const isValidImage = (s) =>
  typeof s === "string" && /^(data:image\/|https?:\/\/)/.test(s.trim());

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
    const { rows } = await query(
      `select o.id, o.status, o.total, o.created_at, o.shipping,
              o.customer_email, u.username as customer_username,
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
        order by o.created_at desc`
    );
    return res.json({
      orders: rows.map((o) => ({ ...o, total: Number(o.total) })),
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
    const price = Number(req.body?.price);
    const blurb = String(req.body?.blurb || "").trim();
    const tag = String(req.body?.tag || "").trim();
    const img = String(req.body?.img || "").trim();
    const imgBack = String(req.body?.imgBack || "").trim();
    const stockRaw = req.body?.stock;
    const stock = stockRaw === undefined || stockRaw === "" ? 0 : Number(stockRaw);

    if (!name) return res.status(400).json({ error: "Il nome è obbligatorio." });
    if (!Number.isFinite(price) || price <= 0)
      return res.status(400).json({ error: "Il prezzo deve essere un numero maggiore di 0." });
    if (!isValidImage(img))
      return res.status(400).json({ error: "Serve una foto del prodotto." });
    if (imgBack && !isValidImage(imgBack))
      return res.status(400).json({ error: "La seconda foto non è valida." });
    if (!Number.isInteger(stock) || stock < 0)
      return res.status(400).json({ error: "La giacenza deve essere un numero intero ≥ 0." });

    // Genera un code unico; in caso (rarissimo) di collisione, riprova.
    let row = null;
    for (let attempt = 0; attempt < 5 && !row; attempt++) {
      const code = "KR-" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
      try {
        const { rows } = await query(
          `insert into products
             (code, name, brand, model, color, price, stock, img_url, img_back_url, tag, best_seller, blurb, specs)
           values ($1,$2,'KROMA','','',$3,$4,$5,$6,$7,false,$8,'[]'::jsonb)
           returning *`,
          [code, name, price, stock, img, imgBack || null, tag || null, blurb || null]
        );
        row = rows[0];
      } catch (e) {
        if (e.code === "23505") continue; // code duplicato: nuovo tentativo
        throw e;
      }
    }
    if (!row) return res.status(500).json({ error: "Impossibile generare il prodotto. Riprova." });
    return res.status(201).json({ product: toProduct(row) });
  } catch (err) {
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
// Aggiorna la giacenza disponibile di un casco.
router.patch("/admin/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const stock = Number(req.body?.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({ error: "La giacenza deve essere un numero intero ≥ 0." });
    }

    const { rows } = await query(
      `update products set stock = $1 where id = $2 returning id, code, name, stock`,
      [stock, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Prodotto non trovato." });
    return res.json({ product: rows[0] });
  } catch (err) {
    console.error("admin stock error:", err);
    return res.status(500).json({ error: "Errore nell'aggiornamento della giacenza." });
  }
});

export default router;
