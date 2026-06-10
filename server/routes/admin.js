// Rotte ADMIN (richiedono login + ruolo amministratore):
//   GET   /admin/orders          -> tutti gli ordini, di tutti i clienti
//   PATCH /admin/products/:id     -> aggiorna la giacenza (stock) di un casco
import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth, requireAdmin } from "../lib/auth.js";

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
