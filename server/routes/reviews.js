// Rotte RECENSIONI:
//   POST   /reviews            -> un cliente lascia una valutazione (anche da ospite)
//   GET    /admin/reviews      -> elenco recensioni (solo admin)
//   DELETE /admin/reviews/:id  -> cancella una recensione (solo proprietario)
import { Router } from "express";
import { requireAuth, requireAdmin, requireOwner, isOwner, verifyToken } from "../lib/auth.js";
import { addReview, getReviews, deleteReview } from "../lib/reviews.js";

const router = Router();

// Auth "morbida": se c'è un token valido attacca l'utente, altrimenti prosegue
// come ospite. Così anche chi non ha l'account può lasciare una recensione.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const payload = verifyToken(token);
      req.user = { id: payload.sub, username: payload.username };
    } catch {
      /* token non valido o scaduto: resta ospite */
    }
  }
  next();
}

// POST /reviews — voto 1-5 + commento facoltativo.
router.post("/reviews", optionalAuth, async (req, res) => {
  const rating = Number(req.body?.rating);
  const comment =
    typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 1000) : "";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Dai un voto da 1 a 5 stelle." });
  }

  try {
    const review = await addReview({
      userId: req.user?.id || null,
      username: req.user?.username || null,
      rating,
      comment: comment || null,
    });
    return res.status(201).json({ review });
  } catch (e) {
    if (e.code === "42P01") {
      return res.status(503).json({ error: "Le recensioni non sono ancora attive. Riprova più tardi." });
    }
    console.error("POST /reviews error:", e);
    return res.status(500).json({ error: "Errore nel salvataggio della recensione." });
  }
});

// GET /admin/reviews — elenco per la dashboard admin.
router.get("/admin/reviews", requireAuth, requireAdmin, async (req, res) => {
  try {
    const reviews = await getReviews();
    return res.json({ reviews, viewerIsOwner: await isOwner(req.user.id) });
  } catch (e) {
    console.error("GET /admin/reviews error:", e);
    return res.status(500).json({ error: "Errore nel caricamento delle recensioni." });
  }
});

// DELETE /admin/reviews/:id — solo il proprietario.
router.delete("/admin/reviews/:id", requireAuth, requireOwner, async (req, res) => {
  try {
    const ok = await deleteReview(req.params.id);
    if (!ok) return res.status(404).json({ error: "Recensione non trovata." });
    return res.json({ deleted: req.params.id });
  } catch (e) {
    console.error("DELETE /admin/reviews error:", e);
    return res.status(500).json({ error: "Errore nella cancellazione." });
  }
});

export default router;
