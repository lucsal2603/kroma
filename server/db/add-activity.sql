-- =====================================================================
-- KROMA — registro attività admin (chi ha fatto cosa)
-- Da incollare ed eseguire UNA VOLTA nel Supabase SQL Editor.
-- Idempotente: si può rilanciare senza errori e senza toccare i dati.
-- =====================================================================

create table if not exists admin_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references users(id) on delete set null, -- chi (null se utente eliminato)
  username   text,                                                -- nome admin (copia, resta anche dopo)
  action     text        not null,                                -- es. product.create, login, discount.set
  detail     text,                                                -- es. nome prodotto / dettaglio
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_logs_created on admin_logs (created_at desc);
