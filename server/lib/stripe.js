// Inizializza Stripe se la chiave è configurata, altrimenti resta null
// (modalità sviluppo: il checkout simula il pagamento riuscito).
import "dotenv/config";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

export const stripe = key ? new Stripe(key) : null;
export const stripeConfigured = Boolean(key);
