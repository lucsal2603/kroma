// Logica condivisa per trasformare il carrello di un utente in un ordine.
// Usata sia dal checkout "classico" (POST /checkout) sia dalla cattura
// del pagamento PayPal (POST /paypal/capture-order).
import { pool } from "../db/index.js";
import { sendOrderConfirmation } from "./orderEmail.js";
import { sendTelegram } from "./telegram.js";
import { welcomeDiscountFor, round2, effectivePrice } from "./discount.js";

const euro = (n) => "€ " + Number(n).toFixed(2).replace(".", ",");

// Legge la % di sconto di benvenuto valida per l'utente.
// È difensiva: se la colonna `welcome_used` non è ancora stata migrata
// (codice 42703), la funzione resta spenta e restituisce { percent: 0,
// available: false } senza rompere gli ordini.
async function readWelcomePercent(db, userId) {
  try {
    const { rows } = await db.query(
      `select created_at, welcome_used from users where id = $1`,
      [userId]
    );
    return { percent: welcomeDiscountFor(rows[0]), available: true };
  } catch (e) {
    if (e.code === "42703") return { percent: 0, available: false };
    throw e;
  }
}

// Calcola il preventivo dell'utente: articoli, subtotale, sconto e totale.
// Non scrive nulla. Usato per mostrare l'importo (es. a PayPal) prima di pagare.
export async function quoteForUser(userId) {
  const { items, total: subtotal } = await readCart(userId);
  const { percent } = await readWelcomePercent(pool, userId);
  const discount = round2((subtotal * percent) / 100);
  const total = round2(subtotal - discount);
  return { items, subtotal, discountPercent: percent, discount, total };
}

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
  // Include sale_price (prezzo scontato del prodotto). Se la colonna non è
  // ancora stata migrata (42703), ripiega sulla query senza sconto prodotto.
  const build = (saleCol) =>
    `select ci.product_id, ci.size, ci.quantity,
            p.name, p.color, p.price${saleCol}
       from cart_items ci
       join products p on p.id = ci.product_id
      where ci.user_id = $1
      order by ci.created_at`;
  let rows;
  try {
    ({ rows } = await pool.query(build(", p.sale_price"), [userId]));
  } catch (e) {
    if (e.code !== "42703") throw e;
    ({ rows } = await pool.query(build(""), [userId]));
  }
  const items = rows.map((r) => {
    const price = round2(effectivePrice(r.price, r.sale_price));
    return {
      productId: r.product_id,
      name: r.name,
      color: r.color,
      size: r.size,
      quantity: r.quantity,
      price,
      subtotal: round2(price * r.quantity),
    };
  });
  const total = round2(items.reduce((s, i) => s + i.subtotal, 0));
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

    const { items, total: subtotal } = await readCart(userId);
    if (items.length === 0) {
      const e = new Error("Il carrello è vuoto.");
      e.statusCode = 400;
      throw e;
    }

    // Sconto di benvenuto (calcolato fuori transazione per gestire in
    // sicurezza l'eventuale colonna non ancora migrata).
    const { percent: discountPercent, available: welcomeAvailable } =
      await readWelcomePercent(client, userId);
    const discount = round2((subtotal * discountPercent) / 100);
    const total = round2(subtotal - discount);

    await client.query("begin");

    // Inserisce l'ordine. Include discount_percent solo se la colonna esiste.
    const orderCols =
      "user_id, status, total, customer_email, shipping, stripe_payment_intent_id" +
      (welcomeAvailable ? ", discount_percent" : "");
    const orderVals = [userId, status, total, email, JSON.stringify(shipping), paymentRef];
    const orderPh = "$1, $2, $3, $4, $5, $6" + (welcomeAvailable ? ", $7" : "");
    if (welcomeAvailable) orderVals.push(discountPercent);
    const orderRes = await client.query(
      `insert into orders (${orderCols}) values (${orderPh}) returning id, created_at`,
      orderVals
    );
    const orderId = orderRes.rows[0].id;

    // Buono di benvenuto usato una sola volta: lo "consumiamo".
    if (welcomeAvailable && discountPercent > 0) {
      await client.query(`update users set welcome_used = true where id = $1`, [userId]);
    }

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
        subtotal,
        discountPercent,
        discount,
        items,
        customerName: user.username,
        shipping,
      }).catch((e) => console.error("order email error:", e.message));

      const tg =
        `🦈 <b>Nuovo ordine KROMA</b>\n` +
        `#${String(orderId).slice(0, 8).toUpperCase()} · ${euro(total)}\n` +
        (discountPercent > 0
          ? `Subtotale ${euro(subtotal)} · Sconto benvenuto -${discountPercent}% (−${euro(discount)})\n`
          : "") +
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

    return {
      orderId, status, total, subtotal, discount, discountPercent,
      items, customerEmail: email, username: user.username,
    };
  } catch (err) {
    if (!committed) {
      try { await client.query("rollback"); } catch {}
    }
    throw err;
  } finally {
    client.release();
  }
}
