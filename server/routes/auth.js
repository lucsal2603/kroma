// Rotte di autenticazione:
//   POST /register        -> crea utente, restituisce token
//   POST /login           -> verifica credenziali, restituisce token
//   GET  /user/profile    -> dati dell'utente loggato (richiede token)
import { Router } from "express";
import crypto from "node:crypto";
import { query } from "../db/index.js";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth.js";
import { sendMail } from "../lib/mailer.js";

const router = Router();

// URL del frontend per costruire il link di reset password.
const APP_URL = process.env.APP_URL || "https://lucsal2603.github.io/kroma";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 ora

// Campi pubblici dell'utente (mai esporre password_hash / reset_token)
const PUBLIC_USER = "id, username, email, is_admin, created_at";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- POST /register -------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    let { username, email, password } = req.body || {};

    username = (username || "").trim();
    email = (email || "").trim().toLowerCase();

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email e password sono obbligatori." });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: "Lo username deve avere almeno 3 caratteri." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email non valida." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "La password deve avere almeno 8 caratteri." });
    }

    const password_hash = await hashPassword(String(password));

    const { rows } = await query(
      `insert into users (username, email, password_hash)
       values ($1, $2, $3)
       returning ${PUBLIC_USER}`,
      [username, email, password_hash]
    );

    const user = rows[0];
    const token = signToken({ sub: user.id, username: user.username });

    return res.status(201).json({ user, token });
  } catch (err) {
    // 23505 = violazione vincolo unique (email o username già esistenti)
    if (err.code === "23505") {
      const field = /email/.test(err.detail || "") ? "email" : "username";
      return res.status(409).json({ error: `Questo ${field} è già registrato.` });
    }
    console.error("register error:", err);
    return res.status(500).json({ error: "Errore durante la registrazione." });
  }
});

// --- POST /login ----------------------------------------------------
// Accetta { email, password } oppure { username, password }.
router.post("/login", async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const identifier = (email || username || "").trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: "Credenziali mancanti." });
    }

    const { rows } = await query(
      `select id, username, email, is_admin, password_hash
         from users
        where lower(email) = $1 or lower(username) = $1
        limit 1`,
      [identifier]
    );

    const user = rows[0];
    // Messaggio volutamente generico (non rivelare se l'utente esiste)
    const invalid = () => res.status(401).json({ error: "Email o password non corretti." });

    if (!user) return invalid();

    const ok = await verifyPassword(String(password), user.password_hash);
    if (!ok) return invalid();

    const token = signToken({ sub: user.id, username: user.username });

    return res.json({
      user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      token,
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Errore durante il login." });
  }
});

// --- GET /user/profile ----------------------------------------------
router.get("/user/profile", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `select ${PUBLIC_USER} from users where id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Utente non trovato." });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error("profile error:", err);
    return res.status(500).json({ error: "Errore nel recupero del profilo." });
  }
});

// --- POST /forgot-password ------------------------------------------
// Genera un token temporaneo e invia (o logga in dev) il link di reset.
// Risposta sempre generica: non riveliamo se l'email esiste.
router.post("/forgot-password", async (req, res) => {
  const generic = { message: "Se l'email è registrata, riceverai un link per reimpostare la password." };
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email obbligatoria." });

    const { rows } = await query(
      `select id, username, email from users where lower(email) = $1 limit 1`,
      [email]
    );
    const user = rows[0];

    // Anche se l'utente non esiste, rispondiamo allo stesso modo.
    if (!user) return res.json(generic);

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await query(
      `update users set reset_token = $1, reset_token_expires = $2 where id = $3`,
      [token, expires, user.id]
    );

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "KROMA — reimposta la tua password",
      text: `Ciao ${user.username},\n\nhai richiesto di reimpostare la password.\nApri questo link (valido 1 ora):\n${resetUrl}\n\nSe non sei stato tu, ignora questa email.`,
      html: `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto;color:#111">
        <h2 style="margin:0 0 12px">Reimposta la password</h2>
        <p>Ciao <strong>${user.username}</strong>, hai richiesto di reimpostare la password del tuo account KROMA.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#1b1b1d;color:#d7ff3e;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Reimposta password</a>
        </p>
        <p style="color:#666;font-size:13px">Il link è valido <strong>1 ora</strong>. Se non sei stato tu, ignora questa email.</p>
      </div>`,
    });

    return res.json(generic);
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.status(500).json({ error: "Errore durante la richiesta di reset." });
  }
});

// --- POST /reset-password -------------------------------------------
// Riceve { token, password }: se il token è valido e non scaduto, cambia la password.
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "Token e nuova password sono obbligatori." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "La password deve avere almeno 8 caratteri." });
    }

    const { rows } = await query(
      `select id from users
        where reset_token = $1 and reset_token_expires > now()
        limit 1`,
      [token]
    );
    const user = rows[0];
    if (!user) {
      return res.status(400).json({ error: "Token non valido o scaduto. Richiedi un nuovo link." });
    }

    const password_hash = await hashPassword(String(password));
    await query(
      `update users
          set password_hash = $1, reset_token = null, reset_token_expires = null
        where id = $2`,
      [password_hash, user.id]
    );

    return res.json({ message: "Password aggiornata. Ora puoi accedere con la nuova password." });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ error: "Errore durante il reset della password." });
  }
});

export default router;
