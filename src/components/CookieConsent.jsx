import { useEffect, useState } from "react";

const KEY = "kroma-cookie-consent";

// Questo sito usa SOLO cookie tecnici essenziali (login, carrello, preferenze):
// per legge non servirebbe nemmeno il consenso. Mostriamo comunque un avviso
// informativo chiaro, con un solo pulsante "Ho capito".
export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  // Mostra l'avviso solo se l'utente non l'ha ancora chiuso.
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      saved = null;
    }
    if (!saved) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ seen: true, ts: Date.now() }));
    } catch {
      /* storage non disponibile: chiudiamo comunque */
    }
    setOpen(false);
  };

  const openPolicy = () =>
    window.dispatchEvent(new CustomEvent("kroma:open-policy", { detail: "cookie" }));

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-line bg-elevated/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md">
        <div className="flex flex-col gap-5 p-6 sm:p-7">
          <div>
            <p className="eyebrow mb-2 text-volt">
              <span className="anim-sway inline-block">🍪</span> Cookie
            </p>
            <p className="text-sm leading-relaxed text-bone/85">
              Usiamo solo cookie tecnici essenziali, necessari per far funzionare il sito
              (accesso, carrello e preferenze). Non usiamo cookie di profilazione, pubblicità
              o di terze parti.
            </p>

            <button
              type="button"
              onClick={openPolicy}
              className="mt-3 font-mono text-[0.7rem] tracking-[0.16em] text-muted uppercase underline-offset-4 transition-colors hover:text-bone hover:underline"
            >
              Leggi la Cookie Policy
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="anim-glow rounded-full bg-volt px-8 py-3 font-mono text-xs font-bold tracking-[0.16em] text-black uppercase transition-transform duration-300 hover:-translate-y-0.5"
            >
              Ho capito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
