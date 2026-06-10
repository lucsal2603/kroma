// POST /checkout (richiede login):
//   1. legge il carrello dell'utente
//   2. crea l'ordine + righe d'ordine (in transazione)
//   3. effettua il pagamento con Stripe (o lo simula in dev)
//   4. invia email di conferma al cliente + notifica Telegram al titolare
import { Router } from "express";
import { pool, query } from "../db/index.js";
import { requireAuth } from "../lib/auth.js";
import { stripe, stripeConfigured } from "../lib/stripe.js";
import { sendOrderConfirmation } from "../lib/orderEmail.js";
import { sendTelegram } from "../lib/telegram.js";

const router = Router();
const euro = (n) => "€ " + Number(n).toFixed(2).replace(".", ",");

router.post("/checkout", requireAuth, async (req, res) => {
  const client = await pool.connect();
  let committed = false;
  try {
    // Utente (email/username) per la conferma
    const userRes = await client.query(
      `select email, username from users where id = $1`,
      [req.user.id]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: "Utente non trovato." });

    const customerEmail = (req.body?.email || user.email).trim().toLowerCase();

    // Carrello con dati prodotto
    const cartRes = await client.query(
      `select ci.product_id, ci.size, ci.quantity,
              p.name, p.color, p.price
         from cart_items ci
         join products p on p.id = ci.product_id
        where ci.user_id = $1
        order by ci.created_at`,
      [req.user.id]
    );
    const cart = cartRes.rows;
    if (cart.length === 0) {
      return res.status(400).json({ error: "Il carrello è vuoto." });
    }

    const items = cart.map((r) => ({
      productId: r.product_id,
      name: r.name,
      color: r.color,
      size: r.size,
      quantity: r.quantity,
      price: Number(r.price),
      subtotal: Number(r.price) * r.quantity,
    }));
    const total = items.reduce((s, i) => s + i.subtotal, 0);

    // --- Transazione: crea ordine + righe -----------------------------
    await client.query("begin");

    const orderRes = await client.query(
      `insert into orders (user_id, status, total, customer_email)
       values ($1, 'pending', $2, $3)
       returning id, created_at`,
      [req.user.id, total, customerEmail]
    );
    const orderId = orderRes.rows[0].id;

    for (const i of items) {
      await client.query(
        `insert into order_items (order_id, product_id, size, quantity, unit_price)
         values ($1, $2, $3, $4, $5)`,
        [orderId, i.productId, i.size, i.quantity, i.price]
      );
    }

    // --- Pagamento ----------------------------------------------------
    let status = "paid";
    let paymentIntentId = null;
    let clientSecret = null;

    if (stripeConfigured) {
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(total * 100), // centesimi
        currency: "eur",
        metadata: { orderId, userId: req.user.id },
        ...(req.body?.paymentMethodId
          ? { payment_method: req.body.paymentMethodId, confirm: true }
          : { automatic_payment_methods: { enabled: true } }),
      });
      paymentIntentId = pi.id;
      clientSecret = pi.client_secret;
      // Pagato solo se Stripe conferma subito; altrimenti resta pending
      status = pi.status === "succeeded" ? "paid" : "pending";
    }
    // Se Stripe non è configurato: dev mode -> pagamento simulato (status 'paid')

    await client.query(
      `update orders set status = $1, stripe_payment_intent_id = $2 where id = $3`,
      [status, paymentIntentId, orderId]
    );

    // Se pagato, svuota il carrello nella stessa transazione
    if (status === "paid") {
      await client.query(`delete from cart_items where user_id = $1`, [req.user.id]);
    }

    await client.query("commit");
    committed = true;

    // --- Post-pagamento: email + Telegram (fuori transazione) ---------
    if (status === "paid") {
      // Email di conferma al cliente
      sendOrderConfirmation(customerEmail, {
        id: orderId,
        total,
        items,
        customerName: user.username,
      }).catch((e) => console.error("order email error:", e.message));

      // Notifica al titolare
      const tg =
        `🦈 <b>Nuovo ordine KROMA</b>\n` +
        `#${String(orderId).slice(0, 8).toUpperCase()} · ${euro(total)}\n` +
        `Cliente: ${user.username} (${customerEmail})\n\n` +
        items.map((i) => `• ${i.name} ${i.color} · ${i.size} ×${i.quantity}`).join("\n");
      sendTelegram(tg).catch((e) => console.error("telegram error:", e.message));
    }

    return res.status(201).json({
      order: { id: orderId, status, total, items, customerEmail },
      ...(clientSecret ? { clientSecret } : {}),
      paid: status === "paid",
    });
  } catch (err) {
    if (!committed) {
      try { await client.query("rollback"); } catch {}
    }
    console.error("checkout error:", err);
    return res.status(500).json({ error: "Errore durante il checkout." });
  } finally {
    client.release();
  }
});

// GET /orders -> storico ordini dell'utente
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `select o.id, o.status, o.total, o.created_at,
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
