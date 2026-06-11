import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { colorForName } from "../lib/adminColors";

// Traduce il codice azione in testo leggibile + icona + colore.
const ACTIONS = {
  login: { label: "Accesso admin", icon: "🔑", cls: "border-line text-muted" },
  "product.create": { label: "Prodotto pubblicato", icon: "✨", cls: "border-volt/40 bg-volt/10 text-volt" },
  "product.update": { label: "Prodotto modificato", icon: "✎", cls: "border-line text-bone" },
  "product.delete": { label: "Prodotto eliminato", icon: "🗑", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  "product.feature": { label: "Messo in evidenza", icon: "⭐", cls: "border-volt/40 bg-volt/10 text-volt" },
  "product.unfeature": { label: "Tolto dall'evidenza", icon: "☆", cls: "border-line text-muted" },
  "stock.update": { label: "Giacenza aggiornata", icon: "📦", cls: "border-line text-bone" },
  "discount.set": { label: "Sconto applicato", icon: "%", cls: "border-volt/40 bg-volt/10 text-volt" },
  "discount.remove": { label: "Sconto rimosso", icon: "%", cls: "border-line text-muted" },
  "marketing.send": { label: "Email inviata", icon: "✉", cls: "border-volt/40 bg-volt/10 text-volt" },
  "marketing.config": { label: "Impostazioni campagne", icon: "⚙", cls: "border-line text-bone" },
  "user.reveal": { label: "Email iscritto mostrata", icon: "👁", cls: "border-line text-muted" },
  "user.disable": { label: "Account disabilitato", icon: "🚫", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  "user.enable": { label: "Account riabilitato", icon: "✓", cls: "border-volt/40 bg-volt/10 text-volt" },
  "user.admin.grant": { label: "Reso amministratore", icon: "★", cls: "border-volt/40 bg-volt/10 text-volt" },
  "user.admin.revoke": { label: "Admin rimosso", icon: "☆", cls: "border-line text-muted" },
};

const fmt = (iso) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false); // solo il proprietario può cancellare
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { logs: l, viewerIsOwner } = await api.getActivity();
        if (active) {
          setLogs(l || []);
          setIsOwner(Boolean(viewerIsOwner));
        }
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

  // Svuota tutto il registro (libera spazio). Solo proprietario.
  const clearAll = async () => {
    if (busy || logs.length === 0) return;
    if (!window.confirm("Svuotare tutto il registro attività? L'azione non è reversibile.")) return;
    setBusy(true);
    setError("");
    try {
      await api.clearActivity();
      setLogs([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Cancella una singola voce. Solo proprietario.
  const deleteOne = async (id) => {
    if (deletingId) return;
    setDeletingId(id);
    setError("");
    try {
      await api.deleteActivityEntry(id);
      setLogs((list) => list.filter((l) => l.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico il registro…</p>
      </div>
    );
  }

  // Errore al primo caricamento (lista vuota): mostra solo il box errore.
  if (error && logs.length === 0) {
    return (
      <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-sm text-red-300">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barra in alto: solo il proprietario può svuotare il registro. */}
      {isOwner && logs.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-faint font-mono text-[0.62rem] tracking-wide">
            {logs.length} {logs.length === 1 ? "voce" : "voci"} · svuota per liberare spazio
          </p>
          <button
            onClick={clearAll}
            disabled={busy}
            className="shrink-0 rounded-full border border-red-500/50 bg-red-500/10 px-4 py-2 font-mono text-[0.62rem] font-bold tracking-wider text-red-300 uppercase transition-colors hover:border-red-500 disabled:opacity-40"
          >
            {busy ? "Svuoto…" : "🧹 Svuota registro"}
          </button>
        </div>
      )}

      {/* Errore (es. su una cancellazione): banner senza nascondere la lista. */}
      {error && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-center font-mono text-[0.7rem] text-red-300">
          {error}
        </p>
      )}

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="text-4xl">📋</span>
          <p className="text-muted text-sm">Nessuna attività registrata, per ora.</p>
          <p className="text-faint font-mono text-[0.62rem] tracking-wide">
            Da qui in poi ogni accesso, pubblicazione o modifica comparirà qui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {logs.map((l, i) => {
            const a = ACTIONS[l.action] || { label: l.action, icon: "•", cls: "border-line text-muted" };
            const color = colorForName(l.username, l.isOwner);
            return (
              <div
                key={l.id || i}
                className="flex flex-wrap items-center gap-3 rounded-2xl border bg-elevated p-3 sm:p-4"
                // Cornice e sfondo tinti col colore dell'utente che ha fatto l'azione.
                style={{ borderColor: color + "66", backgroundColor: color + "0d" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-sm"
                  style={{ borderColor: color + "66", backgroundColor: color + "1a", color }}
                >
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-bone text-sm">
                    <span className="font-semibold">{a.label}</span>
                    {l.detail && <span className="text-muted"> · {l.detail}</span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.62rem] tracking-wide">
                    <span
                      className="rounded-md px-1.5 py-0.5 font-semibold"
                      style={{ color, backgroundColor: color + "1f" }}
                    >
                      {l.username || "—"}
                    </span>
                    <span className="text-faint">· {fmt(l.createdAt)}</span>
                  </div>
                </div>
                {/* Cancella singola voce: solo il proprietario. */}
                {isOwner && l.id && (
                  <button
                    onClick={() => deleteOne(l.id)}
                    disabled={deletingId === l.id}
                    aria-label="Cancella questa voce"
                    title="Cancella questa voce"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                  >
                    {deletingId === l.id ? "…" : "🗑"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
