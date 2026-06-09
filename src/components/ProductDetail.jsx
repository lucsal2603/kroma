import { useEffect, useRef, useState } from "react";
import { gsap } from "../lib/gsap";
import { PRODUCTS, SIZES, formatEuro } from "../data/products";
import { useCart } from "../store/cart";
import HelmetFlip from "./HelmetFlip";

export default function ProductDetail() {
  const { product, closeProduct, add } = useCart();
  const [size, setSize] = useState("M");
  const [variant, setVariant] = useState(null);
  const panel = useRef(null);
  const backdrop = useRef(null);

  useEffect(() => {
    if (!product) return;
    setSize("M");
    setVariant(product);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onKey = (e) => e.key === "Escape" && closeProduct();
    window.addEventListener("keydown", onKey);

    // blocca lo scroll dello sfondo mentre il modale è aperto
    window.__lenis?.stop();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let ctx;
    if (!reduce) {
      ctx = gsap.context(() => {
        gsap.from(backdrop.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
        gsap.from(panel.current, { yPercent: 4, opacity: 0, duration: 0.5, ease: "expo.out" });
      });
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      ctx?.revert();
      window.__lenis?.start();
      document.body.style.overflow = prevOverflow;
    };
  }, [product, closeProduct]);

  if (!product) return null;

  const v = variant || product;
  const colors = PRODUCTS.filter((p) => p.model === v.model);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
      <div
        ref={backdrop}
        onClick={closeProduct}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panel}
        data-lenis-prevent
        className="relative grid max-h-[90vh] w-full max-w-4xl grid-cols-1 overflow-y-auto overscroll-contain rounded-3xl border border-line bg-elevated md:grid-cols-2 md:overflow-hidden"
      >
        <button
          onClick={closeProduct}
          aria-label="Chiudi"
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-black/40 text-bone transition-colors hover:border-bone/40"
        >
          ✕
        </button>

        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-[#f4f4f3] to-[#cfcfcb] md:aspect-auto">
          <HelmetFlip
            key={v.code}
            front={v.img}
            back={v.imgBack}
            alt={`Casco ARAI ${v.model} ${v.color}`}
            controls
            interval={3200}
            className="absolute inset-0 h-full w-full"
            imgClass="h-full w-full object-contain p-6"
          />
          {v.bestSeller && (
            <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 font-mono text-[0.56rem] font-bold tracking-[0.14em] text-volt uppercase backdrop-blur-sm">
              🦈 #1 più acquistato
            </span>
          )}
        </div>

        <div className="flex flex-col gap-6 p-8 md:min-h-0 md:overflow-y-auto">
          <div>
            <div className="eyebrow text-[0.6rem]">{v.brand} · {v.model} · {v.color}</div>
            <h2 className="font-display mt-2 text-5xl text-bone">{v.name}</h2>
            <div className="text-muted mt-1 font-mono text-xs">{v.code}</div>
          </div>

          <p className="text-muted text-sm leading-relaxed">{v.blurb}</p>

          <ul className="flex flex-col gap-2 border-y border-line py-5">
            {v.specs.map((s) => (
              <li key={s} className="flex items-center gap-3 text-sm text-bone/85">
                <span className="text-volt">▸</span> {s}
              </li>
            ))}
          </ul>

          <div>
            <div className="eyebrow mb-3 text-[0.6rem]">Colore · {v.color}</div>
            <div className="flex gap-3">
              {colors.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setVariant(c)}
                  aria-label={c.color}
                  title={c.color}
                  className={
                    "h-9 w-9 rounded-full border-2 transition-transform duration-200 hover:scale-110 " +
                    (v.code === c.code ? "border-volt scale-110" : "border-line")
                  }
                  style={{ backgroundColor: c.swatch }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="eyebrow mb-3 text-[0.6rem]">Taglia</div>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={
                    "h-11 w-11 rounded-full border font-mono text-xs transition-colors " +
                    (size === s
                      ? "border-volt bg-volt text-black"
                      : "border-line text-bone hover:border-bone/40")
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-4 pt-2">
            <div>
              <div className="text-muted font-mono text-xs">EUR</div>
              <div className="text-bone text-2xl font-semibold">{formatEuro(v.price)}</div>
            </div>
            <button
              onClick={() => add(v, size)}
              className="rounded-full bg-volt px-8 py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5"
            >
              🦈 Aggiungi al carrello
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
