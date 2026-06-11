// Registro attività admin: chi ha fatto cosa e quando.
// Tutto qui dentro è "difensivo": se la tabella non è ancora migrata
// (o c'è un problema), NON deve mai rompere l'azione principale dell'admin.
// Per questo logActivity ingoia i propri errori e non lancia mai.
import { query } from "../db/index.js";
import { OWNER_EMAIL } from "./auth.js";

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
      `select l.user_id, l.username, l.action, l.detail, l.created_at,
              lower(u.email) as email
         from admin_logs l
         left join users u on u.id = l.user_id
        order by l.created_at desc
        limit $1`,
      [n]
    );
    return rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      action: r.action,
      detail: r.detail,
      createdAt: r.created_at,
      // Serve al frontend per dare il colore "giallo riservato" al proprietario.
      isOwner: String(r.email || "") === OWNER_EMAIL,
    }));
  } catch (e) {
    if (e.code === "42P01") return [];
    throw e;
  }
}
