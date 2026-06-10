// KROMA backend — entrypoint Express.
import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import cartRoutes from "./routes/cart.js";
import checkoutRoutes from "./routes/checkout.js";
import adminRoutes from "./routes/admin.js";
import paypalRoutes from "./routes/paypal.js";

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middleware globali ---------------------------------------------
app.use(express.json());

// CORS: consenti il frontend (GitHub Pages) + sviluppo locale.
const allowedOrigins = [
  process.env.CORS_ORIGIN,            // es. https://lucsal2603.github.io
  "http://localhost:5173",
  "http://localhost:5180",
].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // richieste senza origin (curl, app mobile) consentite
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Origin non consentita dalla CORS: " + origin));
    },
    credentials: true,
  })
);

// --- Health check ----------------------------------------------------
app.get("/", (_req, res) => {
  res.json({ name: "kroma-backend", status: "ok", time: new Date().toISOString() });
});
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// --- Rotte -----------------------------------------------------------
app.use("/", authRoutes);     // /register, /login, /user/profile, /forgot-password, /reset-password
app.use("/", productRoutes);  // /products, /products/:id
app.use("/", cartRoutes);     // /cart (POST/GET/DELETE)
app.use("/", checkoutRoutes); // /checkout, /orders
app.use("/", adminRoutes);    // /admin/orders, /admin/products/:id
app.use("/", paypalRoutes);   // /paypal/config, /paypal/create-order, /paypal/capture-order

// --- 404 -------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: "Rotta non trovata: " + req.method + " " + req.path });
});

// --- Avvio -----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🦈 KROMA backend in ascolto su http://localhost:${PORT}`);
});
