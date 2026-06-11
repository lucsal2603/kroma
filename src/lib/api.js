// "Centralino" che fa parlare il sito col backend (motore su Render).
// In locale puoi sovrascrivere l'indirizzo con VITE_API_URL nel file .env.
const API_BASE = import.meta.env.VITE_API_URL || "https://kroma-backend.onrender.com";

const TOKEN_KEY = "kroma_token";

// localStorage può lanciare un errore su Safari in modalità privata / blindata:
// lo avvolgiamo così il login non si rompe mai per questo motivo.
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* storage non disponibile (Safari privato): si resta loggati solo per questa sessione */
  }
};
export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* niente da fare */
  }
};

// Chiamata generica al backend. Aggiunge il token se richiesto e
// trasforma gli errori del server in eccezioni con un messaggio leggibile.
async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Impossibile contattare il server. Riprova tra poco.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* risposta senza corpo JSON */
  }

  if (!res.ok) {
    throw new Error(data?.error || "Errore del server. Riprova.");
  }
  return data;
}

export const api = {
  // --- Auth ---
  register: (payload) => request("/register", { method: "POST", body: payload }),
  login: (payload) => request("/login", { method: "POST", body: payload }),
  profile: () => request("/user/profile", { auth: true }),
  forgotPassword: (email) => request("/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, password) =>
    request("/reset-password", { method: "POST", body: { token, password } }),

  // --- Prodotti ---
  getProducts: () => request("/products"),

  // --- Carrello (richiede login) ---
  getCart: () => request("/cart", { auth: true }),
  addToCart: (productId, size, quantity = 1) =>
    request("/cart", { method: "POST", auth: true, body: { productId, size, quantity } }),
  removeCartItem: (itemId) => request(`/cart/${itemId}`, { method: "DELETE", auth: true }),
  clearCart: () => request("/cart", { method: "DELETE", auth: true }),

  // --- Checkout (richiede login) ---
  checkout: (payload = {}) => request("/checkout", { method: "POST", auth: true, body: payload }),
  getOrders: () => request("/orders", { auth: true }),

  // --- Sconto di benvenuto ---
  getWelcomeConfig: () => request("/welcome-config"),

  // --- Marketing (consenso cliente) ---
  setMarketingConsent: (consent) =>
    request("/user/marketing", { method: "PATCH", auth: true, body: { consent } }),

  // --- PayPal ---
  getPaypalConfig: () => request("/paypal/config"),
  createPaypalOrder: () => request("/paypal/create-order", { method: "POST", auth: true }),
  capturePaypalOrder: (orderID, shipping) =>
    request("/paypal/capture-order", { method: "POST", auth: true, body: { orderID, shipping } }),

  // --- Admin (richiede account amministratore) ---
  getAllOrders: () => request("/admin/orders", { auth: true }),
  updateStock: (productId, stock) =>
    request(`/admin/products/${productId}`, { method: "PATCH", auth: true, body: { stock } }),
  createProduct: (payload) =>
    request("/admin/products", { method: "POST", auth: true, body: payload }),
  updateProduct: (productId, payload) =>
    request(`/admin/products/${productId}`, { method: "PATCH", auth: true, body: payload }),
  deleteProduct: (productId) =>
    request(`/admin/products/${productId}`, { method: "DELETE", auth: true }),

  // --- Admin: iscritti / registro attività ---
  getUsers: (q = "") =>
    request("/admin/users" + (q ? `?q=${encodeURIComponent(q)}` : ""), { auth: true }),
  getUserDetail: (id) => request(`/admin/users/${id}`, { auth: true }),
  revealUserEmail: (id) => request(`/admin/users/${id}/email`, { auth: true }),
  setUserDisabled: (id, disabled) =>
    request(`/admin/users/${id}/disabled`, { method: "PATCH", auth: true, body: { disabled } }),
  setUserAdmin: (id, isAdmin) =>
    request(`/admin/users/${id}/admin`, { method: "PATCH", auth: true, body: { isAdmin } }),
  getActivity: () => request("/admin/activity", { auth: true }),
  clearActivity: () => request("/admin/activity", { method: "DELETE", auth: true }),
  deleteActivityEntry: (id) => request(`/admin/activity/${id}`, { method: "DELETE", auth: true }),

  // --- Admin: campagne email ---
  getMarketing: () => request("/admin/marketing", { auth: true }),
  getMarketingPreview: () => request("/admin/marketing/preview", { auth: true }),
  updateMarketing: (config) =>
    request("/admin/marketing", { method: "PATCH", auth: true, body: config }),
  sendMarketingNow: (exclude = []) =>
    request("/admin/marketing/send", { method: "POST", auth: true, body: { exclude } }),
  setSubscriberActive: (id, subscribed) =>
    request(`/admin/marketing/subscriber/${id}`, { method: "PATCH", auth: true, body: { subscribed } }),

  // --- Recensioni del sito ---
  // submitReview funziona anche da ospite: il token viene aggiunto solo se c'è.
  submitReview: (payload) => request("/reviews", { method: "POST", auth: true, body: payload }),
  getReviews: () => request("/admin/reviews", { auth: true }),
  deleteReview: (id) => request(`/admin/reviews/${id}`, { method: "DELETE", auth: true }),
};

export { API_BASE };
