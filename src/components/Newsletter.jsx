import { useState } from "react";
import { useReveal } from "../hooks/useReveal";
import { useAuth } from "../store/auth";
import { api } from "../lib/api";

export default function Newsletter() {
  const ref = useReveal({ stagger: 0.1, y: 40 });
  const { isAuthenticated, user, updateUser, openAuth } = useAuth();

  // Ospite (non loggato): raccoglie l'email solo come invito a registrarsi.
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  // Utente loggato: attiva/disattiva il consenso alle email.
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const subscribed = user?.marketing_consent === true;

  const onGuestSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setDone(true);
    setEmail("");
  };

  const setConsent = async (value) => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await api.setMarketingConsent(value);
      updateUser({ marketing_consent: value });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section ref={ref} className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <p data-reveal className="eyebrow mb-4 text-volt">
            <span className="anim-sway">🦈</span> Resta in scia
          </p>
          <h2 data-reveal className="display text-bone text-[clamp(2.4rem,7vw,5rem)] leading-[1.08]">
            Iscriviti<br />all'abisso
          </h2>

          {/* CASO 1 — utente loggato e GIÀ iscritto: niente moduli, solo lo stato. */}
          {isAuthenticated && subscribed ? (
            <>
              <p data-reveal className="text-muted mt-5 max-w-md text-sm leading-relaxed">
                Sei dentro. Nuove livree, drop in anteprima e offerte riservate
                arriveranno dritte nella tua inbox. 🏴‍☠️
              </p>
              <div data-reveal className="mt-10 w-full">
                <div className="rounded-full border border-volt/50 bg-volt/10 px-8 py-5 font-mono text-sm font-bold tracking-[0.18em] text-volt uppercase">
                  🌊 Ora sei nell'abisso
                </div>
                {err && (
                  <p className="mt-3 font-mono text-[0.7rem] tracking-wider text-red-300 uppercase">{err}</p>
                )}
                <button
                  type="button"
                  onClick={() => setConsent(false)}
                  disabled={busy}
                  className="mt-4 font-mono text-[0.62rem] tracking-wider text-faint uppercase underline transition-colors hover:text-bone disabled:opacity-40"
                >
                  {busy ? "Attendi…" : "Non vuoi più riceverle? Disattiva"}
                </button>
              </div>
            </>
          ) : isAuthenticated ? (
            /* CASO 2 — utente loggato ma NON iscritto: un tasto per accettare. */
            <>
              <p data-reveal className="text-muted mt-5 max-w-md text-sm leading-relaxed">
                Attiva le email KROMA: nuove livree, drop in anteprima e offerte
                riservate. Niente spam — solo istinto selvaggio. 🏝️
              </p>
              <div data-reveal className="mt-10 w-full">
                <button
                  type="button"
                  onClick={() => setConsent(true)}
                  disabled={busy}
                  className="anim-glow w-full rounded-full bg-volt px-8 py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                >
                  {busy ? "Attendi…" : "🦈 Attiva e accetta le email"}
                </button>
                <p className="mt-4 min-h-5 font-mono text-[0.7rem] tracking-wider uppercase">
                  {err ? (
                    <span className="text-red-300">{err}</span>
                  ) : (
                    <span className="text-faint">Potrai disiscriverti quando vuoi.</span>
                  )}
                </p>
              </div>
            </>
          ) : (
            /* CASO 3 — ospite (non loggato): invito a registrarsi. */
            <>
              <p data-reveal className="text-muted mt-5 max-w-md text-sm leading-relaxed">
                Nuove livree, drop in anteprima e ingegneria da MotoGP.
                Niente spam — solo istinto selvaggio nella tua inbox. 🏴‍☠️
              </p>
              <form data-reveal onSubmit={onGuestSubmit} className="mt-10 w-full">
                <div className="flex flex-col items-center gap-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="la-tua@email.com"
                    aria-label="Indirizzo email"
                    className="w-full rounded-full border border-line bg-ink px-6 py-4 text-center font-mono text-sm text-bone placeholder:text-faint transition-colors duration-300 focus:border-volt/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="anim-glow w-full rounded-full bg-volt px-8 py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
                  >
                    Iscriviti
                  </button>
                </div>
                <p className="mt-4 min-h-5 font-mono text-[0.7rem] tracking-wider uppercase">
                  {done ? (
                    <button
                      type="button"
                      onClick={openAuth}
                      className="text-volt underline transition-opacity hover:opacity-80"
                    >
                      🏝️ Crea il tuo account per entrare nell'abisso
                    </button>
                  ) : (
                    <span className="text-faint">Iscrivendoti accetti la privacy policy.</span>
                  )}
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
