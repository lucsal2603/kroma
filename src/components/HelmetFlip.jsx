import { useEffect, useRef, useState } from "react";

// Mostra il casco e alterna in dissolvenza vista davanti ⇄ dietro ogni `interval` ms.
// `offset` sfasa l'avvio così più caschi non girano tutti insieme.
// Con `controls` aggiunge due frecce (sinistra/destra) per cambiare angolazione a mano:
// al click l'animazione si ferma e riparte solo dopo 5s di inattività.
// Con prefers-reduced-motion resta fermo sulla vista frontale.
export default function HelmetFlip({
  front,
  back,
  alt = "",
  className = "",
  imgClass = "",
  interval = 3500,
  offset = 0,
  controls = false,
}) {
  const [showBack, setShowBack] = useState(false);
  const [paused, setPaused] = useState(false);
  const resumeRef = useRef(null);
  const dragRef = useRef({ x: 0, active: false, used: false });

  // Auto-flip: attivo solo quando non è in pausa (e c'è una vista posteriore).
  useEffect(() => {
    if (!back || paused) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let id;
    // Resta sulla vista frontale per `interval` (+ `offset` di sfasamento) prima
    // del primo giro: così al cambio colore non scatta subito alla vista dietro.
    const startTimer = setTimeout(() => {
      id = setInterval(() => setShowBack((b) => !b), interval);
    }, offset + interval);
    return () => {
      clearTimeout(startTimer);
      clearInterval(id);
    };
  }, [interval, offset, back, paused]);

  useEffect(() => () => clearTimeout(resumeRef.current), []);

  // Click manuale: alterna davanti⇄dietro in loop (le frecce non si bloccano mai),
  // mette in pausa e programma la ripresa automatica dopo 5s di inattività.
  const manual = () => {
    setShowBack((b) => !b);
    setPaused(true);
    clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => setPaused(false), 5000);
  };

  // Trascinamento (mouse su PC, dito su telefono): tieni premuto e scorri in
  // orizzontale per cambiare angolazione. Un solo cambio per gesto.
  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, active: true, used: false };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active || d.used) return;
    if (Math.abs(e.clientX - d.x) > 40) {
      manual();
      d.used = true;
    }
  };
  const endDrag = () => {
    dragRef.current.active = false;
  };

  const dragProps = controls && back
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerLeave: endDrag,
        onPointerCancel: endDrag,
      }
    : {};

  return (
    <div
      {...dragProps}
      className={
        "relative " +
        (controls && back ? "cursor-grab touch-pan-y select-none active:cursor-grabbing " : "") +
        className
      }
    >
      <img
        src={front}
        alt={alt}
        draggable={false}
        className={
          "absolute inset-0 transition-[opacity,transform] duration-700 ease-in-out " +
          (showBack ? "opacity-0" : "opacity-100") + " " + imgClass
        }
      />
      {back && (
        <img
          src={back}
          alt={alt}
          draggable={false}
          className={
            "absolute inset-0 transition-[opacity,transform] duration-700 ease-in-out " +
            (showBack ? "opacity-100" : "opacity-0") + " " + imgClass
          }
        />
      )}

      {controls && back && (
        <>
          <button
            type="button"
            onClick={manual}
            aria-label="Gira il casco"
            className="group/arrow absolute top-1/2 left-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-1/2 hover:border-ink hover:bg-ink hover:text-volt hover:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.55)] active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover/arrow:-translate-x-0.5">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={manual}
            aria-label="Gira il casco"
            className="group/arrow absolute top-1/2 right-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:translate-x-0.5 hover:-translate-y-1/2 hover:border-ink hover:bg-ink hover:text-volt hover:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.55)] active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover/arrow:translate-x-0.5">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 font-mono text-[0.58rem] tracking-[0.18em] text-ink/70 uppercase backdrop-blur-md">
            <span className={"h-1.5 rounded-full transition-all duration-300 " + (showBack ? "w-1.5 bg-ink/25" : "w-4 bg-ink")} />
            <span>{showBack ? "Dietro" : "Davanti"}</span>
            <span className={"h-1.5 rounded-full transition-all duration-300 " + (showBack ? "w-4 bg-ink" : "w-1.5 bg-ink/25")} />
          </div>
        </>
      )}
    </div>
  );
}
