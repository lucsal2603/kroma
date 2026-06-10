import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../lib/gsap";
import { formatEuro } from "../data/products";
import { api } from "../lib/api";

// Etichette leggibili per lo stato dell'ordine.
const STATUS = {
  pending: { label: "In lavorazione", cls: "border-line text-muted" },
  paid: { label: "Pagato", cls: "border-volt/50 bg-volt/10 text-volt" },
  shipped: { label: "Spedito", cls: "border-volt/50 bg-volt/10 text-volt" },
  failed: { label: "Fallito", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  cancelled: { label: "Annullato", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

const orderNumber = (id) => String(id).replace(/-/g, "").slice(0, 6).toUpperCase();

export default function OrdersModal({ open, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const panel = useRef(null);
  const backdrop = useRef(null);

  // Carica gli ordini quando il pannello si apre.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { orders } = await api.getOrders();
        if (active) setOrders(orders || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

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

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div ref={backdrop} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={panel}
        data-lenis-prevent
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-elevated"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-display text-2xl tracking-[0.12em] text-bone">I miei ordini</h2>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
              <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico gli ordini…</p>
            </div>
          ) : error ? (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-[0.7rem] leading-relaxed tracking-wide text-red-300">
              {error}
            </p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="anim-float inline-block text-4xl">🦈</span>
              <p className="text-muted text-sm">Non hai ancora ordini.<br />La tua prima frequenza ti aspetta.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map((o) => {
                const st = STATUS[o.status] || STATUS.pending;
                return (
                  <div key={o.id} className="rounded-2xl border border-line bg-ink p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm font-bold tracking-wider text-bone">
                          #KRM-{orderNumber(o.id)}
                        </div>
                        <div className="text-faint mt-0.5 font-mono text-[0.65rem] tracking-wide">
                          {fmtDate(o.created_at)}
                        </div>
                      </div>
                      <span
                        className={
                          "rounded-full border px-3 py-1 font-mono text-[0.6rem] tracking-[0.14em] uppercase " + st.cls
                        }
                      >
                        {st.label}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-1.5">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-bone">
                            {it.name} <span className="text-muted">· {it.color} · {it.size} ×{it.quantity}</span>
                          </span>
                          <span className="text-muted font-mono text-xs">
                            {formatEuro(it.unitPrice * it.quantity)} €
                          </span>
                        </div>
                      ))}
                    </div>

                    {o.shipping && (
                      <div className="mt-4 border-t border-line pt-3">
                        <p className="eyebrow mb-1 text-[0.55rem]">Spedizione</p>
                        <p className="text-muted text-xs leading-relaxed">
                          {o.shipping.name}<br />
                          {o.shipping.address}<br />
                          {o.shipping.zip} {o.shipping.city} ({o.shipping.province})
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                      <span className="text-muted font-mono text-xs tracking-wider uppercase">Totale</span>
                      <span className="text-bone text-lg font-semibold">{formatEuro(o.total)} €</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
