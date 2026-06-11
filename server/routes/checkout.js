// POST /checkout (richiede login):
//   crea l'ordine dal carrello con pagamento SIMULATO.
//   Usato come ripiego quando PayPal non è ancora configurato: così il sito
//   resta provabile end-to-end anche senza pagamento reale.
// GET /orders (richiede login): storico ordini dell'utente.
import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../lib/auth.js";
import { createOrderFromCart, normalizeShipping } from "../lib/orders.js";
import { WELCOME_PERCENT, WELCOME_HOURS } from "../lib/discount.js";

const router = Router();

// --- GET /welcome-config (pubblica) ---------------------------------
// Dati dello sconto di benvenuto per il frontend (percentuale + durata).
// L'idoneità del singolo utente è comunque ricalcolata e forzata lato server.
router.get("/welcome-config", (_req, res) => {
  res.json({ percent: WELCOME_PERCENT, hours: WELCOME_HOURS });
});

router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const shipping = normalizeShipping(req.body?.shipping);
    const result = await createOrderFromCart({
      userId: req.user.id,
      shipping,
      status: "paid", // pagamento simulato: ordine subito "pagato"
      customerEmail: req.body?.email || null,
      enforceStock: true,
    });
    return res.status(201).json({
      order: {
        id: result.orderId,
        status: result.status,
        total: result.total,
        subtotal: result.subtotal,
        discount: result.discount,
        discountPercent: result.discountPercent,
        items: result.items,
        customerEmail: result.customerEmail,
      },
      paid: result.status === "paid",
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("checkout error:", err);
    return res.status(500).json({ error: "Errore durante il checkout." });
  }
});

// GET /orders -> storico ordini dell'utente
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `select o.id, o.status, o.total, o.created_at, o.shipping,
              coalesce(json_agg(
                json_build_object(
                  'name', p.name, 'color', p.color, 'size', oi.size,
                  'quantity', oi.quantity, 'unitPrice', oi.unit_price
                ) order by oi.created_at
              ) filter (where oi.id is not null), '[]') as items
         from orders o
         left join order_items oi on oi.order_id = o.id
         left join products p     on p.id = oi.product_id
        where o.user_id = $1
        group by o.id
        order by o.created_at desc`,
      [req.user.id]
    );
    return res.json({
      orders: rows.map((o) => ({ ...o, total: Number(o.total) })),
    });
  } catch (err) {
    console.error("orders list error:", err);
    return res.status(500).json({ error: "Errore nel recupero degli ordini." });
  }
});

export default router;
