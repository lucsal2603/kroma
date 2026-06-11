import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { formatEuro } from "../data/products";
import { colorForName } from "../lib/adminColors";

const STATUS = {
  pending: { label: "In lavorazione", cls: "border-line text-muted" },
  paid: { label: "Pagato", cls: "border-volt/50 bg-volt/10 text-volt" },
  shipped: { label: "Spedito", cls: "border-volt/50 bg-volt/10 text-volt" },
  failed: { label: "Fallito", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  cancelled: { label: "Annullato", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : "—";

// "da quanto è registrato" in parole semplici.
function since(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "da oggi";
  if (days === 1) return "da 1 giorno";
  if (days < 30) return `da ${days} giorni`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "da 1 mese" : `da ${months} mesi`;
  const years = Math.floor(days / 365);
  return years === 1 ? "da 1 anno" : `da ${years} anni`;
}

// --- Scheda dettaglio del singolo iscritto (finestra modale) ---------
function UserDetail({ userId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api.getUserDetail(userId);
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const u = data?.user;
  const isOwner = data?.viewerIsOwner;

  const toggleDisabled = async () => {
    const next = !u.disabled;
    const msg = next
      ? `Disabilitare l'account di "${u.username}"? Non potrà più accedere.`
      : `Riabilitare l'account di "${u.username}"?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setActionErr("");
    try {
      await api.setUserDisabled(u.id, next);
      setData((d) => ({ ...d, user: { ...d.user, disabled: next } }));
      onChanged?.();
    } catch (err) {
      setActionErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleAdmin = async () => {
    const next = !u.isAdmin;
    const msg = next
      ? `Rendere "${u.username}" amministratore? Avrà accesso a tutta la dashboard.`
      : `Togliere i permessi admin a "${u.username}"?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setActionErr("");
    try {
      await api.setUserAdmin(u.id, next);
      setData((d) => ({ ...d, user: { ...d.user, isAdmin: next } }));
      onChanged?.();
    } catch (err) {
      setActionErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-elevated">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-7">
          <h3 className="font-display text-2xl text-bone">Iscritto</h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
              <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico…</p>
            </div>
          ) : error ? (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-sm text-red-300">
              {error}
            </p>
          ) : (
            <>
              {/* Intestazione */}
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-ink font-display text-2xl text-bone uppercase">
                  {(u.username || "?").slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl text-bone">{u.username}</span>
                    {u.isAdmin && (
                      <span className="rounded-full border border-volt/50 bg-volt/10 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.16em] text-volt uppercase">
                        Admin
                      </span>
                    )}
                    {u.disabled && (
                      <span className="rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.16em] text-red-300 uppercase">
                        Disabilitato
                      </span>
                    )}
                  </div>
                  <div className="text-faint mt-0.5 font-mono text-[0.65rem] tracking-wide">{u.email}</div>
                </div>
              </div>

              {/* Info registrazione */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-line bg-ink p-3">
                  <p className="font-mono text-[0.55rem] tracking-wider text-muted uppercase">Registrato il</p>
                  <p className="mt-1 text-bone">{fmtDate(u.createdAt)}</p>
                  <p className="text-faint font-mono text-[0.6rem]">{since(u.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-line bg-ink p-3">
                  <p className="font-mono text-[0.55rem] tracking-wider text-muted uppercase">Campagne email</p>
                  <p className="mt-1 text-bone">
                    {u.subscribed === true ? "Iscritto" : u.subscribed === false ? "Non iscritto" : "—"}
                  </p>
                </div>
              </div>

              {/* Acquisti */}
              <div className="mt-5">
                <p className="eyebrow mb-2 text-[0.6rem]">Acquisti ({data.orders.length})</p>
                {data.orders.length === 0 ? (
                  <p className="text-faint font-mono text-xs">Nessun acquisto, per ora.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {data.orders.map((o) => {
                      const st = STATUS[o.status] || STATUS.pending;
                      return (
                        <div key={o.id} className="rounded-2xl border border-line bg-ink p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-faint font-mono text-[0.62rem] tracking-wide">
                              {fmtDate(o.createdAt)}
                            </span>
                            <span
                              className={
                                "rounded-full border px-2.5 py-0.5 font-mono text-[0.55rem] tracking-[0.12em] uppercase " +
                                st.cls
                              }
                            >
                              {st.label}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-col gap-1">
                            {o.items.map((it, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate text-bone">
                                  {it.name}{" "}
                                  <span className="text-muted">
                                    · {it.color} · {it.size} ×{it.quantity}
                                  </span>
                                </span>
                                <span className="text-muted shrink-0 font-mono text-xs">
                                  {formatEuro(it.unitPrice * it.quantity)} €
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                            <span className="text-muted font-mono text-[0.6rem] tracking-wider uppercase">Totale</span>
                            <span className="text-bone font-semibold">{formatEuro(o.total)} €</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Azioni: SOLO il proprietario può cambiare admin / disabilitare */}
        {!loading && !error && (
          <div className="border-t border-line px-5 py-4 sm:px-7">
            {actionErr && (
              <p className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-center font-mono text-[0.7rem] text-red-300">
                {actionErr}
              </p>
            )}
            {isOwner ? (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <button
                  onClick={toggleAdmin}
                  disabled={busy}
                  className="flex-1 rounded-full border border-volt/50 bg-volt/10 px-5 py-3 font-mono text-xs font-bold tracking-wider text-volt uppercase transition-colors hover:border-volt disabled:opacity-40"
                >
                  {u.isAdmin ? "☆ Togli admin" : "★ Rendi admin"}
                </button>
                <button
                  onClick={toggleDisabled}
                  disabled={busy}
                  className={
                    "flex-1 rounded-full px-5 py-3 font-mono text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-40 " +
                    (u.disabled
                      ? "border border-volt/50 bg-volt/10 text-volt hover:border-volt"
                      : "border border-red-500/50 bg-red-500/10 text-red-300 hover:border-red-500")
                  }
                >
                  {u.disabled ? "✓ Riabilita account" : "🚫 Disabilita account"}
                </button>
              </div>
            ) : (
              <p className="text-faint text-center font-mono text-[0.62rem] leading-relaxed tracking-wide">
                Solo il proprietario del sito può disabilitare un account o cambiare i permessi admin.
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// --- Riga singola: email mascherata + "mostra" + click apre il dettaglio ---
function UserRow({ user, onOpen }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reveal = async (e) => {
    e.stopPropagation();
    if (full || loading) return;
    setLoading(true);
    setError("");
    try {
      const { email } = await api.revealUserEmail(user.id);
      setFull(email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Gli admin hanno la cornice del loro colore fisso (come nel registro
  // attività); il proprietario il giallo. Gli iscritti normali restano neutri.
  const color = user.isAdmin ? colorForName(user.username, user.isOwner) : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(user.id)}
      className={
        "flex w-full flex-wrap items-center gap-3 rounded-2xl border bg-elevated p-3 text-left transition-colors sm:p-4 " +
        (color ? "" : "border-line hover:border-volt/40")
      }
      style={color ? { borderColor: color + "66", backgroundColor: color + "0d" } : undefined}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-ink font-display text-base text-bone uppercase"
        style={color ? { borderColor: color + "66", color } : undefined}
      >
        {(user.username || "?").slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base text-bone sm:text-lg">{user.username}</span>
          {user.isAdmin && (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.16em] uppercase"
              style={{ color, borderColor: color + "80", backgroundColor: color + "1f" }}
            >
              Admin
            </span>
          )}
          {user.disabled && (
            <span className="shrink-0 rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.16em] text-red-300 uppercase">
              Bloccato
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={"truncate font-mono text-[0.65rem] tracking-wide " + (full ? "text-bone" : "text-faint")}>
            {error ? error : full || user.email}
          </span>
          {!full && !error && (
            <span
              role="button"
              tabIndex={0}
              onClick={reveal}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && reveal(e)}
              className="shrink-0 cursor-pointer font-mono text-[0.58rem] tracking-wider text-muted uppercase underline transition-colors hover:text-volt"
            >
              {loading ? "…" : "mostra"}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {user.subscribed === true && (
          <span className="rounded-full border border-volt/40 bg-volt/10 px-2.5 py-1 font-mono text-[0.55rem] tracking-wider text-volt uppercase">
            ✉ Iscritto
          </span>
        )}
        {user.subscribed === false && (
          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.55rem] tracking-wider text-muted uppercase">
            no email
          </span>
        )}
        <span className="text-faint font-mono text-base sm:hidden">›</span>
      </div>
    </button>
  );
}

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState("");

  const load = async (term = q) => {
    setLoading(true);
    setError("");
    try {
      const { users: u } = await api.getUsers(term);
      setUsers(u || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ricerca "live" con un piccolo ritardo, per non chiamare il server a ogni tasto.
  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Lo spinner a tutto schermo solo al primissimo caricamento: durante la
  // ricerca teniamo a video la lista precedente (niente sfarfallio).
  const firstLoad = loading && users.length === 0 && !error;

  // Gli admin sempre in cima (prima il proprietario), poi gli iscritti normali.
  // Ordinamento stabile: a parità di ruolo resta l'ordine del server (più recenti prima).
  const rank = (u) => (u.isOwner ? 0 : u.isAdmin ? 1 : 2);
  const sorted = [...users].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="flex flex-col gap-3">
      {/* Barra di ricerca: per nome o email */}
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">🔍</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per nome o email…"
          className="w-full rounded-2xl border border-line bg-elevated py-3 pr-4 pl-11 text-bone outline-none placeholder:text-faint focus:border-volt/60"
        />
        {loading && !firstLoad && (
          <span className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-volt border-t-transparent" />
        )}
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-sm text-red-300">
          {error}
        </p>
      ) : firstLoad ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
          <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico gli iscritti…</p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="text-4xl">🦈</span>
          <p className="text-muted text-sm">
            {q ? `Nessun iscritto trovato per «${q}».` : "Nessun iscritto, per ora."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-faint font-mono text-[0.62rem] tracking-wide">
            {users.length} {users.length === 1 ? "iscritto" : "iscritti"}
            {q ? " trovati" : ""} · tocca un iscritto per i dettagli · l'email è oscurata per privacy.
          </p>
          {sorted.map((u, i) => (
            <UserRow key={u.id || i} user={u} onOpen={setSelectedId} />
          ))}
        </>
      )}

      {selectedId && (
        <UserDetail userId={selectedId} onClose={() => setSelectedId(null)} onChanged={() => load(q)} />
      )}
    </div>
  );
}
