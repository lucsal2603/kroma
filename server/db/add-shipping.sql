-- Aggiunge l'indirizzo di consegna agli ordini.
-- Da incollare nel SQL Editor di Supabase ed eseguire una sola volta.
-- È sicuro rieseguirlo: "if not exists" non crea doppioni.

alter table orders add column if not exists shipping jsonb;
