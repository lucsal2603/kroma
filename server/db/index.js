// Pool di connessione PostgreSQL condiviso.
// Funziona sia con Supabase sia con un Postgres locale/qualsiasi,
// tramite la variabile d'ambiente DATABASE_URL.
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL mancante. Copia server/.env.example in server/.env e inserisci la stringa di connessione."
  );
}

// Supabase (e molti host gestiti) richiedono SSL.
// In locale di solito no: si attiva con PGSSL=require oppure se l'URL è di Supabase.
const wantsSsl =
  process.env.PGSSL === "require" ||
  /supabase\.(co|com)/.test(connectionString) ||
  /sslmode=require/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: wantsSsl ? { rejectUnauthorized: false } : false,
});

// Helper comodo: query(text, params) -> rows
export const query = (text, params) => pool.query(text, params);
