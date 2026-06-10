import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";
import { api } from "../lib/api";
import { formatEuro } from "../data/products";
import Logo from "./Logo";

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

// --- Riga prodotto con editor della giacenza -------------------------
function StockRow({ product, onSaved }) {
  const [value, setValue] = useState(String(product.stock ?? 0));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");

  const dirty = Number(value) !== Number(product.stock ?? 0);

  const save = async () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setError("Numero non valido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { product: updated } = await api.updateStock(product.id, n);
      onSaved(updated.id, updated.stock);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-ink p-4">
      <img src={product.img} alt={product.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-lg text-bone">{product.name}</div>
        <div className="text-faint truncate font-mono text-[0.65rem] tracking-wide uppercase">
          {product.code} · {product.color}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-xl border border-line bg-elevated px-3 py-2 text-center font-mono text-bone outline-none focus:border-volt/60"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-xl border border-volt/50 bg-volt/10 px-4 py-2 font-mono text-xs tracking-wider text-volt uppercase transition-colors hover:border-volt disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "…" : "Salva"}
        </button>
      </div>
      {error ? (
        <span className="font-mono text-[0.6rem] text-red-300">{error}</span>
      ) : savedAt ? (
        <span className="font-mono text-[0.6rem] text-volt">✓</span>
      ) : null}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("orders"); // "orders" | "stock"
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [{ products: p }, { orders: o }] = await Promise.all([
          api.getProducts(),
          api.getAllOrders(),
        ]);
        if (!active) return;
        setProducts(p || []);
        setOrders(o || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onStockSaved = (id, stock) =>
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, stock } : p)));

  const revenue = orders
    .filter((o) => o.status === "paid" || o.status === "shipped")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo markClass="h-7 w-7" textClass="text-xl" />
            <span className="rounded-full border border-volt/50 bg-volt/10 px-3 py-1 font-mono text-[0.6rem] tracking-[0.18em] text-volt uppercase">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-muted sm:inline">{user?.username}</span>
            <button
              onClick={logout}
              className="rounded-full border border-line px-4 py-2 font-mono text-xs tracking-wider text-bone uppercase transition-colors hover:border-bone/40"
            >
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-8">
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            ["Ordini", orders.length],
            ["Caschi", products.length],
            ["Incassato", `${formatEuro(revenue)} €`],
          ].map(([label, val]) => (
            <div key={label} className="rounded-2xl border border-line bg-elevated p-5">
              <p className="font-mono text-[0.6rem] tracking-wider text-muted uppercase">{label}</p>
              <p className="mt-1 font-display text-2xl text-bone">{val}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex gap-2">
          {[
            ["orders", "Ordini ricevuti"],
            ["stock", "Giacenza caschi"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                "rounded-full px-5 py-2.5 font-mono text-xs tracking-wider uppercase transition-colors " +
                (tab === key
                  ? "border border-volt/50 bg-volt/10 text-volt"
                  : "border border-line text-muted hover:text-bone")
              }
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
            <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico la dashboard…</p>
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-sm text-red-300">
            {error}
          </p>
        ) : tab === "stock" ? (
          <div className="flex flex-col gap-3">
            {products.map((p) => (
              <StockRow key={p.id} product={p} onSaved={onStockSaved} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <span className="text-4xl">🦈</span>
            <p className="text-muted text-sm">Nessun ordine ricevuto, per ora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((o) => {
              const st = STATUS[o.status] || STATUS.pending;
              return (
                <div key={o.id} className="rounded-2xl border border-line bg-elevated p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-bold tracking-wider text-bone">
                        #KRM-{orderNumber(o.id)}
                      </div>
                      <div className="text-faint mt-0.5 font-mono text-[0.65rem] tracking-wide">
                        {fmtDate(o.created_at)} · {o.customer_username} ({o.customer_email})
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
                        {o.shipping.phone ? <><br />Tel: {o.shipping.phone}</> : null}
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
      </main>
    </div>
  );
}
