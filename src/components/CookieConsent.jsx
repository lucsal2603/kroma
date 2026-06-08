import { useEffect, useState } from "react";

const KEY = "kroma-cookie-consent";

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);

  // Mostra il banner solo se l'utente non ha ancora scelto.
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

  const choose = (value) => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ choice: value, ts: Date.now() })
      );
    } catch {
      /* storage non disponibile: chiudiamo comunque */
    }
    setOpen(false);
  };

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
              Usiamo cookie tecnici essenziali per far funzionare il sito e, con
              il tuo consenso, cookie di analisi per capire come navighi.
              Puoi accettarli tutti o tenere solo quelli essenziali.
            </p>

            <button
              type="button"
              onClick={() => setDetails((d) => !d)}
              className="mt-3 font-mono text-[0.7rem] tracking-[0.16em] text-muted uppercase underline-offset-4 transition-colors hover:text-bone hover:underline"
            >
              {details ? "Nascondi dettagli" : "Maggiori dettagli"}
            </button>

            {details && (
              <dl className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-xs text-muted">
                <div>
                  <dt className="font-mono tracking-wider text-bone/80 uppercase">
                    Essenziali
                  </dt>
                  <dd className="mt-1 leading-relaxed">
                    Necessari per il carrello, le preferenze e la sicurezza.
                    Sempre attivi, non richiedono consenso.
                  </dd>
                </div>
                <div>
                  <dt className="font-mono tracking-wider text-bone/80 uppercase">
                    Analitici
                  </dt>
                  <dd className="mt-1 leading-relaxed">
                    Statistiche anonime sull'uso del sito per migliorarlo.
                    Attivati solo se accetti.
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => choose("essential")}
              className="order-2 rounded-full border border-line px-6 py-3 font-mono text-xs font-bold tracking-[0.16em] text-bone uppercase transition-colors duration-300 hover:border-bone/50 sm:order-1"
            >
              Solo essenziali
            </button>
            <button
              type="button"
              onClick={() => choose("all")}
              className="anim-glow order-1 rounded-full bg-volt px-7 py-3 font-mono text-xs font-bold tracking-[0.16em] text-black uppercase transition-transform duration-300 hover:-translate-y-0.5 sm:order-2"
            >
              Accetta tutti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
