import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../lib/gsap";

const WORDS = ["CARBONIO", "🦈", "AERODINAMICA", "🏴‍☠️", "RACING", "🏝️", "KROMA"];

export default function Marquee() {
  const track = useRef(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      // loop infinito di base
      const loop = gsap.to(el, {
        xPercent: -50,
        repeat: -1,
        duration: 22,
        ease: "none",
      });
      // la velocità reagisce allo scroll
      let lastV = 1;
      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const v = 1 + Math.min(Math.abs(self.getVelocity() / 300), 6);
          if (v !== lastV) {
            lastV = v;
            loop.timeScale(self.direction < 0 ? -v : v);
          }
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  const row = (
    <div className="flex shrink-0 items-center gap-10 px-5">
      {WORDS.map((w, i) => (
        <span key={i} className="font-display text-bone/90 text-[clamp(2rem,6vw,4.5rem)] uppercase">
          {w}
        </span>
      ))}
    </div>
  );

  return (
    <section className="overflow-hidden border-y border-line py-8">
      <div ref={track} className="flex w-max will-change-transform">
        {row}
        {row}
      </div>
    </section>
  );
}
