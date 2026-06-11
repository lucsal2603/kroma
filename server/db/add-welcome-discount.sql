-- =====================================================================
-- KROMA — Sconto di benvenuto per i nuovi iscritti
-- Da incollare ed eseguire una volta nel Supabase SQL Editor.
-- Idempotente: si può rilanciare senza errori.
-- =====================================================================

-- Segna se l'utente ha già usato il buono di benvenuto (vale UNA volta).
alter table users  add column if not exists welcome_used boolean not null default false;

-- Percentuale di sconto applicata all'ordine (0 = nessuno sconto).
alter table orders add column if not exists discount_percent integer not null default 0;
