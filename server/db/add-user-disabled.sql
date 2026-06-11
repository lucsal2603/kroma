-- =====================================================================
-- KROMA — disabilitazione account utente
-- Da incollare ed eseguire UNA VOLTA nel Supabase SQL Editor.
-- Idempotente: si può rilanciare senza errori e senza toccare i dati.
-- =====================================================================

-- Account disabilitato: se true, l'utente non può più accedere (login).
alter table users add column if not exists disabled boolean not null default false;
