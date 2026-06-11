// Campagne email "offerte" verso i clienti che hanno dato il consenso.
// - Il testo si compone DA SOLO con i prodotti in sconto del momento.
// - Si può inviare a mano ("Invia ora") oppure in automatico ogni N giorni.
// - Ogni email ha il link per disiscriversi (a norma di legge).
import "dotenv/config";
import crypto from "node:crypto";
import { pool, query } from "../db/index.js";
import { sendMail, smtpConfigured } from "./mailer.js";
import { effectivePrice } from "./discount.js";

// URL pubblici: il negozio (frontend su GitHub Pages) e il backend (per il
// link di disiscrizione, che deve essere gestito dal server).
const APP_URL = (process.env.APP_URL || "https://lucsal2603.github.io/kroma").replace(/\/$/, "");
const BACKEND_URL = (process.env.BACKEND_URL || "https://kroma-backend.onrender.com").replace(/\/$/, "");
const MAIL_BRAND = "KROMA";

const euro = (n) => "€ " + Number(n).toFixed(2).replace(".", ",");
const pct = (full, sale) => Math.round((1 - sale / full) * 100);

// Oscura l'email per la lista nel pannello admin (es. "lu***@gm***.com").
function maskEmail(email) {
  const [user, domain] = String(email || "").split("@");
  if (!user || !domain) return "—";
  const mu = user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "***";
  const dot = domain.lastIndexOf(".");
  const tld = dot >= 0 ? domain.slice(dot) : "";
  const dname = dot >= 0 ? domain.slice(0, dot) : domain;
  const md = dname.length <= 2 ? dname[0] + "*" : dname.slice(0, 2) + "***";
  return `${mu}@${md}${tld}`;
}

// --- Impostazioni campagna (riga singola in marketing_config) --------
// Difensiva: se la tabella non è ancora migrata, restituisce i default.
export async function getConfig() {
  try {
    const { rows } = await query(
      `select interval_days, auto_enabled, last_sent_at from marketing_config where id = true`
    );
    const r = rows[0];
    if (!r) return { intervalDays: 7, autoEnabled: false, lastSentAt: null, available: true };
    return {
      intervalDays: Number(r.interval_days) || 7,
      autoEnabled: Boolean(r.auto_enabled),
      lastSentAt: r.last_sent_at,
      available: true,
    };
  } catch (e) {
    if (e.code === "42P01" || e.code === "42703") {
      return { intervalDays: 7, autoEnabled: false, lastSentAt: null, available: false };
    }
    throw e;
  }
}

export async function updateConfig({ intervalDays, autoEnabled }) {
  const sets = [];
  const vals = [];
  if (intervalDays !== undefined) {
    const n = Math.max(1, Math.min(365, Math.round(Number(intervalDays))));
    if (!Number.isFinite(n)) {
      const e = new Error("Numero di giorni non valido.");
      e.statusCode = 400;
      throw e;
    }
    vals.push(n);
    sets.push(`interval_days = $${vals.length}`);
  }
  if (autoEnabled !== undefined) {
    vals.push(Boolean(autoEnabled));
    sets.push(`auto_enabled = $${vals.length}`);
  }
  if (!sets.length) return getConfig();
  await query(`update marketing_config set ${sets.join(", ")} where id = true`, vals);
  return getConfig();
}

// --- Prodotti in offerta (sale_price valido e più basso del prezzo) ---
async function getOnSaleProducts() {
  try {
    const { rows } = await query(
      `select code, name, brand, color, price, sale_price, img_url
         from products
        where sale_price is not null and sale_price > 0 and sale_price < price
        order by (1 - sale_price / price) desc
        limit 6`
    );
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      brand: r.brand,
      color: r.color,
      price: Number(r.price),
      salePrice: Number(r.sale_price),
      img: r.img_url,
    }));
  } catch (e) {
    if (e.code === "42703") return []; // colonna sale_price non migrata
    throw e;
  }
}

