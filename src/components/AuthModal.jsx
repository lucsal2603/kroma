import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../lib/gsap";
import Logo from "./Logo";

// Pannello di accesso / registrazione — solo frontend per ora.
// L'invio non è ancora collegato ad alcun backend (autenticazione in arrivo).
export default function AuthModal({ open, onClose }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const panel = useRef(null);
  const backdrop = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    };
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = (e) => {
    e.preventDefault();
    // Backend in arrivo: per ora non viene eseguita alcuna autenticazione reale.
  };

  const isLogin = mode === "login";

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div
        ref={backdrop}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panel}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-elevated p-8"
      >
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
        >
          ✕
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <Logo markClass="h-10 w-10" textClass="text-2xl" />
          <h2 className="mt-4 font-display text-3xl tracking-[0.1em] text-bone">
            {isLogin ? "Bentornato" : "Unisciti a KROMA"}
          </h2>
          <p className="text-muted mt-1 text-sm">
            {isLogin
              ? "Accedi al tuo account 🦈"
              : "Crea il tuo account in pochi secondi 🏝️"}
          </p>
        </div>

        {/* switch login / registrazione */}
        <div className="mb-6 flex rounded-full border border-line p-1 font-mono text-xs tracking-[0.16em] uppercase">
          <button
            onClick={() => setMode("login")}
            className={
              "flex-1 rounded-full py-2.5 transition-colors " +
              (isLogin ? "bg-volt text-black" : "text-muted hover:text-bone")
            }
          >
            Accedi
          </button>
          <button
            onClick={() => setMode("register")}
            className={
              "flex-1 rounded-full py-2.5 transition-colors " +
              (!isLogin ? "bg-volt text-black" : "text-muted hover:text-bone")
            }
          >
            Registrati
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {!isLogin && (
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              aria-label="Nome"
              className="rounded-full border border-line bg-ink px-6 py-3.5 font-mono text-sm text-bone placeholder:text-faint transition-colors duration-300 focus:border-volt/60 focus:outline-none"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="la-tua@email.com"
            aria-label="Email"
            autoComplete="email"
            className="rounded-full border border-line bg-ink px-6 py-3.5 font-mono text-sm text-bone placeholder:text-faint transition-colors duration-300 focus:border-volt/60 focus:outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="rounded-full border border-line bg-ink px-6 py-3.5 font-mono text-sm text-bone placeholder:text-faint transition-colors duration-300 focus:border-volt/60 focus:outline-none"
          />

          {isLogin && (
            <button
              type="button"
              className="self-end font-mono text-[0.68rem] tracking-wider text-muted uppercase transition-colors hover:text-bone"
            >
              Password dimenticata?
            </button>
          )}

          <button
            type="submit"
            className="anim-glow mt-2 rounded-full bg-volt py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5"
          >
            {isLogin ? "Accedi" : "Crea account"}
          </button>
        </form>

        <p className="text-faint mt-5 text-center font-mono text-[0.58rem] tracking-wider uppercase">
          🦈 Autenticazione in arrivo
        </p>
      </div>
    </div>,
    document.body
  );
}
