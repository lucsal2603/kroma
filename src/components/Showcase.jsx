import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../lib/gsap";
import { asset } from "../lib/asset";

const SPECS = [
  ["01", "Sistema VAS", "Variable Axis System: il perno della visiera è ribassato e arretrato. Calotta più liscia e uniforme, campo visivo più ampio. 🦈"],
  ["02", "Calotta PB-cLc²", "Costruzione Arai in fibre laminate Super Fiber. Forma rotonda \"glancing off\" pensata per far scivolare via gli impatti."],
  ["03", "Visiera SAI · Pinlock", "Visiera lunga SAI predisposta Pinlock antiappannamento, ventilazione anteriore e diffusore posteriore. Interni estraibili e lavabili. 🏝️"],
];

export default function Showcase() {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      // parallax sul casco mentre la sezione scorre
      gsap.to(".showcase-visual", {
        yPercent: -14,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap.to(".showcase-glow", {
        scale: 1.25,
        opacity: 0.9,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "center center", scrub: true },
      });
      // le spec partono "spente" e si accendono solo quando arrivi lì con lo scroll
      // (si rispengono se torni indietro)
      gsap.utils.toArray(".spec-row", el).forEach((rowEl) => {
        gsap.fromTo(
          rowEl,
          { opacity: 0.15, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "expo.out",
            scrollTrigger: {
              trigger: rowEl,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section id="tech" ref={root} className="relative overflow-hidden bg-surface py-28">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10">
        {/* Titolo — su mobile sopra l'immagine e centrato */}
        <div className="text-center lg:col-start-2 lg:row-start-1 lg:text-left">
          <p className="eyebrow mb-5">🏴‍☠️ Ingegneria</p>
          <h2 className="display text-bone text-[clamp(2.4rem,6vw,4.5rem)]">
            Costruito per<br />l'estremo
          </h2>
        </div>

        {/* Immagine */}
        <div className="relative flex items-center justify-center lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <div className="showcase-glow anim-breathe absolute h-72 w-72 rounded-full bg-volt/25 blur-3xl" />
          <div className="showcase-visual relative aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl border border-line bg-ink">
            <img
              src={asset("/img/rider.jpg")}
              alt="Rider con casco Arai SZ-R EVO in città"
              className="h-full w-full object-cover object-[28%_30%]"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
            <span className="absolute bottom-5 left-5 rounded-full bg-black/55 px-4 py-2 font-mono text-[0.62rem] tracking-[0.18em] text-bone uppercase backdrop-blur-sm">
              🦈 SZ-R EVO · Frost Black
            </span>
          </div>
        </div>

        {/* I tre paragrafi — su mobile sotto l'immagine e centrati */}
        <div className="flex flex-col gap-10 lg:col-start-2 lg:row-start-2">
          {SPECS.map(([n, title, copy]) => (
            <div
              key={n}
              className="spec-row flex gap-6 border-t border-line pt-6 text-left"
            >
              <span className={"font-display anim-shimmer text-3xl leading-none anim-d" + (Number(n))}>{n}</span>
              <div>
                <h3 className="text-bone mb-2 text-xl font-semibold">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
