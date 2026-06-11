import { useEffect, useState } from "react";
import { api } from "../lib/api";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : "—";

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { users: u } = await api.getUsers();
        if (active) setUsers(u || []);
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
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico gli iscritti…</p>
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

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="text-4xl">🦈</span>
        <p className="text-muted text-sm">Nessun iscritto, per ora.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-faint font-mono text-[0.62rem] tracking-wide">
        {users.length} {users.length === 1 ? "iscritto" : "iscritti"} · l'email è mostrata oscurata per
        privacy.
      </p>
      {users.map((u, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-elevated p-3 sm:p-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-ink font-display text-base text-bone uppercase">
            {(u.username || "?").slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-base text-bone sm:text-lg">{u.username}</span>
              {u.isAdmin && (
                <span className="shrink-0 rounded-full border border-volt/50 bg-volt/10 px-2 py-0.5 font-mono text-[0.55rem] tracking-[0.16em] text-volt uppercase">
                  Admin
                </span>
              )}
            </div>
            <div className="text-faint truncate font-mono text-[0.65rem] tracking-wide">{u.email}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {u.subscribed === true && (
              <span className="rounded-full border border-volt/40 bg-volt/10 px-2.5 py-1 font-mono text-[0.55rem] tracking-wider text-volt uppercase">
                ✉ Iscritto
              </span>
            )}
            {u.subscribed === false && (
              <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.55rem] tracking-wider text-muted uppercase">
                no email
              </span>
            )}
            <span className="text-faint hidden font-mono text-[0.6rem] tracking-wide sm:inline">
              {fmtDate(u.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
