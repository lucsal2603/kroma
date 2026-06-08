import { useState } from "react";
import { useReveal } from "../hooks/useReveal";

export default function Newsletter() {
  const ref = useReveal({ stagger: 0.1, y: 40 });
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setDone(true);
    setEmail("");
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
          <p data-reveal className="text-muted mt-5 max-w-md text-sm leading-relaxed">
            Nuove livree, drop in anteprima e ingegneria da MotoGP.
            Niente spam — solo istinto selvaggio nella tua inbox. 🏴‍☠️
          </p>

          <form data-reveal onSubmit={onSubmit} className="mt-10 w-full">
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
                <span className="text-volt">🏝️ Sei a bordo. Benvenuto nell'abisso.</span>
              ) : (
                <span className="text-faint">Iscrivendoti accetti la privacy policy.</span>
              )}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
