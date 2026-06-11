// Catalogo condiviso tra griglia, scheda prodotto e carrello.
// KROMA è il negozio: ARAI è la prima marca a catalogo. C'è un solo modello
// — l'Arai SZ-R EVO (jet/open-face) — disponibile in tre colori reali.
import { asset } from "../lib/asset";

export const BRAND = "ARAI";

export const BRANDS = [
  { name: "ARAI", note: "Disponibile", active: true },
  { name: "Shoei", note: "In arrivo", active: false },
  { name: "AGV", note: "In arrivo", active: false },
  { name: "HJC", note: "In arrivo", active: false },
];

const SPECS = ["Calotta PB-SNC2", "Jet open-face · 1290 g", "Visiera SAI lunga antigraffio"];

export const PRODUCTS = [
  {
    code: "SZ-02", brand: "ARAI", model: "SZ-R EVO", name: "Abisso", color: "Frost Black",
    price: 720, img: asset("/img/sz-nero.png"), imgBack: asset("/img/sz-nero-retro.png"), swatch: "#1b1b1d",
    tag: "🦈 best seller", bestSeller: true,
    blurb: "Nero opaco assoluto. La finitura frost assorbe la luce come l'abisso a mille metri. Il più scelto dai rider KROMA.",
    specs: SPECS,
  },
  {
    code: "SZ-01", brand: "ARAI", model: "SZ-R EVO", name: "Squalo", color: "Modern Grey",
    price: 720, img: asset("/img/sz-grigio.png"), imgBack: asset("/img/sz-grigio-retro.png"), swatch: "#71747a",
    tag: "🌊 classico",
    blurb: "Grigio squalo, la nostra frequenza di casa. Profilo jet, visiera lunga, libertà a viso aperto.",
    specs: SPECS,
  },
  {
    code: "SZ-03", brand: "ARAI", model: "SZ-R EVO", name: "Risacca", color: "Glossy White",
    price: 720, img: asset("/img/sz-bianco.png"), imgBack: asset("/img/sz-bianco-retro.png"), swatch: "#eceae6",
    tag: "🏝️ estate",
    blurb: "Bianco lucido come schiuma d'onda. Leggero, ventilato, fatto per l'estate a viso aperto.",
    specs: SPECS,
  },
];

export const SIZES = ["XS", "S", "M", "L", "XL"];

export const formatEuro = (n) =>
  new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0 }).format(n);

// Prezzo effettivo: usa lo scontato (salePrice) solo se valido e più basso del
// prezzo pieno. Speculare alla logica del server (effectivePrice in discount.js).
export const effectivePrice = (p) => {
  const full = Number(p?.price);
  const sale = Number(p?.salePrice);
  return Number.isFinite(sale) && sale > 0 && sale < full ? sale : full;
};

// true se il prodotto ha uno sconto attivo (prezzo scontato < prezzo pieno).
export const hasSale = (p) => effectivePrice(p) < Number(p?.price);

// Percentuale di sconto arrotondata (es. 25 per "−25%"). 0 se nessuno sconto.
export const salePercent = (p) =>
  hasSale(p) ? Math.round((1 - effectivePrice(p) / Number(p.price)) * 100) : 0;
