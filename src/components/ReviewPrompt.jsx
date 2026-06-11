import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../lib/gsap";
import { api } from "../lib/api";

// Una volta a sessione, dopo che il cliente aggiunge un prodotto al carrello,
// chiediamo una valutazione del sito (1-5 stelle) + un commento facoltativo.
const DONE_KEY = "kroma-review-asked";

export default function ReviewPrompt() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const panel = useRef(null);
  const backdrop = useRef(null);

  // Già chiesto in questa sessione? Allora non lo rimostriamo.
  const alreadyAsked = () => {
    try {
      return Boolean(sessionStorage.getItem(DONE_KEY));
    } catch {
      return false;
    }
  };
  const markAsked = () => {
    try {
      sessionStorage.setItem(DONE_KEY, "1");
    } catch {
      /* sessionStorage non disponibile: pazienza */
    }
  };

  // Ascolta l'aggiunta al carrello.
  useEffect(() => {
    let timer;
    const onAdded = () => {
      if (alreadyAsked()) return;
      timer = setTimeout(() => setOpen(true), 1100);
    };
    window.addEventListener("kroma:added-to-cart", onAdded);
    return () => {
      window.removeEventListener("kroma:added-to-cart", onAdded);
      clearTimeout(timer);
    };
  }, []);

  // Animazione di entrata + chiusura con Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ctx;
    if (!reduce) {
      ctx = gsap.context(() => {
        gsap.from(backdrop.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
        gsap.from(panel.current, { yPercent: 6, opacity: 0, duration: 0.5, ease: "expo.out" });
      });
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    markAsked();
    setOpen(false);
  };

  const submit = async () => {
    if (sending || rating < 1) return;
    setSending(true);
    setError("");
    try {
      await api.submitReview({ rating, comment: comment.trim() });
      markAsked();
      setDone(true);
      setTimeout(() => setOpen(false), 1900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const shown = hover || rating;

  return createPortal(
    <div className="fixed inset-0 z-[97] flex items-center justify-center p-4">
      <div
        ref={backdrop}
        onClick={close}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={panel}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-elevated p-8"
      >
        <button
          onClick={close}
          aria-label="Chiudi"
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-line text-bone transition-colors hover:border-bone/40"
        >
          ✕
        </button>

        {done ? (
          // Ringraziamento dopo l'invio.
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-5xl">🦈</span>
            <h2 className="font-display text-2xl tracking-[0.08em] text-bone">Grazie!</h2>
            <p className="text-muted text-sm">La tua opinione ci aiuta a migliorare KROMA.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="text-3xl">🌊</span>
              <h2 className="mt-3 font-display text-2xl tracking-[0.08em] text-bone">
                Com'è andata?
              </h2>
              <p className="text-muted mt-1 text-sm">
                Dai un voto alla tua esperienza sul sito.
              </p>
            </div>

            {/* Stelle 1-5 */}
            <div className="mb-5 flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${n} ${n === 1 ? "stella" : "stelle"}`}
                  className="text-4xl leading-none transition-transform duration-150 hover:scale-110"
                >
                  <span className={n <= shown ? "text-volt" : "text-line"}>★</span>
                </button>
              ))}
            </div>

            {/* Commento facoltativo */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Raccontaci la tua esperienza (facoltativo)…"
              className="mb-4 w-full resize-none rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-bone placeholder:text-faint transition-colors duration-300 focus:border-volt/60 focus:outline-none"
            />

            {error && (
              <p className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center font-mono text-[0.7rem] leading-relaxed tracking-wide text-red-300">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={sending || rating < 1}
              className="anim-glow w-full rounded-full bg-volt py-4 font-mono text-sm font-bold tracking-wider text-black uppercase transition-transform duration-300 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Invio…" : "Invia valutazione"}
            </button>

            <button
              type="button"
              onClick={close}
              className="mt-3 w-full font-mono text-[0.68rem] tracking-wider text-muted uppercase transition-colors hover:text-bone"
            >
              No grazie
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
