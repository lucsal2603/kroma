// Registro attività admin: chi ha fatto cosa e quando.
// Tutto qui dentro è "difensivo": se la tabella non è ancora migrata
// (o c'è un problema), NON deve mai rompere l'azione principale dell'admin.
// Per questo logActivity ingoia i propri errori e non lancia mai.
import { query } from "../db/index.js";

// Salva una riga nel registro. Fire-and-forget: gli errori vengono solo loggati.
export async function logActivity({ userId, username, action, detail = null }) {
  try {
    await query(
      `insert into admin_logs (user_id, username, action, detail)
       values ($1, $2, $3, $4)`,
      [userId || null, username || null, action, detail]
    );
  } catch (e) {
    // 42P01 = tabella non migrata. Qualsiasi altro errore: non bloccare l'admin.
    if (e.code !== "42P01") console.error("activity log error:", e.message);
  }
}

// Ultime righe del registro (per la dashboard). Difensivo: [] se non migrato.
export async function getActivity(limit = 100) {
  try {
    const n = Math.max(1, Math.min(500, Number(limit) || 100));
    const { rows } = await query(
      `select user_id, username, action, detail, created_at
         from admin_logs
        order by created_at desc
        limit $1`,
      [n]
    );
    return rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      action: r.action,
      detail: r.detail,
      createdAt: r.created_at,
    }));
  } catch (e) {
    if (e.code === "42P01") return [];
    throw e;
  }
}
