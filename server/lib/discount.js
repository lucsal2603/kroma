// Sconto di benvenuto per i nuovi iscritti.
// Configurabile via variabili d'ambiente (default: 15% per 24 ore, una volta).
//   WELCOME_DISCOUNT_PERCENT -> percentuale (0 = disattivato)
//   WELCOME_DISCOUNT_HOURS   -> finestra in ore dalla registrazione
import "dotenv/config";

export const WELCOME_PERCENT = clampPercent(
  Number(process.env.WELCOME_DISCOUNT_PERCENT ?? 15)
);
export const WELCOME_HOURS = Math.max(
  0,
  Number(process.env.WELCOME_DISCOUNT_HOURS ?? 24)
);

function clampPercent(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(90, Math.max(0, Math.round(n)));
}

// Arrotonda a 2 decimali (centesimi) evitando errori di virgola mobile.
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// Prezzo effettivo di vendita di un prodotto: usa il prezzo scontato
// (sale_price) solo se è un numero valido, > 0 e davvero più basso del prezzo
// pieno; altrimenti resta il prezzo pieno. Robusta anche se sale_price è
// null/undefined (colonna non ancora migrata).
export function effectivePrice(price, salePrice) {
  const full = Number(price);
  const sale = Number(salePrice);
  if (Number.isFinite(sale) && sale > 0 && sale < full) return sale;
  return full;
}

// Percentuale di sconto valida per un utente, in base alla riga DB
// { created_at, welcome_used }. Restituisce 0 se non idoneo:
//   - buono già usato, oppure
//   - passate più di WELCOME_HOURS dalla registrazione.
export function welcomeDiscountFor(user) {
  if (!user || WELCOME_PERCENT <= 0) return 0;
  if (user.welcome_used) return 0;
  const created = new Date(user.created_at).getTime();
  if (!Number.isFinite(created)) return 0;
  const ageMs = Date.now() - created;
  if (ageMs < 0 || ageMs > WELCOME_HOURS * 3600 * 1000) return 0;
  return WELCOME_PERCENT;
}
