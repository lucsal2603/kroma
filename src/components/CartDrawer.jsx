import { useEffect, useState } from "react";
import { formatEuro } from "../data/products";
import { useCart } from "../store/cart";
import { useAuth } from "../store/auth";
import { api } from "../lib/api";
import { welcomeState, applyDiscount } from "../lib/welcome";
import PaypalCheckout from "./PaypalCheckout";

export default function CartDrawer() {
  const { items, count, subtotal, setQty, remove, clear, cartOpen, closeCart } = useCart();
  const { isAuthenticated, openAuth, user } = useAuth();
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [ship, setShip] = useState({
    name: "",
    address: "",
    zip: "",
    city: "",
    province: "",
    phone: "",
  });

  // Configurazione PayPal letta dal backend (client id pubblico + valuta).
  // Se PayPal non è configurato, si usa il pagamento simulato come ripiego.
  const [pp, setPp] = useState({ loading: true, configured: false, clientId: "", currency: "EUR" });

  // Configurazione sconto di benvenuto (percentuale + durata). Serve solo per
  // MOSTRARE lo sconto: l'importo reale è sempre ricalcolato dal server.
  const [welcomeCfg, setWelcomeCfg] = useState(null);
  const wState = welcomeState(user, welcomeCfg);
  const hasDiscount = wState.eligible && wState.percent > 0;
  const { discount, total } = hasDiscount
    ? applyDiscount(subtotal, wState.percent)
    : { discount: 0, total: subtotal };

  const setShipField = (field) => (e) =>
    setShip((s) => ({ ...s, [field]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && handleClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Carica la configurazione PayPal una volta sola.
  useEffect(() => {
    let active = true;
    api
      .getPaypalConfig()
      .then((c) => {
        if (active)
          setPp({
            loading: false,
            configured: Boolean(c.configured && c.clientId),
            clientId: c.clientId || "",
            currency: c.currency || "EUR",
          });
      })
      .catch(() => {
        if (active) setPp({ loading: false, configured: false, clientId: "", currency: "EUR" });
      });
    return () => {
      active = false;
    };
  }, []);

  // Carica la configurazione dello sconto di benvenuto una volta sola.
  useEffect(() => {
    let active = true;
    api
      .getWelcomeConfig()
      .then((c) => {
        if (active) setWelcomeCfg(c);
      })
      .catch(() => {
        /* se non riusciamo a leggerla, semplicemente non mostriamo lo sconto */
      });
    return () => {
      active = false;
    };
  }, []);

  // Controlla i dati di consegna (e il login). Imposta l'errore e ritorna false
  // se qualcosa non va. Usata sia dal pagamento simulato sia da PayPal.
  const validateShipping = () => {
    if (!isAuthenticated) {
      openAuth();
      return false;
    }
    if (items.find((it) => !it.productId)) {
      setError("Ricarica la pagina e riprova: alcuni articoli non sono collegati al catalogo.");
      return false;
    }
    const required = ["name", "address", "zip", "city", "province"];
    if (required.some((k) => !ship[k].trim())) {
      setError("Compila tutti i dati di consegna (telefono escluso).");
      return false;
    }
    if (!/^\d{5}$/.test(ship.zip.trim())) {
      setError("Il CAP deve avere 5 cifre.");
      return false;
    }
    if (ship.province.trim().length !== 2) {
      setError("La provincia va indicata con la sigla di 2 lettere (es. BS).");
      return false;
    }
    setError("");
    return true;
  };

  // Riallinea il carrello del motore a quello mostrato a schermo.
  const syncServerCart = async () => {
    await api.clearCart();
    for (const it of items) {
      await api.addToCart(it.productId, it.size, it.qty);
    }
  };

  const onPaid = (order) => {
    setOrderId(order?.id || null);
    setPaying(false);
    setDone(true);
    clear();
  };

  // "Vai al checkout": serve l'accesso. Se l'utente non è loggato apriamo
  // il pannello di accesso; altrimenti mostriamo la schermata di pagamento.
  const goToPayment = () => {
    if (items.length === 0) return;
    setError("");
    if (!isAuthenticated) {
      openAuth();
      return;
    }
    setPaying(true);
  };

  // Pagamento simulato (ripiego quando PayPal non è configurato).
  const completeCheckout = async () => {
    if (processing) return;
    if (!validateShipping()) return;
    setProcessing(true);
    try {
      await syncServerCart();
      const { order, paid } = await api.checkout({ shipping: ship });
      if (!paid) {
        setError("Pagamento non completato. Riprova.");
        return;
      }
      onPaid(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // --- PayPal ---------------------------------------------------------
  // 1) all'apertura del popup ricontrolliamo i dati di consegna
  // 2) creiamo l'ordine PayPal con il totale del carrello (lato server)
  // 3) a pagamento approvato lo incassiamo e creiamo l'ordine KROMA
  const paypalCreateOrder = async () => {
    await syncServerCart();
    const { id } = await api.createPaypalOrder();
    return id;
  };

  const paypalApprove = async (orderID) => {
    setProcessing(true);
    setError("");
    try {
      const { order, paid } = await api.capturePaypalOrder(orderID, ship);
      if (!paid) {
        setError("Pagamento non completato. Riprova.");
        return;
      }
      onPaid(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const paypalError = () =>
    setError("Si è verificato un problema con PayPal. Riprova tra poco.");

  const handleClose = () => {
    closeCart();
    // resetta gli stati dopo che il drawer si è chiuso
    setTimeout(() => {
      setDone(false);
      setPaying(false);
      setProcessing(false);
      setError("");
      setOrderId(null);
      setShip({ name: "", address: "", zip: "", city: "", province: "", phone: "" });
    }, 500);
  };

  // Numero ordine leggibile (prime 6 cifre dell'id reale, o fallback).
  const orderNumber = orderId
    ? String(orderId).replace(/-/g, "").slice(0, 6).toUpperCase()
    : null;

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
                <span className="text-bone">#KRM-{orderNumber || "------"}</span>
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

            <div className="mt-5">
              <p className="eyebrow mb-3 text-[0.6rem]">📦 Dove spediamo</p>
              <div className="flex flex-col gap-2.5">
                <input
                  value={ship.name}
                  onChange={setShipField("name")}
                  placeholder="Nome e cognome"
                  aria-label="Nome e cognome"
                  autoComplete="name"
                  className="rounded-2xl border border-line bg-ink px-4 py-3 font-mono text-sm text-bone placeholder:text-faint transition-colors focus:border-volt/60 focus:outline-none"
                />
                <input
                  value={ship.address}
                  onChange={setShipField("address")}
                  placeholder="Via e numero civico"
                  aria-label="Indirizzo"
                  autoComplete="street-address"
                  className="rounded-2xl border border-line bg-ink px-4 py-3 font-mono text-sm text-bone placeholder:text-faint transition-colors focus:border-volt/60 focus:outline-none"
                />
                <div className="flex gap-2.5">
                  <input
                    value={ship.zip}
                    onChange={setShipField("zip")}
                    placeholder="CAP"
                    aria-label="CAP"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    className="w-24 rounded-2xl border border-line bg-ink px-4 py-3 font-mono text-sm text-bone placeholder:text-faint transition-colors focus:border-volt/60 focus:outline-none"
                  />
                  <input
                    value={ship.city}
                    onChange={setShipField("city")}
                    placeholder="Città"
                    aria-label="Città"
                    autoComplete="address-level2"
                    className="flex-1 rounded-2xl border border-line bg-ink px-4 py-3 font-mono text-sm text-bone placeholder:text-faint transition-colors focus:border-volt/60 focus:outline-none"
                  />
                  <input
                    value={ship.province}
                    onChange={setShipField("province")}
                    placeholder="PR"
                    aria-label="Provincia"
                    maxLength={2}
                    autoComplete="address-level1"
                    className="w-16 rounded-2xl border border-line bg-ink px-3 py-3 text-center font-mono text-sm text-bone uppercase placeholder:text-faint transition-colors focus:border-volt/60 focus:outline-none"
                  />
                </div>
                <input
                  value={ship.phone}
                  onChange={setShipField("phone")}
                  placeholder="Telefono (per il corriere)"
                  aria-label="Telefono"
                  inputMode="tel"
                  autoComplete="tel"
                  className="rounded-2xl border border-line bg-ink px-4 py-3 font-mono text-sm text-bone placeholder:text-faint transition-colors focus:border-volt/60 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-line bg-ink px-5 py-4 font-mono text-xs">
              <div className="flex justify-between text-muted">
                <span>Articoli</span>
                <span className="text-bone">{count}</span>
              </div>
              <div className="mt-2 flex justify-between text-muted">
                <span>Spedizione</span>
                <span className="text-volt">Gratuita</span>
              </div>
              {hasDiscount && (
                <>
                  <div className="mt-2 flex justify-between text-muted">
                    <span>Subtotale</span>
                    <span className="text-bone">{formatEuro(subtotal)} €</span>
                  </div>
                  <div className="mt-2 flex justify-between text-volt">
                    <span>Sconto benvenuto (-{wState.percent}%)</span>
                    <span>−{formatEuro(discount)} €</span>
                  </div>
                </>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="text-muted">Totale</span>
                <span className="font-sans text-xl font-semibold text-bone">{formatEuro(total)} €</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-1 text-center">
              <p className="eyebrow text-[0.6rem]">Paga in modo sicuro con</p>
              <span className="text-2xl font-extrabold italic">
                <span style={{ color: "#003087" }}>Pay</span>
                <span style={{ color: "#009cde" }}>Pal</span>
              </span>
            </div>

            {pp.loading ? (
              <div className="mt-5 flex justify-center py-3">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-volt border-t-transparent" />
              </div>
            ) : pp.configured ? (
              <>
                <PaypalCheckout
                  clientId={pp.clientId}
                  currency={pp.currency}
                  onClickValidate={validateShipping}
                  createOrder={paypalCreateOrder}
                  onApprove={paypalApprove}
                  onError={paypalError}
                />
                {processing && (
                  <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[0.7rem] tracking-wider text-muted uppercase">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-volt border-t-transparent" />
                    Confermo l'ordine…
                  </p>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={completeCheckout}
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
                  onClick={completeCheckout}
                  disabled={processing}
                  className="mt-3 w-full rounded-full border border-[#2c2e2f] bg-[#2c2e2f] py-4 font-mono text-sm font-bold tracking-wider text-white uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Carta di debito o credito
                </button>
              </>
            )}

            {error && (
              <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-[0.7rem] leading-relaxed tracking-wide text-red-300">
                {error}
              </p>
            )}

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
            {hasDiscount && (
              <div className="mb-3 rounded-2xl border border-volt/40 bg-volt/10 px-4 py-3 font-mono text-xs">
                <div className="flex items-center justify-between text-muted">
                  <span>Subtotale</span>
                  <span className="text-bone">{formatEuro(subtotal)} €</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-volt">
                  <span>🎁 Sconto benvenuto (-{wState.percent}%)</span>
                  <span>−{formatEuro(discount)} €</span>
                </div>
              </div>
            )}
            <div className="mb-5 flex items-center justify-between">
              <span className="eyebrow text-[0.6rem]">{hasDiscount ? "Totale" : "Subtotale"}</span>
              <span className="font-display text-3xl text-bone">{formatEuro(total)} €</span>
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
