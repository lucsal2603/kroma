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

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { logs: l } = await api.getActivity();
        if (active) setLogs(l || []);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico il registro…</p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="text-4xl">📋</span>
        <p className="text-muted text-sm">Nessuna attività registrata, per ora.</p>
        <p className="text-faint font-mono text-[0.62rem] tracking-wide">
          Da qui in poi ogni accesso, pubblicazione o modifica comparirà qui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {logs.map((l, i) => {
        const a = ACTIONS[l.action] || { label: l.action, icon: "•", cls: "border-line text-muted" };
        const color = colorForName(l.username, l.isOwner);
        return (
          <div
            key={i}
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
          </div>
        );
      })}
    </div>
  );
}
