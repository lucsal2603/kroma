-- =====================================================================
-- KROMA — Recensioni del sito (valutazione 1-5 + commento)
-- Da incollare ed eseguire nel Supabase SQL Editor. Idempotente.
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists site_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  username    text,
  rating      int  not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists site_reviews_created_idx on site_reviews (created_at desc);
