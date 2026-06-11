import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Traduce il codice azione in testo leggibile + icona + colore.
const ACTIONS = {
  login: { label: "Accesso admin", icon: "🔑", cls: "border-line text-muted" },
  "product.create": { label: "Prodotto pubblicato", icon: "✨", cls: "border-volt/40 bg-volt/10 text-volt" },
  "product.update": { label: "Prodotto modificato", icon: "✎", cls: "border-line text-bone" },
  "product.delete": { label: "Prodotto eliminato", icon: "🗑", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
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

// Ogni admin ha il suo colore fisso: lo stesso nome → sempre lo stesso colore.
// "lucsal" ha il giallo riservato; gli altri pescano da una palette che il
// giallo non lo contiene, così resta unico per lucsal.
const MY_NAME = "lucsal";
const MY_COLOR = "#facc15"; // giallo (riservato a lucsal)

const NAME_COLORS = [
  "#7dd3fc", // azzurro
  "#f0abfc", // rosa
  "#86efac", // verde
  "#fca5a5", // rosso tenue
  "#c4b5fd", // viola
  "#fdba74", // arancio
  "#5eead4", // turchese
];

const colorForName = (name) => {
  const s = String(name || "");
  if (s.trim().toLowerCase() === MY_NAME) return MY_COLOR;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};

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
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-elevated p-3 sm:p-4"
          >
            <span
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-sm " + a.cls
              }
            >
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-bone text-sm">
                <span className="font-semibold">{a.label}</span>
                {l.detail && <span className="text-muted"> · {l.detail}</span>}
              </div>
              <div className="text-faint font-mono text-[0.62rem] tracking-wide">
                <span className="font-semibold" style={{ color: colorForName(l.username) }}>
                  {l.username || "—"}
                </span>{" "}
                · {fmt(l.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
