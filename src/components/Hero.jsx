import { useEffect, useRef, useState } from "react";
import { gsap } from "../lib/gsap";
import HelmetReveal from "./HelmetReveal";
import { asset } from "../lib/asset";

export default function Hero() {
  const root = useRef(null);
  // Sotto i 1011px l'effetto "lente" col mouse non ha senso (touch / schermo piccolo):
  // mostriamo l'immagine del rider come sfondo statico.
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1011px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".hero-line span", { yPercent: 120, duration: 1.1, stagger: 0.12 })
        .from(".hero-eyebrow", { opacity: 0, y: 16, duration: 0.8 }, "-=0.7")
        .from(".hero-copy", { opacity: 0, y: 20, duration: 0.8 }, "-=0.6")
        .from(".hero-cta > *", { opacity: 0, y: 18, stagger: 0.1, duration: 0.7 }, "-=0.6")
        .from(".hero-hint", { opacity: 0, duration: 0.8 }, "-=0.5");
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="relative h-svh min-h-[620px] w-full overflow-hidden">
      {compact ? (
        // Versione ferma: il casco già indossato (faccia + casco d'oro sopra), senza reveal interattivo.
        <div className="absolute inset-0" role="img" aria-label="Modello con casco KROMA">
          <img
            src={asset("/img/sottocasco.png")}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
          <img
            src={asset("/img/casco-oro.png")}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>
      ) : (
        <HelmetReveal fill hideHint />
      )}

      {/* scrim: scurisce alto (nav) e basso (titolo), lascia libero il volto al centro */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(8,8,10,.72) 0%, rgba(8,8,10,0) 24%, rgba(8,8,10,0) 42%, rgba(8,8,10,.55) 72%, rgba(8,8,10,.92) 100%)",
        }}
      />

      {!compact && (
        <span className="hero-hint anim-float pointer-events-none absolute top-24 right-6 z-20 rounded-full bg-black/40 px-4 py-2 font-mono text-[0.7rem] tracking-[0.16em] text-bone/80 uppercase backdrop-blur-sm transition-opacity duration-300 lg:right-10">
          <span className="anim-sway">🦈</span> Muovi il mouse
        </span>
      )}

      {compact ? (
        <>
          {/* Eyebrow: appena sopra la visiera */}
          <div className="pointer-events-none absolute inset-x-0 top-[24%] z-20 px-6 text-center">
            <p className="hero-eyebrow font-display text-[0.8rem] tracking-[0.3em] text-volt uppercase [text-shadow:0_1px_10px_rgba(0,0,0,.7)]">
              <span className="anim-sway">🦈</span> Caschi da abisso · ARAI
            </p>
          </div>

          {/* Titolo: parole attaccate, lettere stirate in altezza per riempire la visiera */}
          <div className="pointer-events-none absolute inset-x-0 top-[31%] bottom-[38%] z-20 flex items-center justify-center px-6 text-center">
            <h1 className="display origin-center scale-y-[1.9] text-bone text-[clamp(2.6rem,13vw,4.6rem)] leading-[0.82] [text-shadow:0_2px_28px_rgba(0,0,0,.85)]">
              <span className="hero-line block overflow-hidden"><span className="block">Proteggi</span></span>
              <span className="hero-line block overflow-hidden"><span className="block text-volt">l'istinto</span></span>
              <span className="hero-line block overflow-hidden"><span className="block">selvaggio</span></span>
            </h1>
          </div>

          {/* Copy + bottoni in basso */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-6 pb-10 text-center">
            <div className="mx-auto max-w-sm">
              <p className="hero-copy rounded-xl bg-black/45 px-4 py-3 text-sm leading-relaxed text-bone/90 backdrop-blur-md">
                KROMA porta i caschi ARAI: spariscono quando li indossi e dominano
                quando li guardi. Ingegneria da MotoGP, zero compromessi. 🦈
              </p>
              <div className="hero-cta mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#collezione"
                  className="anim-glow pointer-events-auto rounded-full bg-volt px-7 py-3.5 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5"
                >
                  Scopri la collezione
                </a>
                <a
                  href="#tech"
                  className="anim-border pointer-events-auto rounded-full border border-bone/30 bg-black/30 px-7 py-3.5 font-mono text-sm tracking-wider text-bone uppercase backdrop-blur-sm transition-colors duration-300 hover:border-bone/60"
                >
                  La tecnologia
                </a>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="mx-auto max-w-[1400px] px-6 pb-10 lg:px-10 lg:pb-16">
            <p className="hero-eyebrow mb-5 font-display text-base tracking-[0.4em] text-volt uppercase"><span className="anim-sway">🦈</span> Caschi da abisso · ARAI</p>

            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <h1 className="display text-bone text-[clamp(2.8rem,9vw,7.5rem)]">
                <span className="hero-line block overflow-hidden">
                  <span className="block">Proteggi</span>
                </span>
                <span className="hero-line block overflow-hidden">
                  <span className="block text-volt">l'istinto</span>
                </span>
                <span className="hero-line block overflow-hidden">
                  <span className="block">selvaggio</span>
                </span>
              </h1>

              <div className="max-w-sm lg:pb-3">
                <p className="hero-copy rounded-xl bg-black/45 px-4 py-3 text-sm leading-relaxed text-bone/90 backdrop-blur-md">
                  KROMA porta i caschi ARAI: spariscono quando li indossi e dominano
                  quando li guardi. Ingegneria da MotoGP, zero compromessi. 🦈
                </p>
                <div className="hero-cta mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href="#collezione"
                    className="anim-glow pointer-events-auto rounded-full bg-volt px-7 py-3.5 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    Scopri la collezione
                  </a>
                  <a
                    href="#tech"
                    className="anim-border pointer-events-auto rounded-full border border-bone/30 bg-black/30 px-7 py-3.5 font-mono text-sm tracking-wider text-bone uppercase backdrop-blur-sm transition-colors duration-300 hover:border-bone/60"
                  >
                    La tecnologia
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
