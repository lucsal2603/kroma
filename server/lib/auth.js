// Helper di autenticazione: hashing password (bcrypt) e token JWT.
import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db/index.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// "Proprietario" del sito: l'unico che può disabilitare account e togliere/dare
// i permessi admin. Configurabile da env, con un default sicuro.
export const OWNER_EMAIL = (process.env.OWNER_EMAIL || "lukesalvemini@gmail.com").toLowerCase();

// Dato l'id di un utente, dice se è il proprietario (confronto sull'email).
export async function isOwner(userId) {
  try {
    const { rows } = await query(`select email from users where id = $1`, [userId]);
    return String(rows[0]?.email || "").toLowerCase() === OWNER_EMAIL;
  } catch {
    return false;
  }
}

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET mancante in server/.env (generalo con: openssl rand -hex 32).");
}

// --- Password -------------------------------------------------------
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// --- Token ----------------------------------------------------------
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// --- Middleware: richiede un token valido nell'header Authorization --
//   Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Token mancante. Effettua il login." });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: "Token non valido o scaduto." });
  }
}

// --- Middleware: richiede un utente ADMIN (usare DOPO requireAuth) ----
export async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query(`select is_admin from users where id = $1`, [req.user.id]);
    if (!rows[0]?.is_admin) {
      return res.status(403).json({ error: "Accesso riservato all'amministratore." });
    }
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ error: "Errore di autorizzazione." });
  }
}

// --- Middleware: SOLO il proprietario (usare DOPO requireAuth) --------
// Per le azioni più delicate: disabilitare account, togliere/dare admin.
export async function requireOwner(req, res, next) {
  try {
    if (!(await isOwner(req.user.id))) {
      return res.status(403).json({ error: "Solo il proprietario del sito può fare questa operazione." });
    }
    next();
  } catch (err) {
    console.error("requireOwner error:", err);
    return res.status(500).json({ error: "Errore di autorizzazione." });
  }
}
