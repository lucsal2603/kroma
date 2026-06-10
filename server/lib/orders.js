// Logica condivisa per trasformare il carrello di un utente in un ordine.
// Usata sia dal checkout "classico" (POST /checkout) sia dalla cattura
// del pagamento PayPal (POST /paypal/capture-order).
import { pool } from "../db/index.js";
import { sendOrderConfirmation } from "./orderEmail.js";
import { sendTelegram } from "./telegram.js";

const euro = (n) => "€ " + Number(n).toFixed(2).replace(".", ",");

// Normalizza e valida i dati di spedizione. Lancia un errore "previsto"
// (statusCode 400) se mancano i campi obbligatori.
export function normalizeShipping(raw = {}) {
  const shipping = {
    name: String(raw.name || "").trim(),
    address: String(raw.address || "").trim(),
    zip: String(raw.zip || "").trim(),
    city: String(raw.city || "").trim(),
    province: String(raw.province || "").trim().toUpperCase(),
    phone: String(raw.phone || "").trim(),
  };
  const missing = ["name", "address", "zip", "city", "province"].filter((k) => !shipping[k]);
  if (missing.length) {
    const e = new Error("Dati di spedizione mancanti.");
    e.statusCode = 400;
    throw e;
  }
  return shipping;
}

// Legge il carrello dell'utente e calcola gli articoli + il totale.
// Non scrive nulla: serve per mostrare l'importo (es. a PayPal) prima di pagare.
export async function readCart(userId) {
  const { rows } = await pool.query(
    `select ci.product_id, ci.size, ci.quantity,
            p.name, p.color, p.price
       from cart_items ci
       join products p on p.id = ci.product_id
      where ci.user_id = $1
      order by ci.created_at`,
    [userId]
  );
  const items = rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    color: r.color,
    size: r.size,
    quantity: r.quantity,
    price: Number(r.price),
    subtotal: Number(r.price) * r.quantity,
  }));
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  return { items, total };
}

/**
 * Crea l'ordine a partire dal carrello, dentro una transazione:
 * inserisce ordine + righe, scala la giacenza, (se pagato) svuota il carrello,
 * poi invia email al cliente e notifica Telegram al titolare.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {object} opts.shipping        già normalizzato
 * @param {string} [opts.status]        "paid" (default) | "pending"
 * @param {string} [opts.paymentRef]    riferimento pagamento (es. id PayPal)
 * @param {string} [opts.customerEmail] email cliente (default: quella dell'account)
 * @param {boolean} [opts.enforceStock] se true rifiuta quando la giacenza non basta
 *                                       (usare false quando il pagamento è GIÀ incassato)
 */
export async function createOrderFromCart({
  userId,
  shipping,
  status = "paid",
  paymentRef = null,
  customerEmail = null,
  enforceStock = true,
}) {
  const client = await pool.connect();
  let committed = false;
  try {
    const userRes = await client.query(
      `select email, username from users where id = $1`,
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) {
      const e = new Error("Utente non trovato.");
      e.statusCode = 404;
      throw e;
    }
    const email = (customerEmail || user.email).trim().toLowerCase();

    const { items, total } = await readCart(userId);
    if (items.length === 0) {
      const e = new Error("Il carrello è vuoto.");
      e.statusCode = 400;
      throw e;
    }

    await client.query("begin");

    const orderRes = await client.query(
      `insert into orders (user_id, status, total, customer_email, shipping, stripe_payment_intent_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id, created_at`,
      [userId, status, total, email, JSON.stringify(shipping), paymentRef]
    );
    const orderId = orderRes.rows[0].id;

    for (const i of items) {
      await client.query(
        `insert into order_items (order_id, product_id, size, quantity, unit_price)
         values ($1, $2, $3, $4, $5)`,
        [orderId, i.productId, i.size, i.quantity, i.price]
      );

      if (enforceStock) {
        // Scala la giacenza solo se ce n'è abbastanza, altrimenti annulla.
        const dec = await client.query(
          `update products set stock = stock - $1 where id = $2 and stock >= $1`,
          [i.quantity, i.productId]
        );
        if (dec.rowCount === 0) {
          const e = new Error(`"${i.name} ${i.color}" non è più disponibile nella quantità richiesta.`);
          e.statusCode = 409;
          throw e;
        }
      } else {
        // Pagamento già incassato: onoriamo l'ordine e non scendiamo sotto zero.
        await client.query(
          `update products set stock = greatest(stock - $1, 0) where id = $2`,
          [i.quantity, i.productId]
        );
      }
    }

    if (status === "paid") {
      await client.query(`delete from cart_items where user_id = $1`, [userId]);
    }

    await client.query("commit");
    committed = true;

    // --- Notifiche (fuori transazione) -------------------------------
    if (status === "paid") {
      sendOrderConfirmation(email, {
        id: orderId,
        total,
        items,
        customerName: user.username,
        shipping,
      }).catch((e) => console.error("order email error:", e.message));

      const tg =
        `🦈 <b>Nuovo ordine KROMA</b>\n` +
        `#${String(orderId).slice(0, 8).toUpperCase()} · ${euro(total)}\n` +
        `Cliente: ${user.username} (${email})\n\n` +
        `📦 <b>Spedire a:</b>\n` +
        `${shipping.name}\n` +
        `${shipping.address}\n` +
        `${shipping.zip} ${shipping.city} (${shipping.province})\n` +
        (shipping.phone ? `Tel: ${shipping.phone}\n` : "") +
        `\n` +
        items.map((i) => `• ${i.name} ${i.color} · ${i.size} ×${i.quantity}`).join("\n");
      sendTelegram(tg).catch((e) => console.error("telegram error:", e.message));
    }

    return { orderId, status, total, items, customerEmail: email, username: user.username };
  } catch (err) {
    if (!committed) {
      try { await client.query("rollback"); } catch {}
    }
    throw err;
  } finally {
    client.release();
  }
}