// --- Destinatari: clienti che hanno dato il consenso -----------------
async function getRecipients() {
  try {
    const { rows } = await query(
      `select id, email, username, unsubscribe_token
         from users
        where marketing_consent = true and email is not null`
    );
    return { list: rows, available: true };
  } catch (e) {
    if (e.code === "42703") return { list: [], available: false }; // colonna non migrata
    throw e;
  }
}

// --- Lista per il pannello admin -------------------------------------
// TUTTI gli utenti con email, col loro stato:
//   subscribed = riceve ora (marketing_consent)
//   optIn      = ha dato il permesso (marketing_opt_in)
// Chi non ha mai dato il permesso (optIn=false) appare ma non si può attivare.
// Difensiva: se le colonne non sono migrate, ripiega sui soli consenzienti.
async function getPanelSubscribers(consentingFallback = []) {
  try {
    const { rows } = await query(
      `select id, username, email, marketing_consent, marketing_opt_in
         from users
        where email is not null
        order by created_at desc`
    );
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: maskEmail(r.email),
      subscribed: Boolean(r.marketing_consent),
      optIn: Boolean(r.marketing_opt_in),
    }));
  } catch (e) {
    if (e.code !== "42703" && e.code !== "42P01") throw e;
    // colonne non ancora migrate: mostra i consenzienti, tutti attivi/sbloccati
    return consentingFallback.map((u) => ({
      id: u.id,
      username: u.username,
      email: maskEmail(u.email),
      subscribed: true,
      optIn: true,
    }));
  }
}

