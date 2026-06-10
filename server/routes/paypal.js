// Rotte PayPal:
//   GET  /paypal/config         -> dati pubblici per il frontend (client id, valuta)
//   POST /paypal/create-order   -> crea l'ordine PayPal con il totale del carrello (login)
//   POST /paypal/capture-order  -> incassa il pagamento e crea l'ordine KROMA (login)
import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  paypalConfigured,
  paypalClientId,
  paypalEnv,
  PAYPAL_CURRENCY,
  createOrder,
  captureOrder,
} from "../lib/paypal.js";
import { createOrderFromCart, normalizeShipping, readCart } from "../lib/orders.js";

const router = Router();

// --- GET /paypal/config ---------------------------------------------
// Il client id è pubblico: serve al frontend per caricare i pulsanti PayPal.
router.get("/paypal/config", (_req, res) => {
  res.json({
    configured: paypalConfigured,
    clientId: paypalClientId,
    currency: PAYPAL_CURRENCY,
    env: paypalEnv,
  });
});

// --- POST /paypal/create-order --------------------------------------
router.post("/paypal/create-order", requireAuth, async (req, res) => {
  if (!paypalConfigured) {
    return res.status(503).json({ error: "Pagamenti PayPal non configurati." });
  }
  try {
    const { total } = await readCart(req.user.id);
    if (!total || total <= 0) {
      return res.status(400).json({ error: "Il carrello è vuoto." });
    }
    const order = await createOrder(total);
    return res.json({ id: order.id });
  } catch (err) {
    console.error("paypal create-order error:", err.message);
    return res.status(502).json({ error: "Impossibile avviare il pagamento PayPal." });
  }
});

// --- POST /paypal/capture-order -------------------------------------
// Body: { orderID, shipping }
router.post("/paypal/capture-order", requireAuth, async (req, res) => {
  if (!paypalConfigured) {
    return res.status(503).json({ error: "Pagamenti PayPal non configurati." });
  }
  try {
    const orderID = String(req.body?.orderID || "").trim();
    if (!orderID) return res.status(400).json({ error: "Ordine PayPal mancante." });

    // I dati di spedizione sono obbligatori (lancia 400 se mancano).
    const shipping = normalizeShipping(req.body?.shipping);

    // Incassa il pagamento su PayPal.
    const capture = await captureOrder(orderID);
    if (capture.status !== "COMPLETED") {
      return res.status(402).json({ error: "Pagamento non completato." });
    }

    // Pagamento riuscito: crea l'ordine KROMA. enforceStock=false perché i
    // soldi sono già stati incassati, quindi l'ordine va comunque onorato.
    const result = await createOrderFromCart({
      userId: req.user.id,
      shipping,
      status: "paid",
      paymentRef: capture.id,
      enforceStock: false,
    });

    return res.status(201).json({
      order: {
        id: result.orderId,
        status: result.status,
        total: result.total,
        items: result.items,
        customerEmail: result.customerEmail,
      },
      paid: true,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("paypal capture-order error:", err.message);
    return res.status(502).json({ error: "Errore durante l'incasso del pagamento." });
  }
});

export default router;
