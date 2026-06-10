import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";
import { api } from "../lib/api";
import { formatEuro } from "../data/products";
import { fileToCompressedDataUrl } from "../lib/image";
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

// --- Riga prodotto con editor della giacenza + elimina ---------------
function StockRow({ product, onSaved, onDeleted }) {
  const [value, setValue] = useState(String(product.stock ?? 0));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const dirty = Number(value) !== Number(product.stock ?? 0);
  const meta = [product.code, product.color].filter(Boolean).join(" · ");

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

  const remove = async () => {
    if (!window.confirm(`Eliminare "${product.name}" dal sito? L'azione non è reversibile.`)) return;
    setDeleting(true);
    setError("");
    try {
      await api.deleteProduct(product.id);
      onDeleted(product.id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-ink p-4">
      <img src={product.img} alt={product.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-lg text-bone">{product.name}</div>
        <div className="text-faint truncate font-mono text-[0.65rem] tracking-wide uppercase">
          {meta} · {formatEuro(product.price)} €
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
        <button
          onClick={remove}
          disabled={deleting}
          aria-label="Elimina prodotto"
          title="Elimina prodotto"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
        >
          {deleting ? "…" : "🗑"}
        </button>
      </div>
      {error ? (
        <span className="w-full font-mono text-[0.6rem] text-red-300">{error}</span>
      ) : savedAt ? (
        <span className="font-mono text-[0.6rem] text-volt">✓</span>
      ) : null}
    </div>
  );
}

// --- Finestrella "Nuova categoria" (sopra al form prodotto) ----------
function NewCategoryForm({ existing, onClose, onCreate }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");

  const create = () => {
    const nameNew = val.trim();
    if (!nameNew) return setErr("Scrivi il nome della categoria.");
    if (existing.some((c) => c.toLowerCase() === nameNew.toLowerCase()))
      return setErr("Questa categoria esiste già.");
    onCreate(nameNew);
  };

  // Non è un <form> (sarebbe annidato dentro quello del prodotto): gestiamo
  // Invio a mano e blocchiamo il submit del form esterno.
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      create();
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-elevated p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
        >
          ✕
        </button>
        <h3 className="font-display text-2xl text-bone">Nuova categoria</h3>
        <p className="text-muted mt-1 text-sm">Es. una marca (Shoei) o un tipo (Accessori).</p>
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Nome categoria"
          className="mt-5 w-full rounded-xl border border-line bg-ink px-4 py-3 text-bone outline-none focus:border-volt/60"
        />
        {err && (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-center font-mono text-[0.7rem] text-red-300">
            {err}
          </p>
        )}
        <button
          type="button"
          onClick={create}
          className="mt-5 w-full rounded-full bg-volt px-6 py-3.5 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform hover:-translate-y-0.5"
        >
          Crea categoria
        </button>
      </div>
    </div>
  );
}

// --- Form "Aggiungi prodotto" (finestra modale) ----------------------
function AddProductForm({ onClose, onCreated, brands }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [cats, setCats] = useState(brands);
  const [showNewCat, setShowNewCat] = useState(false);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("5");
  const [tag, setTag] = useState("");
  const [blurb, setBlurb] = useState("");
  const [img, setImg] = useState("");        // data URL foto principale
  const [imgBack, setImgBack] = useState(""); // data URL foto secondaria
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickImage = (setter) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setter(dataUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Inserisci il nome del prodotto.");
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return setError("Inserisci un prezzo valido (> 0).");
    if (!img) return setError("Carica almeno una foto del prodotto.");
    setBusy(true);
    try {
      const { product } = await api.createProduct({
        name: name.trim(),
        brand: brand.trim(),
        price: p,
        stock: stock === "" ? 0 : Number(stock),
        tag: tag.trim(),
        blurb: blurb.trim(),
        img,
        imgBack,
      });
      onCreated(product);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-line bg-ink px-4 py-3 text-bone outline-none focus:border-volt/60";

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8">
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg rounded-3xl border border-line bg-elevated p-6 sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
        >
          ✕
        </button>

        <h3 className="font-display text-3xl text-bone">Aggiungi prodotto</h3>
        <p className="text-muted mt-1 text-sm">Comparirà subito nel negozio, vicino agli altri.</p>

        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="eyebrow mb-2 block text-[0.6rem]">Nome</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Guanti racing" />
          </div>

          <div>
            <label className="eyebrow mb-2 block text-[0.6rem]">Marca / Categoria</label>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setBrand(brand === c ? "" : c)}
                  className={
                    "rounded-full px-4 py-2 font-mono text-xs tracking-wider uppercase transition-colors " +
                    (brand === c
                      ? "border border-volt bg-volt/15 text-volt"
                      : "border border-line text-muted hover:text-bone")
                  }
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNewCat(true)}
                className="rounded-full border border-dashed border-line px-4 py-2 font-mono text-xs tracking-wider text-bone uppercase transition-colors hover:border-volt/60"
              >
                + Nuova
              </button>
            </div>
            <p className="text-faint mt-1.5 font-mono text-[0.58rem]">È il bollino mostrato sulla foto. Se non scegli nulla sarà "KROMA".</p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="eyebrow mb-2 block text-[0.6rem]">Prezzo (EUR)</label>
              <input className={field} type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120" />
            </div>
            <div className="flex-1">
              <label className="eyebrow mb-2 block text-[0.6rem]">Giacenza</label>
              <input className={field} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="eyebrow mb-2 block text-[0.6rem]">Etichetta (facoltativa)</label>
            <input className={field} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Es. 🆕 novità" />
          </div>

          <div>
            <label className="eyebrow mb-2 block text-[0.6rem]">Descrizione</label>
            <textarea className={field + " min-h-[90px] resize-y"} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Racconta il prodotto in due righe…" />
          </div>

          <div className="flex gap-4">
            <ImagePicker label="Foto principale" value={img} onPick={pickImage(setImg)} onClear={() => setImg("")} />
            <ImagePicker label="Seconda foto (facoltativa)" value={imgBack} onPick={pickImage(setImgBack)} onClear={() => setImgBack("")} />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-center font-mono text-[0.7rem] text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-full bg-volt px-8 py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? "Creo il prodotto…" : "🦈 Crea prodotto"}
          </button>
        </div>

        {showNewCat && (
          <NewCategoryForm
            existing={cats}
            onClose={() => setShowNewCat(false)}
            onCreate={(nameNew) => {
              setCats((list) => [...list, nameNew]);
              setBrand(nameNew);
              setShowNewCat(false);
            }}
          />
        )}
      </form>
    </div>
  );
}

