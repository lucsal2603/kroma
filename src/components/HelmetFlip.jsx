import { useEffect, useRef, useState } from "react";

// Mostra una o più foto del prodotto e le alterna in dissolvenza ogni
// `interval` ms (animazione automatica). Accetta:
//   - `images`: elenco di foto (più di due) → ruota tra tutte;
//   - in alternativa `front`/`back` (compatibilità coi caschi: 2 viste).
// `offset` sfasa l'avvio così più prodotti non girano tutti insieme.
// Con `controls` aggiunge frecce + pallini per cambiare foto a mano: al click
// l'animazione si ferma e riparte dopo 5s di inattività.
// Con prefers-reduced-motion resta fermo sulla prima foto.
export default function HelmetFlip({
  front,
  back,
  images,
  alt = "",
  className = "",
  imgClass = "",
  interval = 3500,
  offset = 0,
  controls = false,
}) {
  const frames = images && images.length ? images : [front, back].filter(Boolean);
  const multi = frames.length > 1;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeRef = useRef(null);
  const dragRef = useRef({ x: 0, active: false, used: false });

  // Riparte dalla prima foto se cambia il set (es. cambio colore casco).
  useEffect(() => {
    setIdx(0);
  }, [frames.length, frames[0]]);

  // Auto-rotazione: attiva solo con più foto e quando non è in pausa.
  useEffect(() => {
    if (!multi || paused) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let id;
    const startTimer = setTimeout(() => {
      id = setInterval(() => setIdx((i) => (i + 1) % frames.length), interval);
    }, offset + interval);
    return () => {
      clearTimeout(startTimer);
      clearInterval(id);
    };
  }, [interval, offset, multi, paused, frames.length]);

  useEffect(() => () => clearTimeout(resumeRef.current), []);

  // Cambio manuale (frecce / trascinamento): mette in pausa e riprende dopo 5s.
  const step = (dir) => {
    setIdx((i) => (i + dir + frames.length) % frames.length);
    setPaused(true);
    clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => setPaused(false), 5000);
  };

  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, active: true, used: false };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active || d.used) return;
    if (Math.abs(e.clientX - d.x) > 40) {
      step(e.clientX < d.x ? 1 : -1);
      d.used = true;
    }
  };
  const endDrag = () => {
    dragRef.current.active = false;
  };

  const dragProps = controls && multi
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerLeave: endDrag,
        onPointerCancel: endDrag,
      }
    : {};

  if (!frames.length) return <div className={className} />;

  return (
    <div
      {...dragProps}
      className={
        "relative " +
        (controls && multi ? "cursor-grab touch-pan-y select-none active:cursor-grabbing " : "") +
        className
      }
    >
      {frames.map((src, i) => (
        <img
          key={i}
          src={src}
          alt={alt}
          draggable={false}
          className={
            "absolute inset-0 transition-[opacity,transform] duration-700 ease-in-out " +
            (i === idx ? "opacity-100" : "opacity-0") + " " + imgClass
          }
        />
      ))}

      {controls && multi && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Foto precedente"
            className="group/arrow absolute top-1/2 left-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-1/2 hover:border-ink hover:bg-ink hover:text-volt hover:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.55)] active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover/arrow:-translate-x-0.5">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Foto successiva"
            className="group/arrow absolute top-1/2 right-4 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:translate-x-0.5 hover:-translate-y-1/2 hover:border-ink hover:bg-ink hover:text-volt hover:shadow-[0_10px_30px_-6px_rgba(0,0,0,0.55)] active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover/arrow:translate-x-0.5">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 backdrop-blur-md">
            {frames.map((_, i) => (
              <span
                key={i}
                className={"h-1.5 rounded-full transition-all duration-300 " + (i === idx ? "w-4 bg-ink" : "w-1.5 bg-ink/25")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
