-- KROMA e-commerce — schema database (PostgreSQL / Supabase)
-- Eseguibile con:  npm run db:migrate
-- Idempotente: si può rilanciare senza errori.

-- gen_random_uuid() per le chiavi primarie
create extension if not exists pgcrypto;

-- =====================================================================
-- UTENTI
-- =====================================================================
create table if not exists users (
  id                  uuid primary key default gen_random_uuid(),
  username            text        not null unique,
  email               text        not null unique,
  password_hash       text        not null,          -- bcrypt
  reset_token         text,                            -- token recupero password
  reset_token_expires timestamptz,                     -- scadenza del token
  created_at          timestamptz not null default now()
);

-- email salvata sempre in minuscolo: indice per ricerche veloci al login
create index if not exists idx_users_email        on users (lower(email));
create index if not exists idx_users_reset_token   on users (reset_token);

-- =====================================================================
-- PRODOTTI (i tre caschi ARAI SZ-R EVO)
-- =====================================================================
create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  code          text        not null unique,           -- SZ-01 / SZ-02 / SZ-03
  name          text        not null,                  -- Abisso / Squalo / Risacca
  brand         text        not null default 'ARAI',
  model         text        not null default 'SZ-R EVO',
  color         text        not null,
  price         numeric(10,2) not null,                -- EUR
  img_url       text        not null,                  -- foto fronte
  img_back_url  text,                                  -- foto retro
  swatch        text,                                  -- colore pallino UI
  tag           text,
  best_seller   boolean     not null default false,
  blurb         text,
  specs         jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- CARRELLO (lato server, per utente)
-- =====================================================================
create table if not exists cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references users(id)    on delete cascade,
  product_id  uuid        not null references products(id) on delete cascade,
  size        text        not null,                        -- XS / S / M / L / XL
  quantity    integer     not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  -- stesso prodotto + stessa taglia = una sola riga (si aggiorna la quantità)
  unique (user_id, product_id, size)
);

create index if not exists idx_cart_items_user on cart_items (user_id);

-- =====================================================================
-- ORDINI
-- =====================================================================
create table if not exists orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid        not null references users(id) on delete restrict,
  status                   text        not null default 'pending'
                             check (status in ('pending','paid','failed','shipped','cancelled')),
  total                    numeric(10,2) not null default 0,    -- EUR
  customer_email           text        not null,                -- email cliente (snapshot)
  stripe_payment_intent_id text,                                -- riferimento pagamento Stripe
  created_at               timestamptz not null default now()
);

create index if not exists idx_orders_user   on orders (user_id);
create index if not exists idx_orders_status on orders (status);

-- Righe d'ordine: un ordine può contenere più caschi (prodotto + taglia + quantità)
create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid        not null references orders(id)   on delete cascade,
  product_id  uuid        not null references products(id) on delete restrict,
  size        text        not null,
  quantity    integer     not null default 1 check (quantity > 0),
  unit_price  numeric(10,2) not null,                       -- prezzo bloccato al momento dell'ordine
  created_at  timestamptz not null default now()
);

create index if not exists idx_order_items_order on order_items (order_id);