// L'admin accende/spegne il consenso di un utente. Non può attivare chi non ha
// mai dato il permesso (optIn=false). Non tocca mai l'opt-in: così uno che
// avevi spento resta riattivabile.
export async function adminSetSubscribed(userId, subscribed) {
  if (subscribed) {
    let optIn = true;
    try {
      const { rows } = await query(`select marketing_opt_in from users where id = $1`, [userId]);
      optIn = Boolean(rows[0]?.marketing_opt_in);
    } catch (e) {
      if (e.code !== "42703") throw e; // colonna non migrata: nessun blocco
    }
    if (!optIn) {
      const err = new Error("Questo iscritto non ha dato il consenso: non puoi attivargli le email.");
      err.statusCode = 403;
      throw err;
    }
  }
  try {
    await query(`update users set marketing_consent = $1 where id = $2`, [Boolean(subscribed), userId]);
  } catch (e) {
    if (e.code === "42703") {
      const err = new Error("Database non aggiornato per le campagne. Esegui la migrazione su Supabase.");
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
  return { ok: true };
}

// Garantisce un token di disiscrizione per l'utente (lo crea se manca).
async function ensureUnsubToken(userId, existing) {
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("hex");
  await query(`update users set unsubscribe_token = $1 where id = $2`, [token, userId]);
  return token;
}

// --- Composizione email "offerte" ------------------------------------
function buildCampaignEmail({ products, username, unsubToken }) {
  const maxOff = products.reduce((m, p) => Math.max(m, pct(p.price, p.salePrice)), 0);
  const subject = maxOff > 0 ? `🦈 Offerte KROMA — fino a -${maxOff}%` : "🦈 Novità da KROMA";
  const unsubUrl = `${BACKEND_URL}/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

  const cards = products
    .map((p) => {
      const off = pct(p.price, p.salePrice);
      // Le foto in data URL (base64) spesso vengono bloccate dai client email:
      // le mostriamo solo se sono URL http(s).
      const showImg = typeof p.img === "string" && /^https?:\/\//.test(p.img);
      const imgHtml = showImg
        ? `<img src="${p.img}" alt="${p.name}" width="120" style="width:120px;height:120px;object-fit:contain;background:#f4f4f3;border-radius:10px" />`
        : "";
      return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee" valign="top">${imgHtml}</td>
        <td style="padding:12px 0 12px 14px;border-bottom:1px solid #eee" valign="top">
          <div style="font-weight:700;font-size:16px">${p.name}</div>
          <div style="color:#888;font-size:13px">${[p.brand, p.color].filter(Boolean).join(" · ")}</div>
          <div style="margin-top:8px">
            <span style="color:#999;text-decoration:line-through">${euro(p.price)}</span>
            <span style="color:#111;font-weight:800;font-size:18px;margin-left:8px">${euro(p.salePrice)}</span>
            <span style="background:#e23;color:#fff;font-size:12px;font-weight:700;border-radius:20px;padding:2px 8px;margin-left:8px">-${off}%</span>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const html = `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#111">
    <div style="background:#1b1b1d;color:#d7ff3e;padding:22px 24px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:22px;letter-spacing:.04em">${MAIL_BRAND}</h1>
      <p style="margin:6px 0 0;color:#cfcfcb;font-size:14px">Le offerte del momento 🦈</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <p>Ciao ${username || ""}, abbiamo selezionato per te le offerte attive su KROMA:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">${cards}</table>
      <p style="text-align:center;margin:24px 0">
        <a href="${APP_URL}" style="background:#1b1b1d;color:#d7ff3e;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">Scopri le offerte</a>
      </p>
      <p style="color:#888;font-size:12px;line-height:1.6;border-top:1px solid #eee;padding-top:16px;margin-top:24px">
        Ricevi questa email perché hai dato il consenso alle comunicazioni promozionali di ${MAIL_BRAND}.<br>
        Non vuoi più riceverle? <a href="${unsubUrl}" style="color:#888">Disiscriviti qui</a>.
      </p>
    </div>
  </div>`;

  const text =
    `${MAIL_BRAND} — Le offerte del momento\n\n` +
    products
      .map((p) => `- ${p.name} (${p.color}): ${euro(p.price)} → ${euro(p.salePrice)} (-${pct(p.price, p.salePrice)}%)`)
      .join("\n") +
    `\n\nScopri le offerte: ${APP_URL}` +
    `\n\nRicevi questa email perché hai dato il consenso alle comunicazioni di ${MAIL_BRAND}.` +
    `\nDisiscriviti: ${unsubUrl}`;

  return { subject, html, text };
}

// --- Invio della campagna --------------------------------------------
// Restituisce { sent, total, offers, reason? }. Non lancia per i fallimenti
// di singole email (li conta e prosegue).
export async function sendCampaign({ trigger = "manual", exclude = [] } = {}) {
  if (!smtpConfigured) {
    return { sent: 0, total: 0, offers: 0, reason: "smtp-non-configurato" };
  }

  const products = await getOnSaleProducts();
  if (products.length === 0) {
    return { sent: 0, total: 0, offers: 0, reason: "nessuna-offerta" };
  }

  const { list, available } = await getRecipients();
  if (!available) {
    return { sent: 0, total: 0, offers: products.length, reason: "colonna-non-migrata" };
  }
  if (list.length === 0) {
    return { sent: 0, total: 0, offers: products.length, reason: "nessun-iscritto" };
  }

  // Escludiamo gli iscritti che l'admin ha deselezionato.
  const excludeSet = new Set((exclude || []).map(String));
  const targets = list.filter((u) => !excludeSet.has(String(u.id)));
  const excluded = list.length - targets.length;
  if (targets.length === 0) {
    return { sent: 0, total: 0, offers: products.length, excluded, reason: "nessun-iscritto" };
  }

  let sent = 0;
  let subjectUsed = "";
  for (const u of targets) {
    try {
      const token = await ensureUnsubToken(u.id, u.unsubscribe_token);
      const { subject, html, text } = buildCampaignEmail({
        products,
        username: u.username,
        unsubToken: token,
      });
      subjectUsed = subject;
      const res = await sendMail({ to: u.email, subject, html, text });
      if (res?.delivered) sent++;
      // piccola pausa per non sovraccaricare il provider SMTP
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error("campaign send error for", u.email, err.message);
    }
  }

  // Registra l'invio e aggiorna "ultimo invio".
  try {
    await query(
      `insert into marketing_sends (subject, recipients, trigger) values ($1, $2, $3)`,
      [subjectUsed || null, sent, trigger]
    );
    await query(`update marketing_config set last_sent_at = now() where id = true`);
  } catch (err) {
    console.error("campaign log error:", err.message);
  }

  return { sent, total: targets.length, offers: products.length, excluded };
}

// --- Stato per la dashboard admin ------------------------------------
export async function getStatus() {
  const config = await getConfig();
  const products = await getOnSaleProducts();
  const { list, available } = await getRecipients();

  let recentSends = [];
  try {
    const { rows } = await query(
      `select subject, recipients, trigger, created_at
         from marketing_sends order by created_at desc limit 5`
    );
    recentSends = rows.map((r) => ({
      subject: r.subject,
      recipients: Number(r.recipients),
      trigger: r.trigger,
      createdAt: r.created_at,
    }));
  } catch {
    /* tabella non migrata: nessuno storico */
  }

  // Prossimo invio previsto (se l'automatico è attivo).
  let nextSendAt = null;
  if (config.autoEnabled) {
    const base = config.lastSentAt ? new Date(config.lastSentAt).getTime() : Date.now();
    nextSendAt = new Date(base + config.intervalDays * 24 * 3600 * 1000).toISOString();
  }

  return {
    smtpConfigured,
    consentMigrated: available,
    configMigrated: config.available,
    intervalDays: config.intervalDays,
    autoEnabled: config.autoEnabled,
    lastSentAt: config.lastSentAt,
    nextSendAt,
    recipients: list.length,
    recipientsList: await getPanelSubscribers(list),
    offers: products.length,
    products: products.map((p) => ({
      name: p.name,
      color: p.color,
      price: p.price,
      salePrice: p.salePrice,
      off: pct(p.price, p.salePrice),
    })),
    recentSends,
  };
}

// --- Cron: invia solo se è passato abbastanza tempo ------------------
export async function runDueCampaign() {
  const config = await getConfig();
  if (!config.autoEnabled) return { skipped: true, reason: "auto-disattivato" };

  if (config.lastSentAt) {
    const elapsed = Date.now() - new Date(config.lastSentAt).getTime();
    const needed = config.intervalDays * 24 * 3600 * 1000;
    if (elapsed < needed) {
      return { skipped: true, reason: "non-ancora-scaduto", nextInMs: needed - elapsed };
    }
  }
  const result = await sendCampaign({ trigger: "auto" });
  return { skipped: false, ...result };
}

// Imposta il consenso marketing di un utente. Difensiva: se la colonna non è
// migrata (42703) non fa nulla e segnala available:false.
export async function setConsent(userId, consent) {
  // Se l'utente dà il consenso, registriamo anche il "permesso" (opt-in): da quel
  // momento l'admin potrà spegnere/riaccendere le sue email. Se lo toglie, non
  // tocchiamo l'opt-in.
  try {
    if (consent) {
      await query(
        `update users set marketing_consent = true, marketing_opt_in = true where id = $1`,
        [userId]
      );
    } else {
      await query(`update users set marketing_consent = false where id = $1`, [userId]);
    }
    return { ok: true };
  } catch (e) {
    if (e.code === "42703") {
      // marketing_opt_in non migrato: ripiega impostando solo il consenso.
      try {
        await query(`update users set marketing_consent = $1 where id = $2`, [Boolean(consent), userId]);
        return { ok: true };
      } catch (e2) {
        if (e2.code === "42703") return { ok: false, available: false };
        throw e2;
      }
    }
    throw e;
  }
}

// Disiscrizione tramite token (link nell'email). Ritorna true se trovato.
export async function unsubscribeByToken(token) {
  if (!token) return false;
  try {
    const { rowCount } = await query(
      `update users set marketing_consent = false where unsubscribe_token = $1`,
      [token]
    );
    return rowCount > 0;
  } catch (e) {
    if (e.code === "42703") return false;
    throw e;
  }
}
