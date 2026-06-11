-- =====================================================================
-- KROMA — setup completo del database (schema + seed)
-- Da incollare ed eseguire nel Supabase SQL Editor.
-- Idempotente: si può rilanciare senza errori.
-- =====================================================================

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
  is_admin            boolean     not null default false, -- true = accede alla dashboard ADMIN
  disabled            boolean     not null default false, -- true = account bloccato (non può accedere)
  welcome_used        boolean     not null default false, -- buono di benvenuto già usato
  marketing_consent   boolean     not null default false, -- consenso email pubblicitarie (opt-in)
  unsubscribe_token   text,                            -- token per il link "disiscriviti"
  reset_token         text,                            -- token recupero password
  reset_token_expires timestamptz,                     -- scadenza del token
  created_at          timestamptz not null default now()
);

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
  price         numeric(10,2) not null,                -- EUR (prezzo pieno)
  sale_price    numeric(10,2),                          -- EUR scontato (NULL = nessuno sconto)
  stock         integer     not null default 0,         -- giacenza disponibile
  img_url       text        not null,                  -- foto fronte
  img_back_url  text,                                  -- foto retro
  swatch        text,                                  -- colore pallino UI
  gallery       jsonb       not null default '[]'::jsonb, -- foto extra (animazione)
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
  total                    numeric(10,2) not null default 0,    -- EUR (già scontato)
  discount_percent         integer     not null default 0,      -- % sconto applicato (es. benvenuto)
  customer_email           text        not null,                -- email cliente (snapshot)
  shipping                 jsonb,                               -- indirizzo di consegna {name,address,zip,city,province,phone}
  stripe_payment_intent_id text,                                -- riferimento pagamento Stripe
  created_at               timestamptz not null default now()
);

create index if not exists idx_orders_user   on orders (user_id);
create index if not exists idx_orders_status on orders (status);

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

-- =====================================================================
-- CAMPAGNE EMAIL (marketing)
-- =====================================================================
create table if not exists marketing_config (
  id            boolean primary key default true check (id),
  interval_days integer     not null default 7,
  auto_enabled  boolean     not null default false,
  last_sent_at  timestamptz
);
insert into marketing_config (id) values (true) on conflict (id) do nothing;

create table if not exists marketing_sends (
  id         uuid        primary key default gen_random_uuid(),
  subject    text,
  recipients integer     not null default 0,
  trigger    text        not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists idx_users_unsub            on users (unsubscribe_token);
create index if not exists idx_marketing_sends_created on marketing_sends (created_at desc);

-- =====================================================================
-- REGISTRO ATTIVITÀ ADMIN (chi ha fatto cosa)
-- =====================================================================
create table if not exists admin_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references users(id) on delete set null,
  username   text,
  action     text        not null,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_logs_created on admin_logs (created_at desc);

-- =====================================================================
-- SEED — i tre caschi ARAI SZ-R EVO (allineati a src/data/products.js)
-- Idempotente: su conflitto di "code" aggiorna i campi.
-- =====================================================================
insert into products (code, name, brand, model, color, price, img_url, img_back_url, swatch, tag, best_seller, blurb, specs)
values
  (
    'SZ-02', 'Abisso', 'ARAI', 'SZ-R EVO', 'Frost Black', 720,
    'https://lucsal2603.github.io/kroma/img/sz-nero.png',
    'https://lucsal2603.github.io/kroma/img/sz-nero-retro.png',
    '#1b1b1d', '🦈 best seller', true,
    'Nero opaco assoluto. La finitura frost assorbe la luce come l''abisso a mille metri. Il più scelto dai rider KROMA.',
    '["Calotta PB-SNC2","Jet open-face · 1290 g","Visiera SAI lunga antigraffio"]'::jsonb
  ),
  (
    'SZ-01', 'Squalo', 'ARAI', 'SZ-R EVO', 'Modern Grey', 720,
    'https://lucsal2603.github.io/kroma/img/sz-grigio.png',
    'https://lucsal2603.github.io/kroma/img/sz-grigio-retro.png',
    '#71747a', '🌊 classico', false,
    'Grigio squalo, la nostra frequenza di casa. Profilo jet, visiera lunga, libertà a viso aperto.',
    '["Calotta PB-SNC2","Jet open-face · 1290 g","Visiera SAI lunga antigraffio"]'::jsonb
  ),
  (
    'SZ-03', 'Risacca', 'ARAI', 'SZ-R EVO', 'Glossy White', 720,
    'https://lucsal2603.github.io/kroma/img/sz-bianco.png',
    'https://lucsal2603.github.io/kroma/img/sz-bianco-retro.png',
    '#eceae6', '🏝️ estate', false,
    'Bianco lucido come schiuma d''onda. Leggero, ventilato, fatto per l''estate a viso aperto.',
    '["Calotta PB-SNC2","Jet open-face · 1290 g","Visiera SAI lunga antigraffio"]'::jsonb
  )
on conflict (code) do update set
  name         = excluded.name,
  brand        = excluded.brand,
  model        = excluded.model,
  color        = excluded.color,
  price        = excluded.price,
  img_url      = excluded.img_url,
  img_back_url = excluded.img_back_url,
  swatch       = excluded.swatch,
  tag          = excluded.tag,
  best_seller  = excluded.best_seller,
  blurb        = excluded.blurb,
  specs        = excluded.specs;

-- Verifica finale
select code, name, color, price, best_seller from products order by code;
