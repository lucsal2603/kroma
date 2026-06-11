import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../lib/gsap";
import { useAuth } from "../store/auth";
import { api } from "../lib/api";
import { welcomeState, formatCountdown } from "../lib/welcome";
import Logo from "./Logo";

// Pop-up che appare dopo la registrazione: mostra il buono di benvenuto
// (percentuale + conto alla rovescia). L'importo reale è comunque applicato
// e forzato dal server al momento dell'ordine.
export default function WelcomeOffer() {
  const { user, showWelcome, dismissWelcome } = useAuth();
  const [config, setConfig] = useState(null);
  const [now, setNow] = useState(Date.now());
  const panel = useRef(null);
  const backdrop = useRef(null);

  // Recupera la configurazione dello sconto (percentuale + durata) dal server.
  useEffect(() => {
    if (!showWelcome) return;
    let active = true;
    (async () => {
      try {
        const cfg = await api.getWelcomeConfig();
        if (active) setConfig(cfg);
      } catch {
        /* se non riusciamo a leggere la config, non mostriamo nulla */
      }
    })();
    return () => {
      active = false;
    };
  }, [showWelcome]);

  // Animazione d'ingresso + chiusura con ESC.
  useEffect(() => {
    if (!showWelcome) return;
    const onKey = (e) => e.key === "Escape" && dismissWelcome();
    window.addEventListener("keydown", onKey);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ctx;
    if (!reduce) {
      ctx = gsap.context(() => {
        gsap.from(backdrop.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
        gsap.from(panel.current, { yPercent: 6, opacity: 0, scale: 0.96, duration: 0.55, ease: "expo.out" });
      });
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      ctx?.revert();
    };
  }, [showWelcome, dismissWelcome]);

  // Aggiorna il conto alla rovescia ogni secondo finché il pop-up è aperto.
  useEffect(() => {
    if (!showWelcome) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showWelcome]);

  if (!showWelcome) return null;

  const state = welcomeState(user, config);
  // Se l'utente non è idoneo (o config non pronta) non mostriamo il pop-up.
  if (!state.eligible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-4">
      <div
        ref={backdrop}
        onClick={dismissWelcome}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />
      <div
        ref={panel}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-volt/40 bg-elevated p-8 text-center"
      >
        {/* alone luminoso decorativo */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-volt/20 blur-3xl" />

        <button
          onClick={dismissWelcome}
          aria-label="Chiudi"
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
        >
          ✕
        </button>

        <div className="relative flex flex-col items-center">
          <Logo markClass="h-9 w-9" textClass="text-xl" />

          <p className="text-muted mt-6 font-mono text-[0.7rem] tracking-[0.22em] uppercase">
            Benvenuto in KROMA 🦈
          </p>

          <div className="my-4 flex items-baseline justify-center gap-2">
            <span className="font-display text-7xl leading-none text-volt">
              {state.percent}%
            </span>
            <span className="font-display text-2xl tracking-[0.1em] text-bone">
              di sconto
            </span>
          </div>

          <p className="text-bone/90 max-w-xs text-sm leading-relaxed">
            Un buono di benvenuto sul tuo <strong>primo ordine</strong>.
            Si applica da solo al pagamento — non devi inserire nessun codice.
          </p>

          {/* conto alla rovescia */}
          <div className="mt-6 w-full rounded-2xl border border-line bg-ink px-5 py-4">
            <p className="text-muted font-mono text-[0.6rem] tracking-[0.2em] uppercase">
              Scade tra
            </p>
            <p className="mt-1 font-mono text-3xl tracking-[0.12em] text-volt tabular-nums">
              {formatCountdown(state.msLeft)}
            </p>
          </div>

          <button
            onClick={dismissWelcome}
            className="anim-glow mt-6 w-full rounded-full bg-volt py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5"
          >
            Inizia a fare shopping
          </button>

          <p className="text-faint mt-4 font-mono text-[0.56rem] tracking-wider uppercase">
            Valido una sola volta · primo ordine
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
