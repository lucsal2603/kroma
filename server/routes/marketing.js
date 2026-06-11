// Rotte per le campagne email (marketing).
//   PATCH  /user/marketing        -> il cliente imposta il consenso (login)
//   GET    /unsubscribe?token=...  -> disiscrizione one-click (pubblica, HTML)
//   POST   /marketing/cron?key=... -> trigger automatico (servizio esterno)
//   GET    /admin/marketing        -> stato campagna (admin)
//   PATCH  /admin/marketing        -> imposta intervallo / automatico (admin)
//   POST   /admin/marketing/send   -> invia ora (admin)
import { Router } from "express";
import { requireAuth, requireAdmin } from "../lib/auth.js";
import { logActivity } from "../lib/activity.js";
import {
  getStatus,
  updateConfig,
  sendCampaign,
  runDueCampaign,
  setConsent,
  adminSetSubscribed,
  unsubscribeByToken,
} from "../lib/marketing.js";

const router = Router();

// --- PATCH /user/marketing (cliente loggato) ------------------------
router.patch("/user/marketing", requireAuth, async (req, res) => {
  try {
    const consent = Boolean(req.body?.consent);
    const result = await setConsent(req.user.id, consent);
    return res.json({ consent, ...result });
  } catch (err) {
    console.error("set consent error:", err);
    return res.status(500).json({ error: "Errore nel salvataggio della preferenza." });
  }
});

// --- GET /unsubscribe?token=... (pubblica, risponde con una paginetta) ---
router.get("/unsubscribe", async (req, res) => {
  const token = String(req.query.token || "");
  let ok = false;
  try {
    ok = await unsubscribeByToken(token);
  } catch (err) {
    console.error("unsubscribe error:", err);
  }
  const msg = ok
    ? "Sei stato disiscritto. Non riceverai più email promozionali da KROMA."
    : "Link non valido o già usato. Se continui a ricevere email, contattaci.";
  res
    .status(ok ? 200 : 400)
    .set("Content-Type", "text/html; charset=utf-8")
    .send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KROMA — Disiscrizione</title></head>
<body style="font-family:system-ui,Arial,sans-serif;background:#0e0e10;color:#eee;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
  <div style="max-width:420px;text-align:center;border:1px solid #2a2a2e;border-radius:18px;padding:36px;background:#161618">
    <div style="font-size:30px;letter-spacing:.05em;color:#d7ff3e;font-weight:800">KROMA</div>
    <p style="margin-top:18px;line-height:1.6">${msg}</p>
    <a href="https://lucsal2603.github.io/kroma/" style="display:inline-block;margin-top:18px;color:#0e0e10;background:#d7ff3e;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700">Torna al sito</a>
  </div>
</body></html>`);
});

// --- POST /marketing/cron?key=... (servizio esterno, es. cron-job.org) ---
// Protetta da una chiave segreta (env MARKETING_CRON_KEY). Decide da sola se
// è il momento di inviare in base all'intervallo impostato.
router.post("/marketing/cron", async (req, res) => {
  const expected = process.env.MARKETING_CRON_KEY;
  const provided = req.query.key || req.headers["x-cron-key"];
  if (!expected) {
    return res.status(403).json({ error: "Cron non configurato (manca MARKETING_CRON_KEY)." });
  }
  if (provided !== expected) {
    return res.status(401).json({ error: "Chiave cron non valida." });
  }
  try {
    const result = await runDueCampaign();
    return res.json(result);
  } catch (err) {
    console.error("cron campaign error:", err);
    return res.status(500).json({ error: "Errore durante l'invio automatico." });
  }
});

// Tutte le rotte /admin passano da requireAuth + requireAdmin.
// (Il path "/admin" è obbligatorio: senza, il middleware si applicherebbe a
//  ogni richiesta di questo router, incluse /unsubscribe e /marketing/cron.)
router.use("/admin", requireAuth, requireAdmin);

// --- GET /admin/marketing -------------------------------------------
router.get("/admin/marketing", async (_req, res) => {
  try {
    const status = await getStatus();
    return res.json(status);
  } catch (err) {
    console.error("marketing status error:", err);
    return res.status(500).json({ error: "Errore nel recupero dello stato campagne." });
  }
});

// --- PATCH /admin/marketing -----------------------------------------
router.patch("/admin/marketing", async (req, res) => {
  try {
    const config = await updateConfig({
      intervalDays: req.body?.intervalDays,
      autoEnabled: req.body?.autoEnabled,
    });
    const parts = [];
    if (req.body?.intervalDays !== undefined) parts.push(`ogni ${config.intervalDays} giorni`);
    if (req.body?.autoEnabled !== undefined)
      parts.push(config.autoEnabled ? "automatico ON" : "automatico OFF");
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: "marketing.config",
      detail: parts.join(" · ") || null,
    });
    return res.json({ config });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("marketing config error:", err);
    return res.status(500).json({ error: "Errore nel salvataggio delle impostazioni." });
  }
});

// --- PATCH /admin/marketing/subscriber/:id (accende/spegne un iscritto) ---
router.patch("/admin/marketing/subscriber/:id", async (req, res) => {
  try {
    const subscribed = Boolean(req.body?.subscribed);
    await adminSetSubscribed(req.params.id, subscribed);
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: subscribed ? "user.email.on" : "user.email.off",
    });
    return res.json({ subscribed });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("admin subscriber error:", err);
    return res.status(500).json({ error: "Errore nel salvataggio della preferenza." });
  }
});

// --- POST /admin/marketing/send (invia ora) -------------------------
router.post("/admin/marketing/send", async (req, res) => {
  try {
    const exclude = Array.isArray(req.body?.exclude) ? req.body.exclude : [];
    const result = await sendCampaign({ trigger: "manual", exclude });
    const detail = result.reason
      ? `non inviata (${result.reason})`
      : `inviata a ${result.sent}/${result.total} · ${result.offers} offerte` +
        (result.excluded ? ` · ${result.excluded} esclusi` : "");
    await logActivity({
      userId: req.user.id,
      username: req.user.username,
      action: "marketing.send",
      detail,
    });
    return res.json(result);
  } catch (err) {
    console.error("marketing send error:", err);
    return res.status(500).json({ error: "Errore durante l'invio della campagna." });
  }
});

export default router;
