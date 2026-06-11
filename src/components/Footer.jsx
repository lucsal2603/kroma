import { useReveal } from "../hooks/useReveal";
import Logo from "./Logo";

export default function Footer() {
  const ref = useReveal({ stagger: 0.08, y: 30 });

  return (
    <footer ref={ref} className="border-t border-line">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div data-reveal className="max-w-sm">
            <Logo markClass="h-9 w-9" textClass="text-2xl" />
            <p className="text-muted mt-4 text-sm leading-relaxed">
              Caschi ad alte prestazioni a Milano Marittima. I migliori marchi, una sola ossessione: proteggerti. 🏴‍☠️🏝️🦈
            </p>
          </div>

          <div data-reveal className="flex flex-wrap gap-x-12 gap-y-6">
            {[
              ["Naviga", [["Collezione", "#collezione"], ["Tecnologia", "#tech"]]],
              ["Contatti", [["Instagram", "#top"], ["Newsletter", "#top"], ["Rivenditori", "#top"]]],
            ].map(([title, links]) => (
              <div key={title}>
                <div className="eyebrow mb-4 text-[0.6rem]">{title}</div>
                <ul className="flex flex-col gap-2.5">
                  {links.map(([l, href]) => (
                    <li key={l}>
                      <a href={href} className="text-bone/80 text-sm transition-colors hover:text-volt">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Link legali: aprono l'informativa (modale PolicyModal) via evento. */}
        <div data-reveal className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-8 font-mono text-[0.65rem] tracking-wider uppercase">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("kroma:open-policy", { detail: "privacy" }))}
            className="text-muted transition-colors hover:text-volt"
          >
            Privacy
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("kroma:open-policy", { detail: "cookie" }))}
            className="text-muted transition-colors hover:text-volt"
          >
            Cookie Policy
          </button>
        </div>

        {/* Avviso legale obbligatorio: i prodotti sono repliche omologate, non originali. */}
        <div data-reveal className="mt-8 rounded-xl border border-line bg-elevated px-4 py-3">
          <p className="text-muted font-mono text-[0.65rem] leading-relaxed tracking-wide">
            ⚠️ <span className="text-bone font-semibold">Avviso:</span> i caschi venduti su KROMA sono{" "}
            <span className="text-bone">repliche omologate UE</span> e{" "}
            <span className="text-bone">non sono prodotti originali</span> dei marchi citati. I nomi
            e i modelli dei marchi sono usati solo a scopo descrittivo.
          </p>
        </div>

        <div data-reveal className="text-faint mt-8 flex flex-wrap justify-between gap-3 font-mono text-[0.65rem] tracking-wider uppercase">
          <span>© 2026 KROMA — Milano Marittima, IT</span>
          <span>Indossa l'istinto selvaggio</span>
        </div>
      </div>
    </footer>
  );
}
