import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatEuro } from "../data/products";

// Quando l'invio non parte, spieghiamo il perché in parole semplici.
const REASONS = {
  "smtp-non-configurato":
    "Per inviare davvero le email serve prima configurare il servizio di posta (SMTP) su Render. Finché non è pronto, l'invio non parte.",
  "nessuna-offerta":
    "Nessun prodotto è in sconto in questo momento. Metti uno sconto a un prodotto e l'email si comporrà da sola.",
  "colonna-non-migrata":
    "Il database non è ancora aggiornato per le campagne. Esegui la migrazione (add-marketing.sql) su Supabase.",
  "nessun-iscritto": "Nessun cliente ha ancora dato il consenso a ricevere le email.",
};

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-line bg-elevated p-3 sm:p-5">
      <p className="font-mono text-[0.5rem] tracking-wider text-muted uppercase sm:text-[0.6rem]">{label}</p>
      <p className={"mt-1 font-display text-lg break-words sm:text-2xl " + (accent ? "text-volt" : "text-bone")}>
        {value}
      </p>
    </div>
  );
}

export default function MarketingPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [days, setDays] = useState("7");
  const [savingCfg, setSavingCfg] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, text }

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const s = await api.getMarketing();
      setStatus(s);
      setDays(String(s.intervalDays ?? 7));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveDays = async () => {
    const n = Math.round(Number(days));
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      setFeedback({ ok: false, text: "Scrivi un numero di giorni tra 1 e 365." });
      return;
    }
    setSavingCfg(true);
    setFeedback(null);
    try {
      const { config } = await api.updateMarketing({ intervalDays: n });
      setStatus((s) => ({ ...s, intervalDays: config.intervalDays }));
      setFeedback({ ok: true, text: `Salvato: invio ogni ${config.intervalDays} giorni.` });
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSavingCfg(false);
    }
  };

  const toggleAuto = async () => {
    setTogglingAuto(true);
    setFeedback(null);
    try {
      const next = !status.autoEnabled;
      const { config } = await api.updateMarketing({ autoEnabled: next });
      // Ricarico lo stato per aggiornare anche "prossimo invio".
      await load();
      setFeedback({
        ok: true,
        text: config.autoEnabled ? "Invio automatico attivato." : "Invio automatico disattivato.",
      });
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setTogglingAuto(false);
    }
  };

  const sendNow = async () => {
    if (!window.confirm("Inviare adesso l'email con le offerte a tutti i clienti che hanno dato il consenso?"))
      return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await api.sendMarketingNow();
      if (res.reason) {
        setFeedback({ ok: false, text: REASONS[res.reason] || "Invio non riuscito." });
      } else {
        setFeedback({
          ok: true,
          text: `Email inviata a ${res.sent} clienti su ${res.total} (${res.offers} offerte).`,
        });
        await load();
      }
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico le campagne…</p>
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

  const s = status;

  return (
    <div className="flex flex-col gap-5">
      {/* Avvisi di configurazione (SMTP / migrazione) */}
      {!s.smtpConfigured && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200">
          <p className="font-mono text-[0.7rem] leading-relaxed tracking-wide">
            ⚠️ Il servizio di posta non è ancora configurato. Puoi impostare tutto, ma le email
            partiranno davvero solo dopo aver collegato un servizio SMTP (es. Brevo) su Render.
          </p>
        </div>
      )}
      {!s.consentMigrated && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-200">
          <p className="font-mono text-[0.7rem] leading-relaxed tracking-wide">
            ⚠️ Database non ancora aggiornato per le campagne. Esegui <b>add-marketing.sql</b> su Supabase.
          </p>
        </div>
      )}

      {/* Numeri principali */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <Stat label="Iscritti (consenso)" value={s.recipients} accent />
        <Stat label="Offerte attive" value={s.offers} />
        <Stat label="Ultimo invio" value={fmtDate(s.lastSentAt)} />
        <Stat label="Prossimo (auto)" value={s.autoEnabled ? fmtDate(s.nextSendAt) : "—"} />
      </div>

      {/* Stato posta */}
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-elevated px-4 py-3">
        <span
          className={
            "inline-block h-2.5 w-2.5 shrink-0 rounded-full " +
            (s.smtpConfigured ? "bg-volt" : "bg-amber-400")
          }
        />
        <p className="text-muted font-mono text-[0.7rem] tracking-wide">
          Servizio di posta:{" "}
          <span className={s.smtpConfigured ? "text-volt" : "text-amber-300"}>
            {s.smtpConfigured ? "collegato e pronto" : "non ancora configurato"}
          </span>
        </p>
      </div>

      {/* Impostazioni invio automatico */}
      <div className="rounded-2xl border border-line bg-elevated p-5">
        <h3 className="font-display text-xl text-bone">Invio automatico</h3>
        <p className="text-muted mt-1 text-sm">
          Manda da solo l'email con le offerte ogni tot giorni che scegli tu.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <label className="eyebrow mb-1.5 block text-[0.6rem]">Ogni quanti giorni</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="365"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-24 rounded-xl border border-line bg-ink px-3 py-2.5 text-center font-mono text-bone outline-none focus:border-volt/60"
              />
              <button
                onClick={saveDays}
                disabled={savingCfg}
                className="rounded-xl border border-volt/50 bg-volt/10 px-4 py-2.5 font-mono text-xs tracking-wider text-volt uppercase transition-colors hover:border-volt disabled:opacity-40"
              >
                {savingCfg ? "…" : "Salva"}
              </button>
            </div>
          </div>

          <div className="sm:ml-auto">
            <label className="eyebrow mb-1.5 block text-[0.6rem]">Automatico</label>
            <button
              onClick={toggleAuto}
              disabled={togglingAuto}
              className={
                "rounded-full px-5 py-2.5 font-mono text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-40 " +
                (s.autoEnabled
                  ? "border border-volt/50 bg-volt/10 text-volt"
                  : "border border-line text-muted hover:text-bone")
              }
            >
              {togglingAuto ? "…" : s.autoEnabled ? "● Attivo" : "○ Spento"}
            </button>
          </div>
        </div>

        {s.autoEnabled && (
          <p className="text-faint mt-3 font-mono text-[0.62rem] leading-relaxed">
            Nota: l'invio automatico ha bisogno di un "promemoria" esterno (cron-job.org) che ogni
            giorno chiama il backend. Le istruzioni sono nella guida.
          </p>
        )}
      </div>

      {/* Invio manuale */}
      <div className="rounded-2xl border border-line bg-elevated p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl text-bone">Invia ora</h3>
            <p className="text-muted mt-1 text-sm">
              Manda subito l'email con le offerte del momento a {s.recipients}{" "}
              {s.recipients === 1 ? "cliente" : "clienti"}.
            </p>
          </div>
          <button
            onClick={sendNow}
            disabled={sending}
            className="rounded-full bg-volt px-6 py-3 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-50"
          >
            {sending ? "Invio…" : "✉ Invia ora"}
          </button>
        </div>

        {feedback && (
          <p
            className={
              "mt-4 rounded-xl border px-4 py-2.5 text-center font-mono text-[0.7rem] leading-relaxed " +
              (feedback.ok
                ? "border-volt/40 bg-volt/10 text-volt"
                : "border-red-500/40 bg-red-500/10 text-red-300")
            }
          >
            {feedback.text}
          </p>
        )}
      </div>

      {/* Anteprima offerte che entreranno nell'email */}
      <div className="rounded-2xl border border-line bg-elevated p-5">
        <h3 className="font-display text-xl text-bone">Offerte nell'email</h3>
        <p className="text-muted mt-1 text-sm">
          L'email si compone da sola con questi prodotti in sconto.
        </p>
        {s.products.length === 0 ? (
          <p className="text-faint mt-4 font-mono text-xs">
            Nessun prodotto in sconto. Aggiungi uno sconto da "Prodotti & giacenza".
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {s.products.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink px-4 py-2.5"
              >
                <span className="min-w-0 truncate text-bone">
                  {p.name} <span className="text-muted">· {p.color}</span>
                </span>
                <span className="shrink-0 font-mono text-xs">
                  <span className="text-faint line-through">{formatEuro(p.price)} €</span>{" "}
                  <span className="text-volt">{formatEuro(p.salePrice)} €</span>{" "}
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
                    −{p.off}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storico invii */}
      <div className="rounded-2xl border border-line bg-elevated p-5">
        <h3 className="font-display text-xl text-bone">Ultimi invii</h3>
        {s.recentSends.length === 0 ? (
          <p className="text-faint mt-3 font-mono text-xs">Ancora nessun invio.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {s.recentSends.map((r, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-ink px-4 py-2.5"
              >
                <span className="min-w-0 truncate text-sm text-bone">{r.subject || "Email offerte"}</span>
                <span className="text-faint shrink-0 font-mono text-[0.62rem] tracking-wide">
                  {fmtDateTime(r.createdAt)} · {r.recipients}{" "}
                  {r.recipients === 1 ? "destinatario" : "destinatari"} ·{" "}
                  {r.trigger === "auto" ? "automatico" : "manuale"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
