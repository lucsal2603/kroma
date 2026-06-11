// Recensioni del sito: valutazione 1-5 stelle + commento facoltativo.
// Difensivo come il registro attività: se la tabella non è ancora migrata
// (codice 42P01) restituisce risultati vuoti invece di rompere il sito.
import { query } from "../db/index.js";

// Salva una recensione. Lancia (gestito dalla rotta) se la tabella manca.
export async function addReview({ userId, username, rating, comment }) {
  const { rows } = await query(
    `insert into site_reviews (user_id, username, rating, comment)
     values ($1, $2, $3, $4)
     returning id, user_id, username, rating, comment, created_at`,
    [userId || null, username || null, rating, comment || null]
  );
  return mapRow(rows[0]);
}

// Elenco recensioni (più recenti prima). [] se la tabella non è migrata.
export async function getReviews(limit = 200) {
  try {
    const n = Math.max(1, Math.min(500, Number(limit) || 200));
    const { rows } = await query(
      `select id, user_id, username, rating, comment, created_at
         from site_reviews
        order by created_at desc
        limit $1`,
      [n]
    );
    return rows.map(mapRow);
  } catch (e) {
    if (e.code === "42P01") return [];
    throw e;
  }
}

// Cancella una recensione. true se ne ha tolta una.
export async function deleteReview(id) {
  try {
    const { rowCount } = await query(`delete from site_reviews where id = $1`, [id]);
    return rowCount > 0;
  } catch (e) {
    if (e.code === "42P01") return false;
    throw e;
  }
}

function mapRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    username: r.username,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
  };
}
