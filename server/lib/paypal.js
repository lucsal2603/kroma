// Integrazione PayPal (API REST "Orders v2").
// Configurazione via variabili d'ambiente:
//   PAYPAL_CLIENT_ID     -> Client ID dell'app PayPal
//   PAYPAL_CLIENT_SECRET -> Secret dell'app PayPal
//   PAYPAL_ENV           -> "sandbox" (default) oppure "live"
// Se le chiavi non ci sono, paypalConfigured = false e il sito resta in
// modalità simulata (nessun pagamento reale).
import "dotenv/config";

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
const PAYPAL_ENV = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();

export const paypalConfigured = Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
export const paypalClientId = PAYPAL_CLIENT_ID || "";
export const paypalEnv = PAYPAL_ENV;
export const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || "EUR";

const BASE = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

// Ottiene un token d'accesso (OAuth client_credentials).
async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(`PayPal token error: ${r.status} ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Crea un ordine PayPal per l'importo indicato. Restituisce l'id dell'ordine.
export async function createOrder(total) {
  const token = await getAccessToken();
  const r = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: PAYPAL_CURRENCY,
            value: Number(total).toFixed(2),
          },
        },
      ],
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(`PayPal create order error: ${r.status} ${JSON.stringify(data)}`);
  }
  return data; // { id, status, ... }
}

// Cattura (incassa) un ordine PayPal già approvato dal cliente.
export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const r = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(`PayPal capture error: ${r.status} ${JSON.stringify(data)}`);
  }
  return data; // { id, status: "COMPLETED", ... }
}
