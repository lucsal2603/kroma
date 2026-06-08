import { useEffect, useState } from "react";
import { formatEuro } from "../data/products";
import { useCart } from "../store/cart";

export default function CartDrawer() {
  const { items, count, subtotal, setQty, remove, clear, cartOpen, closeCart } = useCart();
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // "Vai al checkout" porta alla schermata di pagamento PayPal.
  const goToPayment = () => {
    if (items.length === 0) return;
    setPaying(true);
  };

  // Pagamento con PayPal (flusso dimostrativo: simula la connessione a PayPal).
  // Per pagamenti reali serve il client ID PayPal + creazione/cattura ordine lato server.
  const payWithPaypal = () => {
    if (processing) return;
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setPaying(false);
      setDone(true);
      clear();
    }, 1800);
  };

  const handleClose = () => {
    closeCart();
    // resetta gli stati dopo che il drawer si è chiuso
    setTimeout(() => {
      setDone(false);
      setPaying(false);
      setProcessing(false);
    }, 500);
  };

  return (
    <div className={"fixed inset-0 z-[90] " + (cartOpen ? "" : "pointer-events-none")}>
      <div
        onClick={handleClose}
        className={
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-400 " +
          (cartOpen ? "opacity-100" : "opacity-0")
        }
      />
      <aside
        className={
          "absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-line bg-surface transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] " +
          (cartOpen ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-display text-2xl tracking-[0.15em] text-bone">
            {done
              ? "Ordine confermato"
              : paying
                ? "Pagamento"
                : <>Carrello <span className="text-volt">{count}</span></>}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Chiudi carrello"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <span className="anim-float inline-block text-6xl">🏴‍☠️</span>
            <h3 className="font-display text-3xl tracking-[0.12em] text-bone">Sei in scia! 🦈</h3>
            <p className="text-muted text-sm leading-relaxed">
              Ordine ricevuto. Ti abbiamo inviato la conferma via email:
              il tuo casco sta già emergendo dall'abisso. 🏝️
            </p>
            <div className="mt-2 w-full rounded-2xl border border-line bg-ink px-5 py-4 text-left font-mono text-xs">
              <div className="flex justify-between text-muted">
                <span>Ordine</span>
                <span className="text-bone">#KRM-{Math.floor(100000 + Math.random() * 899999)}</span>
              </div>
              <div className="mt-2 flex justify-between text-muted">
                <span>Consegna stimata</span>
                <span className="text-bone">3–5 giorni</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="anim-glow mt-2 w-full rounded-full bg-volt py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5"
            >
              Continua lo shopping
            </button>
          </div>
        ) : paying ? (
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
            <button
              onClick={() => setPaying(false)}
              disabled={processing}
              className="self-start font-mono text-[0.7rem] tracking-[0.16em] text-muted uppercase transition-colors hover:text-bone disabled:opacity-40"
            >
              ‹ Torna al carrello
            </button>

            <div className="mt-5 rounded-2xl border border-line bg-ink px-5 py-4 font-mono text-xs">
              <div className="flex justify-between text-muted">
                <span>Articoli</span>
                <span className="text-bone">{count}</span>
              </div>
              <div className="mt-2 flex justify-between text-muted">
                <span>Spedizione</span>
                <span className="text-volt">Gratuita</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="text-muted">Totale</span>
                <span className="font-sans text-xl font-semibold text-bone">{formatEuro(subtotal)} €</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-1 text-center">
              <p className="eyebrow text-[0.6rem]">Paga in modo sicuro con</p>
              <span className="text-2xl font-extrabold italic">
                <span style={{ color: "#003087" }}>Pay</span>
                <span style={{ color: "#009cde" }}>Pal</span>
              </span>
            </div>

            <button
              onClick={payWithPaypal}
              disabled={processing}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#ffc439] py-4 font-extrabold transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-80"
            >
              {processing ? (
                <span className="flex items-center gap-2 font-mono text-sm tracking-wider text-[#003087] uppercase">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#003087] border-t-transparent" />
                  Connessione a PayPal…
                </span>
              ) : (
                <span className="text-lg italic">
                  <span className="font-mono text-sm font-bold tracking-wide text-[#003087] not-italic">Paga con </span>
                  <span style={{ color: "#003087" }}>Pay</span>
                  <span style={{ color: "#009cde" }}>Pal</span>
                </span>
              )}
            </button>

            <button
              onClick={payWithPaypal}
              disabled={processing}
              className="mt-3 w-full rounded-full border border-[#2c2e2f] bg-[#2c2e2f] py-4 font-mono text-sm font-bold tracking-wider text-white uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
            >
              Carta di debito o credito
            </button>

            <p className="text-faint mt-4 text-center font-mono text-[0.58rem] leading-relaxed tracking-wider uppercase">
              🦈 Pagamento protetto · Verrai reindirizzato a PayPal
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="anim-float inline-block text-4xl">🦈</span>
            <p className="text-muted text-sm">Il carrello è vuoto.<br />Scegli la tua frequenza.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {items.map((it) => (
              <div key={it.id} className="flex gap-4 border-b border-line py-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-[#f4f4f3] to-[#cfcfcb]">
                  <img
                    src={it.img}
                    alt={it.name}
                    className="absolute inset-0 h-full w-full object-contain p-1.5"
                    draggable={false}
                  />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display text-xl text-bone">{it.name}</div>
                      <div className="eyebrow text-[0.55rem]">{it.model} · {it.color} · Taglia {it.size}</div>
                    </div>
                    <button
                      onClick={() => remove(it.id)}
                      aria-label="Rimuovi"
                      className="text-faint text-xs transition-colors hover:text-bone"
                    >
                      Rimuovi
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQty(it.id, it.qty - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-mono text-sm text-bone">{it.qty}</span>
                      <button
                        onClick={() => setQty(it.id, it.qty + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-bone font-semibold">{formatEuro(it.price * it.qty)} €</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!done && !paying && (
          <div className="border-t border-line px-6 py-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="eyebrow text-[0.6rem]">Subtotale</span>
              <span className="font-display text-3xl text-bone">{formatEuro(subtotal)} €</span>
            </div>
            <button
              onClick={goToPayment}
              disabled={items.length === 0}
              className="w-full rounded-full bg-volt py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🏴‍☠️ Vai al checkout
            </button>
            <p className="text-faint mt-3 text-center font-mono text-[0.6rem] tracking-wider uppercase">
              Spedizione gratuita · Reso 30 giorni
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
