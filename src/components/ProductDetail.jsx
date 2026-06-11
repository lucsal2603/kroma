import { useEffect, useRef, useState } from "react";
import { gsap } from "../lib/gsap";
import { SIZES, formatEuro, hasSale, effectivePrice, salePercent } from "../data/products";
import { useCart } from "../store/cart";
import { useProducts } from "../store/products";
import HelmetFlip from "./HelmetFlip";

export default function ProductDetail() {
  const { product, closeProduct, add } = useCart();
  const { products } = useProducts();
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
  // Le varianti colore esistono solo per i caschi (stesso "model"). I prodotti
  // generici aggiunti dall'admin hanno model vuoto: niente raggruppamento.
  const colors = v.model ? products.filter((p) => p.model === v.model) : [];
  const meta = [v.brand, v.model, v.color].filter(Boolean).join(" · ");

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

        <div className="relative h-[46vh] w-full overflow-hidden bg-gradient-to-b from-[#f4f4f3] to-[#cfcfcb] md:h-auto">
          <HelmetFlip
            key={v.code}
            front={v.img}
            back={v.imgBack}
            images={v.gallery}
            alt={[v.brand, v.model, v.color, v.name].filter(Boolean).join(" ")}
            controls
            interval={3200}
            className="absolute inset-0 h-full w-full"
            imgClass="h-full w-full object-contain p-3 sm:p-6"
          />
          {v.bestSeller && (
            <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 font-mono text-[0.56rem] font-bold tracking-[0.14em] text-volt uppercase backdrop-blur-sm">
              🦈 #1 più acquistato
            </span>
          )}
        </div>

        <div className="flex flex-col gap-5 px-6 pb-6 pt-9 sm:gap-6 sm:p-8 md:min-h-0 md:overflow-y-auto">
          <div>
            <div className="eyebrow text-[0.6rem]">{meta}</div>
            <h2 className="font-display mt-2 text-5xl text-bone">{v.name}</h2>
            <div className="text-muted mt-1 font-mono text-xs">{v.code}</div>
          </div>

          <p className="text-muted text-sm leading-relaxed">{v.blurb}</p>

          {colors.length > 1 && (
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
          )}

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
              {hasSale(v) ? (
                <div className="flex items-baseline gap-2.5">
                  <span className="text-faint font-mono text-base line-through">{formatEuro(v.price)}</span>
                  <span className="text-volt text-2xl font-bold">{formatEuro(effectivePrice(v))}</span>
                  <span className="rounded-full bg-red-500 px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-wider text-white uppercase">
                    −{salePercent(v)}%
                  </span>
                </div>
              ) : (
                <div className="text-bone text-2xl font-semibold">{formatEuro(v.price)}</div>
              )}
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
