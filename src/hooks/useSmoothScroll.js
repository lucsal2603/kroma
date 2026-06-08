import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "../lib/gsap";

// Smooth scroll Lenis sincronizzato con ScrollTrigger (un solo loop di scroll).
export function useSmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const lenis = new Lenis({
      duration: 1.1,
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
    });

    lenis.on("scroll", ScrollTrigger.update);
    const onTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    // flash volt sulla sezione di destinazione, così "si vede" l'arrivo
    const flash = (el) => {
      el.classList.remove("kr-flash");
      void el.offsetWidth; // forza il reflow per riavviare l'animazione
      el.classList.add("kr-flash");
      window.setTimeout(() => el.classList.remove("kr-flash"), 1200);
    };

    // easing morbido in entrata/uscita: parte piano, accelera, frena dolcemente
    const easeInOut = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // ogni link interno (#...) scorre in modo animato fino al suo tag
    const onClick = (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const id = href.slice(1);
      const target = id === "top" ? document.body : document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(id === "top" ? 0 : target, {
        offset: id === "top" ? 0 : -80,
        duration: 1.6,
        easing: easeInOut,
      });
      if (id !== "top") flash(target);
    };
    document.addEventListener("click", onClick);

    // ricalcola le posizioni dei trigger dopo il primo paint / caricamento font
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    const t = setTimeout(refresh, 600);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
      document.removeEventListener("click", onClick);
      window.removeEventListener("load", refresh);
      clearTimeout(t);
    };
  }, []);
}
