-- Seed dei tre caschi ARAI SZ-R EVO (allineati al frontend src/data/products.js)
-- Idempotente: su conflitto di "code" aggiorna i campi.
-- Le immagini puntano alla versione live su GitHub Pages.

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
