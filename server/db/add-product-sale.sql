-- =====================================================================
-- KROMA — sconto sul singolo prodotto (prezzo scontato)
-- Da incollare ed eseguire UNA VOLTA nel Supabase SQL Editor.
-- Idempotente: si può rilanciare senza errori.
-- =====================================================================
-- sale_price = prezzo scontato in EUR. NULL (o >= price) = nessuno sconto.
-- Il prezzo pieno resta in `price`: nel negozio si mostra barrato accanto
-- a quello scontato in risalto.
alter table products add column if not exists sale_price numeric(10,2);
