import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";
import { api } from "../lib/api";
import { formatEuro, hasSale, effectivePrice, salePercent } from "../data/products";
import { fileToCompressedDataUrl } from "../lib/image";
import HelmetFlip from "./HelmetFlip";
import MarketingPanel from "./MarketingPanel";
import ActivityLog from "./ActivityLog";
import UsersList from "./UsersList";
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
function StockRow({ product, onSaved, onDeleted, onEdit, onDiscount }) {
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
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-ink p-3 sm:gap-4 sm:p-4">
      <img src={product.img} alt={product.name} className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-14 sm:w-14" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-base text-bone sm:text-lg">{product.name}</div>
        <div className="text-faint truncate font-mono text-[0.6rem] tracking-wide uppercase sm:text-[0.65rem]">
          {meta} ·{" "}
          {hasSale(product) ? (
            <>
              <span className="line-through">{formatEuro(product.price)} €</span>{" "}
              <span className="text-volt">{formatEuro(effectivePrice(product))} € (−{salePercent(product)}%)</span>
            </>
          ) : (
            <>{formatEuro(product.price)} €</>
          )}
        </div>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Giacenza"
          className="min-w-0 flex-1 rounded-xl border border-line bg-elevated px-3 py-2 text-center font-mono text-bone outline-none focus:border-volt/60 sm:w-20 sm:flex-none"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="shrink-0 rounded-xl border border-volt/50 bg-volt/10 px-4 py-2 font-mono text-xs tracking-wider text-volt uppercase transition-colors hover:border-volt disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "…" : "Salva"}
        </button>
        <button
          onClick={() => onDiscount(product)}
          aria-label="Imposta sconto"
          title="Imposta sconto"
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-mono text-sm transition-colors " +
            (hasSale(product)
              ? "border-volt/60 bg-volt/10 text-volt"
              : "border-line text-muted hover:border-volt/60 hover:text-bone")
          }
        >
          %
        </button>
        <button
          onClick={() => onEdit(product)}
          aria-label="Modifica prodotto"
          title="Modifica prodotto"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-volt/60 hover:text-bone"
        >
          ✎
        </button>
        <button
          onClick={remove}
          disabled={deleting}
          aria-label="Elimina prodotto"
          title="Elimina prodotto"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
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

