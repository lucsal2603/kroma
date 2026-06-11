import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../lib/gsap";

// ⚠️ DATI DA COMPLETARE: sostituisci questi valori con quelli veri della
// tua attività. Senza i dati del titolare l'informativa NON è completa.
const TITOLARE = {
  nome: "KROMA", // ragione sociale / nome dell'attività
  email: "privacy@kroma.it", // <-- METTI QUI la tua email reale
  luogo: "Milano Marittima (RA), Italia",
  // piva: "—",   // <-- aggiungi Partita IVA quando ce l'hai
  // indirizzo: "—", // <-- indirizzo della sede
};

const UPDATED = "giugno 2026";

// Apre l'informativa da qualsiasi punto del sito:
//   window.dispatchEvent(new CustomEvent("kroma:open-policy", { detail: "privacy" | "cookie" }))
export default function PolicyModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("privacy"); // "privacy" | "cookie"
  const panel = useRef(null);
  const backdrop = useRef(null);

  // Ascolta l'evento globale lanciato dai link nel footer / banner cookie.
  useEffect(() => {
    const onOpen = (e) => {
      setTab(e.detail === "cookie" ? "cookie" : "privacy");
      setOpen(true);
    };
    window.addEventListener("kroma:open-policy", onOpen);
    return () => window.removeEventListener("kroma:open-policy", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
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
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-4">
      <div
        ref={backdrop}
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panel}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-elevated"
      >
        {/* Intestazione + tab */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-5 sm:px-8">
          <div className="flex rounded-full border border-line p-1 font-mono text-[0.62rem] tracking-[0.16em] uppercase">
            <button
              onClick={() => setTab("privacy")}
              className={
                "rounded-full px-4 py-2 transition-colors " +
                (tab === "privacy" ? "bg-volt text-black" : "text-muted hover:text-bone")
              }
            >
              Privacy
            </button>
            <button
              onClick={() => setTab("cookie")}
              className={
                "rounded-full px-4 py-2 transition-colors " +
                (tab === "cookie" ? "bg-volt text-black" : "text-muted hover:text-bone")
              }
            >
              Cookie
            </button>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Chiudi"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
          >
            ✕
          </button>
        </div>

        {/* Corpo scrollabile */}
        <div className="overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
          {tab === "privacy" ? <PrivacyText /> : <CookieText />}
          <p className="text-faint mt-8 font-mono text-[0.58rem] tracking-wider uppercase">
            Ultimo aggiornamento: {UPDATED}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Pezzi di testo riutilizzabili ---
function H({ children }) {
  return (
    <h3 className="font-display mt-6 mb-2 text-lg tracking-[0.06em] text-bone first:mt-0">
      {children}
    </h3>
  );
}
function P({ children }) {
  return <p className="text-muted mb-3 text-sm leading-relaxed">{children}</p>;
}
function LI({ children }) {
  return <li className="text-muted mb-1.5 text-sm leading-relaxed">{children}</li>;
}

function PrivacyText() {
  return (
    <div>
      <h2 className="font-display text-2xl tracking-[0.08em] text-bone">Informativa sulla privacy</h2>
      <P>
        Questa pagina spiega come {TITOLARE.nome} tratta i tuoi dati personali quando usi
        questo sito, in conformità al Regolamento UE 2016/679 (GDPR).
      </P>

      <H>Chi tratta i tuoi dati (Titolare)</H>
      <P>
        {TITOLARE.nome} — {TITOLARE.luogo}. Per qualsiasi richiesta puoi scrivere a{" "}
        <a href={`mailto:${TITOLARE.email}`} className="text-volt hover:underline">
          {TITOLARE.email}
        </a>
        .
      </P>

      <H>Quali dati raccogliamo</H>
      <ul className="list-disc pl-5">
        <LI><strong className="text-bone/85">Account:</strong> nome, email e password (salvata sempre in forma cifrata, mai in chiaro).</LI>
        <LI><strong className="text-bone/85">Ordini:</strong> prodotti acquistati e dati di spedizione necessari a consegnare il casco.</LI>
        <LI><strong className="text-bone/85">Pagamenti:</strong> gestiti da PayPal. Non vediamo né salviamo i dati della tua carta.</LI>
        <LI><strong className="text-bone/85">Marketing:</strong> la tua email, solo se dai il consenso a ricevere offerte e novità.</LI>
      </ul>

      <H>Perché li trattiamo</H>
      <ul className="list-disc pl-5">
        <LI>Per creare il tuo account e farti accedere (esecuzione del contratto).</LI>
        <LI>Per gestire ordini, pagamenti e spedizioni (esecuzione del contratto).</LI>
        <LI>Per inviarti email promozionali, solo con il tuo consenso (che puoi revocare quando vuoi).</LI>
        <LI>Per obblighi di legge (es. fiscali) e per la sicurezza del sito.</LI>
      </ul>

      <H>Per quanto tempo</H>
      <P>
        Conserviamo i dati dell'account finché resta attivo e quelli degli ordini per il
        tempo richiesto dalla legge (es. fatturazione). I dati per il marketing vengono
        cancellati quando revochi il consenso.
      </P>

      <H>A chi li comunichiamo</H>
      <P>
        Solo a fornitori che ci aiutano a far funzionare il servizio: PayPal (pagamenti),
        il provider che ospita il sito e il database, e il servizio che invia le email.
        Non vendiamo i tuoi dati a nessuno.
      </P>

      <H>I tuoi diritti</H>
      <P>
        Puoi chiederci in qualsiasi momento di accedere ai tuoi dati, correggerli,
        cancellarli, limitarne l'uso o opporti al trattamento, e revocare il consenso al
        marketing. Scrivi a{" "}
        <a href={`mailto:${TITOLARE.email}`} className="text-volt hover:underline">
          {TITOLARE.email}
        </a>
        . Hai anche il diritto di proporre reclamo al Garante per la protezione dei dati
        personali (garanteprivacy.it).
      </P>
    </div>
  );
}

function CookieText() {
  return (
    <div>
      <h2 className="font-display text-2xl tracking-[0.08em] text-bone">Cookie policy</h2>
      <P>
        I cookie (e tecnologie simili come il "localStorage") sono piccoli file che il sito
        salva sul tuo dispositivo. Ecco cosa usiamo.
      </P>

      <H>Usiamo solo cookie tecnici</H>
      <P>
        Questo sito usa <strong className="text-bone/85">esclusivamente</strong> cookie e
        memorie tecniche, indispensabili per funzionare. Per questi cookie la legge non
        richiede il tuo consenso.
      </P>
      <ul className="list-disc pl-5">
        <LI><strong className="text-bone/85">Accesso:</strong> ti mantiene collegato dopo il login.</LI>
        <LI><strong className="text-bone/85">Carrello:</strong> ricorda i prodotti che hai aggiunto.</LI>
        <LI><strong className="text-bone/85">Preferenze:</strong> ricorda la tua scelta su questo avviso, così non te lo rimostriamo ogni volta.</LI>
      </ul>

      <H>Cosa NON usiamo</H>
      <P>
        Non usiamo cookie di profilazione, di pubblicità, né cookie di terze parti che ti
        tracciano da un sito all'altro. Non raccogliamo statistiche di navigazione.
      </P>

      <H>Come gestirli</H>
      <P>
        Puoi cancellare o bloccare i cookie dalle impostazioni del tuo browser. Attenzione:
        bloccando quelli tecnici alcune parti del sito (come carrello e accesso) potrebbero
        smettere di funzionare.
      </P>
    </div>
  );
}
