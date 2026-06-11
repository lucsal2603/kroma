-- =====================================================================
-- KROMA — campagne email (consenso marketing + invii)
-- Da incollare ed eseguire UNA VOLTA nel Supabase SQL Editor.
-- Idempotente: si può rilanciare senza errori e senza toccare i dati.
-- =====================================================================

-- Consenso a ricevere email pubblicitarie (opt-in: default = no).
alter table users add column if not exists marketing_consent boolean not null default false;
-- Token segreto per il link "disiscriviti" (senza dover fare login).
alter table users add column if not exists unsubscribe_token text;
create index if not exists idx_users_unsub on users (unsubscribe_token);

-- Impostazioni della campagna (UNA sola riga grazie a id boolean = true).
create table if not exists marketing_config (
  id            boolean primary key default true check (id),
  interval_days integer     not null default 7,    -- ogni quanti giorni inviare
  auto_enabled  boolean     not null default false, -- invio automatico attivo?
  last_sent_at  timestamptz                          -- ultimo invio effettuato
);
insert into marketing_config (id) values (true) on conflict (id) do nothing;

-- Storico degli invii (per mostrarlo nell'admin).
create table if not exists marketing_sends (
  id         uuid        primary key default gen_random_uuid(),
  subject    text,
  recipients integer     not null default 0,         -- a quanti è stata inviata
  trigger    text        not null default 'manual',  -- 'manual' | 'auto'
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_sends_created on marketing_sends (created_at desc);