// --- Finestrella "Sconto prodotto" (prezzo scontato) -----------------
function DiscountForm({ product, onClose, onSaved }) {
  const original = Number(product.price);
  const [value, setValue] = useState(product.salePrice != null ? String(product.salePrice) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sale = Number(value);
  const valid = Number.isFinite(sale) && sale > 0 && sale < original;
  const pct = valid ? Math.round((1 - sale / original) * 100) : 0;
  const alreadyOnSale = product.salePrice != null && Number(product.salePrice) < original;

  const save = async () => {
    if (!valid) {
      setErr(`Scrivi un prezzo scontato tra 1 € e ${formatEuro(original)} € (sotto al prezzo pieno).`);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { product: updated } = await api.updateProduct(product.id, { salePrice: sale });
      onSaved(updated);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const removeSale = async () => {
    setBusy(true);
    setErr("");
    try {
      const { product: updated } = await api.updateProduct(product.id, { salePrice: null });
      onSaved(updated);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
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
        <h3 className="font-display text-2xl text-bone">Sconto prodotto</h3>
        <p className="text-muted mt-1 text-sm">
          {product.name} · prezzo pieno {formatEuro(original)} €
        </p>

        <label className="eyebrow mt-5 mb-1.5 block text-[0.6rem]">Prezzo scontato (EUR)</label>
        <input
          autoFocus
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Es. ${Math.max(1, Math.round(original * 0.8))}`}
          className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-bone outline-none focus:border-volt/60"
        />

        {/* Anteprima di come apparirà il prezzo nel negozio */}
        <div className="mt-4 rounded-2xl border border-line bg-ink px-4 py-3 text-center">
          <p className="eyebrow mb-2 text-[0.55rem]">Nel negozio apparirà così</p>
          {valid ? (
            <div className="flex items-baseline justify-center gap-2.5">
              <span className="text-faint font-mono text-sm line-through">{formatEuro(original)} €</span>
              <span className="text-volt text-2xl font-bold">{formatEuro(sale)} €</span>
              <span className="rounded-full bg-red-500 px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-wider text-white uppercase">
                −{pct}%
              </span>
            </div>
          ) : (
            <span className="text-faint font-mono text-xs">Inserisci un prezzo più basso di {formatEuro(original)} €</span>
          )}
        </div>

        {err && (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-center font-mono text-[0.7rem] text-red-300">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          disabled={busy || !valid}
          className="mt-5 w-full rounded-full bg-volt px-6 py-3.5 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Salvo…" : "✓ Applica sconto"}
        </button>
        {alreadyOnSale && (
          <button
            type="button"
            onClick={removeSale}
            disabled={busy}
            className="mt-2 w-full rounded-full border border-line px-6 py-3 font-mono text-xs tracking-wider text-muted uppercase transition-colors hover:border-red-500/50 hover:text-red-300 disabled:opacity-40"
          >
            Togli lo sconto (torna a {formatEuro(original)} €)
          </button>
        )}
      </div>
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

// --- Finestrella "Altre foto" (galleria che ruota in automatico) -----
function MoreImagesForm({ images, onClose, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setErr("");
    setBusy(true);
    try {
      const dataUrls = [];
      for (const file of files) {
        dataUrls.push(await fileToCompressedDataUrl(file));
      }
      onChange([...images, ...dataUrls]);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
      e.target.value = ""; // permette di ricaricare lo stesso file
    }
  };

  const removeAt = (i) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-line bg-elevated p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
        >
          ✕
        </button>
        <h3 className="font-display text-2xl text-bone">Altre foto</h3>
        <p className="text-muted mt-1 text-sm">
          Queste foto si alterneranno da sole nel negozio (oltre alle prime due).
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {images.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-ink">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Rimuovi foto"
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-bone opacity-0 transition-opacity hover:bg-red-500/80 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-ink text-center transition-colors hover:border-volt/50">
            <span className="text-faint font-mono text-[0.55rem] uppercase">{busy ? "…" : "+ Aggiungi"}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={addFiles} disabled={busy} />
          </label>
        </div>

        {err && (
          <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-center font-mono text-[0.7rem] text-red-300">
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-volt px-6 py-3.5 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform hover:-translate-y-0.5"
        >
          Fatto
        </button>
      </div>
    </div>
  );
}

// --- Anteprima: scheda prodotto come apparirà nel negozio ------------
function PreviewCard({ name, brand, price, tag, blurb, gallery }) {
  const priceNum = Number(price);
  return (
    <div className="mx-auto max-w-xs">
      <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-[#f4f4f3] to-[#d9d9d6]">
          <HelmetFlip
            images={gallery}
            alt={name}
            interval={2200}
            className="h-full w-full"
            imgClass="h-full w-full object-contain p-5"
          />
          <span className="absolute top-4 left-4 rounded-full bg-black/80 px-3 py-1 font-mono text-[0.62rem] font-bold tracking-[0.2em] text-bone uppercase">
            {brand.trim() || "KROMA"}
          </span>
          {tag.trim() && (
            <span className="absolute top-4 right-4 rounded-full bg-black/60 px-3 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-bone uppercase">
              {tag.trim()}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between p-5">
          <div className="min-w-0">
            <div className="eyebrow text-[0.6rem]">{brand.trim() || "KROMA"}</div>
            <div className="font-display mt-1 truncate text-2xl text-bone">{name || "Senza nome"}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-muted font-mono text-xs">EUR</div>
            <div className="text-bone text-lg font-semibold">
              {Number.isFinite(priceNum) ? formatEuro(priceNum) : "—"}
            </div>
          </div>
        </div>
        {blurb.trim() && (
          <p className="text-muted px-5 pb-5 text-sm leading-relaxed">{blurb.trim()}</p>
        )}
      </div>
      <p className="text-faint mt-3 text-center font-mono text-[0.58rem] tracking-wide uppercase">
        {gallery.length > 1
          ? `Galleria: ${gallery.length} foto che si alternano da sole`
          : "1 foto"}
      </p>
    </div>
  );
}

// --- Form prodotto (crea o modifica, finestra modale) ----------------
function ProductForm({ onClose, onCreated, onUpdated, brands, product }) {
  const editing = !!product;
  const [name, setName] = useState(product?.name || "");
  const [brand, setBrand] = useState(product?.brand || "");
  const [cats, setCats] = useState(brands);
  const [showNewCat, setShowNewCat] = useState(false);
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock ?? 0) : "5");
  const [tag, setTag] = useState(product?.tag || "");
  const [blurb, setBlurb] = useState(product?.blurb || "");
  const [img, setImg] = useState(product?.img || "");        // data URL/URL foto principale
  const [imgBack, setImgBack] = useState(product?.imgBack || ""); // foto secondaria
  // Foto aggiuntive (dalla 3ª in poi): la galleria che ruota in animazione.
  const [extraImages, setExtraImages] = useState(
    product?.gallery?.length > 2 ? product.gallery.slice(2) : []
  );
  const [showMore, setShowMore] = useState(false);
  const [preview, setPreview] = useState(false); // step di conferma con anteprima
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Per capire se le foto sono cambiate (e non rispedire MB inutilmente).
  const initialImages = product
    ? (product.gallery?.length ? product.gallery : [product.img, product.imgBack].filter(Boolean))
    : [];

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

  // La galleria completa: copertina, seconda foto e tutte le aggiuntive.
  const gallery = [img, imgBack, ...extraImages].filter(Boolean);

  // 1° passo: dal form si va all'anteprima (dopo i controlli).
  const toPreview = (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Inserisci il nome del prodotto.");
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return setError("Inserisci un prezzo valido (> 0).");
    if (!img) return setError("Carica almeno una foto del prodotto.");
    setPreview(true);
  };

  // 2° passo: confermata l'anteprima, si salva davvero.
  const confirm = async () => {
    setError("");
    const p = Number(price);
    setBusy(true);
    const images = gallery;
    try {
      if (editing) {
        // In modifica mando le immagini solo se cambiate (sono pesanti).
        const payload = {
          name: name.trim(),
          brand: brand.trim(),
          price: p,
          stock: stock === "" ? 0 : Number(stock),
          tag: tag.trim(),
          blurb: blurb.trim(),
        };
        if (JSON.stringify(images) !== JSON.stringify(initialImages)) payload.images = images;
        const { product: updated } = await api.updateProduct(product.id, payload);
        onUpdated(updated);
      } else {
        const { product: created } = await api.createProduct({
          name: name.trim(),
          brand: brand.trim(),
          price: p,
          stock: stock === "" ? 0 : Number(stock),
          tag: tag.trim(),
          blurb: blurb.trim(),
          images,
        });
        onCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-line bg-ink px-4 py-3 text-bone outline-none focus:border-volt/60";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <form
        onSubmit={toPreview}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-elevated"
      >
        {/* Intestazione fissa */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
          <div>
            <h3 className="font-display text-2xl text-bone">
              {preview ? "Anteprima" : editing ? "Modifica prodotto" : "Aggiungi prodotto"}
            </h3>
            <p className="text-muted mt-0.5 text-xs">
              {preview
                ? "Ecco come apparirà nel negozio. Confermi o torni a modificare?"
                : editing
                  ? "Le modifiche si vedono subito nel negozio."
                  : "Comparirà subito nel negozio."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
          >
            ✕
          </button>
        </div>

        {/* Corpo scorrevole */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-7">
          {preview ? (
            <PreviewCard
              name={name}
              brand={brand}
              price={price}
              tag={tag}
              blurb={blurb}
              gallery={gallery}
            />
          ) : (
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="eyebrow mb-1.5 block text-[0.6rem]">Nome</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Guanti racing" />
            </div>

            <div>
              <label className="eyebrow mb-1.5 block text-[0.6rem]">Marca / Categoria</label>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setBrand(brand === c ? "" : c)}
                    className={
                      "rounded-full px-3.5 py-1.5 font-mono text-[0.7rem] tracking-wider uppercase transition-colors " +
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
                  className="rounded-full border border-dashed border-line px-3.5 py-1.5 font-mono text-[0.7rem] tracking-wider text-bone uppercase transition-colors hover:border-volt/60"
                >
                  + Nuova
                </button>
              </div>
              <p className="text-faint mt-1.5 font-mono text-[0.58rem]">Bollino sulla foto. Se non scegli nulla sarà "KROMA".</p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="eyebrow mb-1.5 block text-[0.6rem]">Prezzo (EUR)</label>
                <input className={field} type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120" />
              </div>
              <div className="flex-1">
                <label className="eyebrow mb-1.5 block text-[0.6rem]">Giacenza</label>
                <input className={field} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="eyebrow mb-1.5 block text-[0.6rem]">Etichetta (facoltativa)</label>
              <input className={field} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Es. 🆕 novità" />
            </div>

            <div>
              <label className="eyebrow mb-1.5 block text-[0.6rem]">Descrizione</label>
              <textarea className={field + " min-h-[70px] resize-y"} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Racconta il prodotto in due righe…" />
            </div>

            <div className="flex gap-3">
              <ImagePicker label="Foto principale" value={img} onPick={pickImage(setImg)} onClear={() => setImg("")} />
              <ImagePicker label="Seconda foto (facolt.)" value={imgBack} onPick={pickImage(setImgBack)} onClear={() => setImgBack("")} />
            </div>

            {/* Altre foto: la galleria che ruota in automatico nel negozio. */}
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-2.5 font-mono text-[0.65rem] tracking-wider text-muted uppercase transition-colors hover:border-volt/60 hover:text-bone"
            >
              🖼️ Altre foto (galleria)
              {extraImages.length > 0 && (
                <span className="rounded-full bg-volt/15 px-2 py-0.5 text-volt">+{extraImages.length}</span>
              )}
            </button>
            <p className="text-faint -mt-1.5 font-mono text-[0.58rem]">
              Aggiungi più foto: nel negozio si alterneranno da sole, come i caschi.
            </p>
          </div>
          )}
        </div>

        {/* Piè di pagina fisso: pulsante sempre raggiungibile */}
        <div className="border-t border-line px-5 py-4 sm:px-7">
          {error && (
            <p className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-center font-mono text-[0.7rem] text-red-300">
              {error}
            </p>
          )}
          {preview ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPreview(false)}
                disabled={busy}
                className="flex-1 rounded-full border border-line px-6 py-3.5 font-mono text-sm font-bold tracking-wider text-bone uppercase transition-colors hover:border-bone/40 disabled:opacity-50"
              >
                ← Modifica
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="flex-1 rounded-full bg-volt px-6 py-3.5 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
              >
                {busy ? "Salvo…" : editing ? "✓ Conferma" : "✓ Pubblica"}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-volt px-8 py-3.5 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
            >
              {editing ? "👁 Anteprima modifiche" : "👁 Anteprima"}
            </button>
          )}
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

        {showMore && (
          <MoreImagesForm
            images={extraImages}
            onClose={() => setShowMore(false)}
            onChange={setExtraImages}
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
      <label className="eyebrow mb-1.5 block text-[0.6rem]">{label}</label>
      <label className="flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-ink transition-colors hover:border-volt/50 sm:h-28">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-faint px-2 text-center font-mono text-[0.58rem] uppercase">+ Carica foto</span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onPick} />
      </label>
      {value && (
        <button type="button" onClick={onClear} className="mt-1 font-mono text-[0.6rem] text-muted underline hover:text-bone">
          rimuovi
        </button>
      )}
    </div>
  );
}

export default function AdminDashboard({ onPreviewSite }) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("orders"); // "orders" | "stock"
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [discountProduct, setDiscountProduct] = useState(null);

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
  const onProductUpdated = (product) =>
    setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, ...product } : p)));
  const onProductDeleted = (id) => setProducts((list) => list.filter((p) => p.id !== id));

  const closeForm = () => {
    setShowAdd(false);
    setEditProduct(null);
  };

  const revenue = orders
    .filter((o) => o.status === "paid" || o.status === "shipped")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="min-h-screen bg-ink text-bone">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo markClass="h-7 w-7" textClass="text-xl" />
            <span className="hidden rounded-full border border-volt/50 bg-volt/10 px-3 py-1 font-mono text-[0.6rem] tracking-[0.18em] text-volt uppercase sm:inline">
              Admin
            </span>
            <button
              onClick={onPreviewSite}
              title="Vedi il sito come un cliente"
              className="rounded-full border border-line px-3 py-1.5 font-mono text-[0.6rem] tracking-wider text-muted uppercase transition-colors hover:border-volt/50 hover:text-bone"
            >
              👁 Vedi come utente
            </button>
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

      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 grid grid-cols-3 gap-2.5 sm:mb-8 sm:gap-4">
          {[
            ["Ordini", orders.length],
            ["Prodotti", products.length],
            ["Incassato", `${formatEuro(revenue)} €`],
          ].map(([label, val]) => (
            <div key={label} className="rounded-2xl border border-line bg-elevated p-3 sm:p-5">
              <p className="font-mono text-[0.5rem] tracking-wider text-muted uppercase sm:text-[0.6rem]">{label}</p>
              <p className="mt-1 font-display text-lg break-words text-bone sm:text-2xl">{val}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {[
            ["orders", "Ordini ricevuti"],
            ["stock", "Prodotti & giacenza"],
            ["marketing", "Campagne email"],
            ["users", "Iscritti"],
            ["activity", "Registro attività"],
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
              className="w-full rounded-full bg-volt px-5 py-2.5 font-mono text-xs font-bold tracking-wider text-black uppercase transition-transform hover:-translate-y-0.5 sm:ml-auto sm:w-auto"
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
        ) : tab === "marketing" ? (
          <MarketingPanel />
        ) : tab === "users" ? (
          <UsersList />
        ) : tab === "activity" ? (
          <ActivityLog />
        ) : tab === "stock" ? (
          <div className="flex flex-col gap-3">
            {products.map((p) => (
              <StockRow
                key={p.id}
                product={p}
                onSaved={onStockSaved}
                onDeleted={onProductDeleted}
                onEdit={setEditProduct}
                onDiscount={setDiscountProduct}
              />
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
                <div key={o.id} className="rounded-2xl border border-line bg-elevated p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold tracking-wider text-bone">
                        #KRM-{orderNumber(o.id)}
                      </div>
                      <div className="text-faint mt-0.5 font-mono text-[0.65rem] tracking-wide break-words">
                        {fmtDate(o.created_at)} · {o.customer_username} ({o.customer_email})
                      </div>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-full border px-3 py-1 font-mono text-[0.6rem] tracking-[0.14em] uppercase " + st.cls
                      }
                    >
                      {st.label}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col gap-1.5">
                    {o.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 text-bone">
                          {it.name} <span className="text-muted">· {it.color} · {it.size} ×{it.quantity}</span>
                        </span>
                        <span className="shrink-0 text-muted font-mono text-xs">
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

      {(showAdd || editProduct) && (
        <ProductForm
          product={editProduct}
          onClose={closeForm}
          onCreated={onProductCreated}
          onUpdated={onProductUpdated}
          brands={Array.from(
            new Set(["ARAI", "Shoei", "AGV", "HJC", ...products.map((p) => p.brand).filter(Boolean)])
          )}
        />
      )}

      {discountProduct && (
        <DiscountForm
          product={discountProduct}
          onClose={() => setDiscountProduct(null)}
          onSaved={onProductUpdated}
        />
      )}
    </div>
  );
}
