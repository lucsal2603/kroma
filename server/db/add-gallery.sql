-- =====================================================================
-- KROMA — galleria immagini prodotti
-- Aggiunge la colonna "gallery": elenco di foto (data URL) che ruotano in
-- automatico nella scheda e nella griglia, come l'animazione dei caschi.
-- Idempotente: si può rilanciare senza errori.
-- =====================================================================
alter table products add column if not exists gallery jsonb not null default '[]'::jsonb;
