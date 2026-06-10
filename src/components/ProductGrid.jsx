import { useReveal } from "../hooks/useReveal";
import { BRANDS, formatEuro } from "../data/products";
import { useCart } from "../store/cart";
import { useProducts } from "../store/products";
import HelmetFlip from "./HelmetFlip";

export default function ProductGrid() {
  const ref = useReveal({ stagger: 0.1, y: 60 });
  const { openProduct } = useCart();
  const { products } = useProducts();

  return (
    <section id="collezione" ref={ref} className="mx-auto max-w-[1400px] px-6 py-28 lg:px-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p data-reveal className="eyebrow mb-4">🏝️ La collezione · ARAI SZ-R EVO</p>
          <h2 data-reveal className="display text-bone text-[clamp(2.6rem,8vw,6rem)]">
            Tre pelli,<br />un solo predatore
          </h2>
        </div>
        <p data-reveal className="text-muted max-w-xs text-sm leading-relaxed">
          Un solo modello, l'Arai SZ-R EVO: jet a viso aperto, ingegneria
          giapponese da MotoGP. Tre colori. Scegli la tua frequenza. 🦈
        </p>
      </div>

      <div data-reveal className="mb-14 flex flex-wrap gap-2.5">
        {BRANDS.map((b) => (
          <span
            key={b.name}
            className={
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs tracking-[0.14em] uppercase transition-colors " +
              (b.active
                ? "border-volt/50 bg-volt/10 text-bone"
                : "border-line text-faint")
            }
          >
            {b.active && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-volt">
                <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {b.name}
            <span className="text-[0.6rem] opacity-60">· {b.note}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, i) => (
          <button
            key={p.code}
            data-reveal
            onClick={() => openProduct(p)}
            className={
              "group relative block overflow-hidden rounded-2xl border bg-elevated text-left transition-shadow " +
              (p.bestSeller
                ? "border-volt/70 ring-1 ring-volt/40 shadow-[0_0_36px_-8px_rgba(215,255,62,0.55)]"
                : "border-line")
            }
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-[#f4f4f3] to-[#d9d9d6]">
              <HelmetFlip
                front={p.img}
                back={p.imgBack}
                alt={`Casco ARAI ${p.model} ${p.color}`}
                interval={3600}
                offset={i * 1200}
                className="h-full w-full"
                imgClass="h-full w-full object-contain p-5 group-hover:scale-[1.08]"
              />
              <span className="absolute top-4 left-4 rounded-full bg-black/80 px-3 py-1 font-mono text-[0.62rem] font-bold tracking-[0.2em] text-bone uppercase">
                {p.brand}
              </span>
              <span className="absolute top-4 right-4 rounded-full bg-black/60 px-3 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-bone uppercase">
                {p.tag}
              </span>
              {p.bestSeller && (
                <span className="anim-pulse absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-volt px-3 py-1.5 font-mono text-[0.62rem] font-bold tracking-[0.14em] text-black uppercase shadow-lg">
                  🦈 #1 più acquistato
                </span>
              )}
            </div>
            <div className="flex items-center justify-between p-6">
              <div>
                <div className="eyebrow text-[0.6rem]">{p.model} · {p.color}</div>
                <div className="font-display mt-1 text-3xl text-bone">{p.name}</div>
              </div>
              <div className="text-right">
                <div className="text-muted font-mono text-xs">EUR</div>
                <div className="text-bone text-xl font-semibold">{formatEuro(p.price)}</div>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-volt transition-transform duration-500 ease-out group-hover:scale-x-100" />
          </button>
        ))}
      </div>
    </section>
  );
}
