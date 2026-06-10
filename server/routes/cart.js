// Rotte carrello (richiedono login):
//   POST   /cart           -> aggiunge un casco al carrello { productId, size, quantity? }
//   GET    /cart           -> elenco articoli + totale
//   DELETE /cart/:itemId   -> rimuove una riga
//   DELETE /cart           -> svuota il carrello
import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();

const SIZES = ["XS", "S", "M", "L", "XL"];

// Carica il carrello dell'utente con i dati del prodotto + totale.
async function loadCart(userId) {
  const { rows } = await query(
    `select ci.id, ci.size, ci.quantity,
            p.id   as product_id, p.code, p.name, p.color,
            p.price, p.img_url
       from cart_items ci
       join products p on p.id = ci.product_id
      where ci.user_id = $1
      order by ci.created_at`,
    [userId]
  );

  const items = rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    code: r.code,
    name: r.name,
    color: r.color,
    size: r.size,
    quantity: r.quantity,
    price: Number(r.price),
    img: r.img_url,
    subtotal: Number(r.price) * r.quantity,
  }));

  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return { items, total, count };
}

// --- POST /cart -----------------------------------------------------
router.post("/cart", requireAuth, async (req, res) => {
  try {
    const { productId, size } = req.body || {};
    let quantity = Number(req.body?.quantity ?? 1);

    if (!productId || !size) {
      return res.status(400).json({ error: "productId e size sono obbligatori." });
    }
    if (!SIZES.includes(String(size).toUpperCase())) {
      return res.status(400).json({ error: `Taglia non valida. Ammesse: ${SIZES.join(", ")}.` });
    }
    if (!Number.isInteger(quantity) || quantity < 1) quantity = 1;

    // Verifica che il prodotto esista.
    const prod = await query(`select id from products where id = $1 limit 1`, [productId]);
    if (!prod.rows[0]) return res.status(404).json({ error: "Prodotto inesistente." });

    // Stesso prodotto+taglia: somma la quantità (vincolo unique gestisce il merge).
    await query(
      `insert into cart_items (user_id, product_id, size, quantity)
       values ($1, $2, $3, $4)
       on conflict (user_id, product_id, size)
       do update set quantity = cart_items.quantity + excluded.quantity`,
      [req.user.id, productId, String(size).toUpperCase(), quantity]
    );

    const cart = await loadCart(req.user.id);
    return res.status(201).json(cart);
  } catch (err) {
    console.error("cart add error:", err);
    return res.status(500).json({ error: "Errore nell'aggiunta al carrello." });
  }
});

// --- GET /cart ------------------------------------------------------
router.get("/cart", requireAuth, async (req, res) => {
  try {
    const cart = await loadCart(req.user.id);
    return res.json(cart);
  } catch (err) {
    console.error("cart get error:", err);
    return res.status(500).json({ error: "Errore nel recupero del carrello." });
  }
});

// --- DELETE /cart/:itemId -------------------------------------------
router.delete("/cart/:itemId", requireAuth, async (req, res) => {
  try {
    await query(`delete from cart_items where id = $1 and user_id = $2`, [
      req.params.itemId,
      req.user.id,
    ]);
    const cart = await loadCart(req.user.id);
    return res.json(cart);
  } catch (err) {
    console.error("cart delete error:", err);
    return res.status(500).json({ error: "Errore nella rimozione dal carrello." });
  }
});

// --- DELETE /cart ---------------------------------------------------
router.delete("/cart", requireAuth, async (req, res) => {
  try {
    await query(`delete from cart_items where user_id = $1`, [req.user.id]);
    return res.json({ items: [], total: 0, count: 0 });
  } catch (err) {
    console.error("cart clear error:", err);
    return res.status(500).json({ error: "Errore nello svuotamento del carrello." });
  }
});

export default router;
