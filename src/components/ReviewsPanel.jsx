import { useEffect, useState } from "react";
import { api } from "../lib/api";

const fmt = (iso) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Stelline piene/vuote per un voto.
function Stars({ value }) {
  return (
    <span className="font-mono text-base leading-none tracking-tight" aria-label={`${value} su 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "text-volt" : "text-line"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ReviewsPanel() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { reviews: r, viewerIsOwner } = await api.getReviews();
        if (active) {
          setReviews(r || []);
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

  const deleteOne = async (id) => {
    if (deletingId) return;
    setDeletingId(id);
    setError("");
    try {
      await api.deleteReview(id);
      setReviews((list) => list.filter((r) => r.id !== id));
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
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Carico le recensioni…</p>
      </div>
    );
  }

  if (error && reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-sm text-red-300">
        {error}
      </p>
    );
  }

  // Media voti.
  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Riepilogo in alto: media + numero recensioni. */}
      {reviews.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-elevated p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl text-volt">{avg}</span>
            <div>
              <Stars value={Math.round(Number(avg))} />
              <p className="text-faint mt-1 font-mono text-[0.62rem] tracking-wide">
                media su {reviews.length} {reviews.length === 1 ? "recensione" : "recensioni"}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-center font-mono text-[0.7rem] text-red-300">
          {error}
        </p>
      )}

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="text-4xl">⭐</span>
          <p className="text-muted text-sm">Nessuna recensione, per ora.</p>
          <p className="text-faint font-mono text-[0.62rem] tracking-wide">
            Appariranno qui appena i clienti valuteranno l'esperienza sul sito.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-start gap-3 rounded-2xl border border-line bg-elevated p-3 sm:p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="text-bone text-sm font-semibold">
                    {r.username || "Ospite"}
                  </span>
                </div>
                {r.comment && (
                  <p className="text-muted mt-1.5 text-sm leading-relaxed break-words">{r.comment}</p>
                )}
                <p className="text-faint mt-1.5 font-mono text-[0.62rem] tracking-wide">{fmt(r.createdAt)}</p>
              </div>
              {isOwner && (
                <button
                  onClick={() => deleteOne(r.id)}
                  disabled={deletingId === r.id}
                  aria-label="Cancella questa recensione"
                  title="Cancella questa recensione"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                >
                  {deletingId === r.id ? "…" : "🗑"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
