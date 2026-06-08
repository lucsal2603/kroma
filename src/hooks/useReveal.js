import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../lib/gsap";

// Reveal on enter: anima i figli con [data-reveal] (y + opacity) quando la
// sezione entra nel viewport. Rispetta prefers-reduced-motion e pulisce.
export function useReveal({ stagger = 0.12, y = 40 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray("[data-reveal]", el);
      gsap.from(items, {
        y,
        opacity: 0,
        duration: 1,
        ease: "expo.out",
        stagger,
        scrollTrigger: {
          trigger: el,
          start: "top 78%",
        },
      });
    }, el);

    return () => ctx.revert();
  }, [stagger, y]);

  return ref;
}