// Selettore immagine con anteprima.
function ImagePicker({ label, value, onPick, onClear }) {
  return (
    <div className="flex-1">
      <label className="eyebrow mb-2 block text-[0.6rem]">{label}</label>
      <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-ink transition-colors hover:border-volt/50">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-faint px-2 text-center font-mono text-[0.6rem] uppercase">+ Carica foto</span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onPick} />
      </label>
      {value && (
        <button type="button" onClick={onClear} className="mt-1.5 font-mono text-[0.6rem] text-muted underline hover:text-bone">
          rimuovi
        </button>
      )}
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
  const [showAdd, setShowAdd] = useState(false);

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

  const onProductCreated = (product) => setProducts((list) => [product, ...list]);
  const onProductDeleted = (id) => setProducts((list) => list.filter((p) => p.id !== id));

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
            ["Prodotti", products.length],
            ["Incassato", `${formatEuro(revenue)} €`],
          ].map(([label, val]) => (
            <div key={label} className="rounded-2xl border border-line bg-elevated p-5">
              <p className="font-mono text-[0.6rem] tracking-wider text-muted uppercase">{label}</p>
              <p className="mt-1 font-display text-2xl text-bone">{val}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {[
            ["orders", "Ordini ricevuti"],
            ["stock", "Prodotti & giacenza"],
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
          {tab === "stock" && (
            <button
              onClick={() => setShowAdd(true)}
              className="ml-auto rounded-full bg-volt px-5 py-2.5 font-mono text-xs font-bold tracking-wider text-black uppercase transition-transform hover:-translate-y-0.5"
            >
              + Aggiungi prodotto
            </button>
          )}
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
              <StockRow key={p.id} product={p} onSaved={onStockSaved} onDeleted={onProductDeleted} />
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

      {showAdd && (
        <AddProductForm
          onClose={() => setShowAdd(false)}
          onCreated={onProductCreated}
          brands={Array.from(
            new Set(["ARAI", "Shoei", "AGV", "HJC", ...products.map((p) => p.brand).filter(Boolean)])
          )}
        />
      )}
    </div>
  );
}
