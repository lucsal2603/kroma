// Rotte prodotti (pubbliche):
//   GET /products       -> elenco dei caschi
//   GET /products/:id   -> singolo casco (per id o per code, es. SZ-02)
import { Router } from "express";
import { query } from "../db/index.js";

const router = Router();

// Forma "pulita" del prodotto per il frontend.
function toProduct(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    brand: r.brand,
    model: r.model,
    color: r.color,
    price: Number(r.price),
    stock: r.stock ?? 0,
    img: r.img_url,
    imgBack: r.img_back_url,
    gallery: r.gallery || [],
    swatch: r.swatch,
    tag: r.tag,
    bestSeller: r.best_seller,
    blurb: r.blurb,
    specs: r.specs || [],
  };
}

// --- GET /products --------------------------------------------------
router.get("/products", async (_req, res) => {
  try {
    const { rows } = await query(`select * from products order by code`);
    return res.json({ products: rows.map(toProduct) });
  } catch (err) {
    console.error("products list error:", err);
    return res.status(500).json({ error: "Errore nel recupero dei prodotti." });
  }
});

// --- GET /products/:id ----------------------------------------------
// Accetta sia l'UUID sia il code (SZ-01 / SZ-02 / SZ-03).
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const { rows } = await query(
      isUuid
        ? `select * from products where id = $1 limit 1`
        : `select * from products where upper(code) = upper($1) limit 1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Prodotto non trovato." });
    return res.json({ product: toProduct(rows[0]) });
  } catch (err) {
    console.error("product detail error:", err);
    return res.status(500).json({ error: "Errore nel recupero del prodotto." });
  }
});

export default router;
