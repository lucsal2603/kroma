import { useEffect, useRef } from "react";

// Porta in React l'effetto "lente" del prototipo caschi-reveal:
// base = sottocasco, il casco viene rivelato dalla scia del mouse su un canvas
// con compositing GPU (destination-in / destination-out).
// Raggio del reveal proporzionale allo schermo (frazione del lato minore),
// con un minimo/massimo per restare sensato su mobile e su monitor grandi.
const RADIUS_RATIO = 0.22;
const RADIUS_MIN = 110;
const RADIUS_MAX = 320;
const FADE_SPEED = 0.05;  // la scia dietro al cursore si chiude in fretta
const FADE_OUT = 0.2;     // appena fermi/usciti il casco sparisce veloce
const TAIL_MS = 900;      // durata dissolvenza dopo l'uscita, poi pulizia completa
const WOBBLE_AMP = 0.34;  // quanto si spostano i vertici (frazione della cella)
const WOBBLE_SPEED = 4.2; // velocità del movimento continuo dei triangoli
const FIT = { scale: 1.0, x: 0, y: 0 };

export default function HelmetReveal({ fill = false, hideHint = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d");
    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const helmet = new Image();
    helmet.src = "/img/casco-oro.png";

    let W = 0, H = 0, radius = RADIUS_MIN, fade = FADE_SPEED;
    let curX = 0, curY = 0;
    let active = false, running = false, lastActive = 0;
    let rafId = 0;
    // mesh di "pezzi": triangoli con vertici jitterati. Ogni pezzo ha un'opacità che
    // sale a 1 quando il cursore è vicino e cala da sola: la zona rivelata segue le
    // sfaccettature del casco invece di essere un cerchio liscio. I vertici interni si
    // muovono di continuo (onde sfasate) così i triangoli vibrano e danno senso di velocità.
    let tris = [], verts = [], triA = new Float32Array(0), amp = 0;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = mask.width = Math.round(W * dpr);
      canvas.height = mask.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.lineJoin = "round";
      mctx.lineWidth = 1.2; // sigilla le fughe tra i triangoli
      radius = Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Math.min(W, H) * RADIUS_RATIO));
      buildMesh();
    };

    // disegna il casco con logica "cover" (come object-cover della base): le due
    // immagini hanno le stesse dimensioni, così restano allineate a ogni formato.
    const drawHelmet = () => {
      const iw = helmet.naturalWidth || W;
      const ih = helmet.naturalHeight || H;
      const scale = Math.max(W / iw, H / ih) * FIT.scale;
      const dw = iw * scale, dh = ih * scale;
      const dx = (W - dw) / 2 + FIT.x * W;
      const dy = (H - dh) / 2 + FIT.y * H;
      ctx.drawImage(helmet, dx, dy, dw, dh);
    };

    // costruisce la mesh di triangoli che copre il canvas (bordi non jitterati, così
    // copre tutto). (r+c) alterna la diagonale dei quad per non sembrare una griglia.
    const buildMesh = () => {
      const cell = Math.max(42, Math.min(W, H) / 15);
      amp = cell * WOBBLE_AMP;
      const cols = Math.ceil(W / cell) + 1;
      const rows = Math.ceil(H / cell) + 1;
      const j = cell * 0.7;
      const pts = [];
      verts = [];
      for (let r = 0; r <= rows; r++) {
        pts[r] = [];
        for (let c = 0; c <= cols; c++) {
          const edge = r === 0 || c === 0 || r === rows || c === cols;
          const bx = c * cell + (edge ? 0 : (Math.random() - 0.5) * j);
          const by = r * cell + (edge ? 0 : (Math.random() - 0.5) * j);
          // bx/by = posizione base; x/y = posizione animata; ph = fase dell'onda
          const p = { bx, by, x: bx, y: by, ph: Math.random() * Math.PI * 2, edge };
          pts[r][c] = p;
          if (!edge) verts.push(p); // i bordi restano fermi per coprire tutto il canvas
        }
      }
      tris = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c], e = pts[r + 1][c + 1];
          if ((r + c) & 1) tris.push([a, b, e], [a, e, d]);
          else tris.push([a, b, d], [b, e, d]);
        }
      }
      triA = new Float32Array(tris.length);
    };

    const loop = () => {
      const decay = active ? fade : FADE_OUT;
      const r2 = radius * radius;
      // i vertici interni si muovono di continuo (anche a mouse fermo): i triangoli
      // vibrano/scorrono e danno senso di velocità
      const t = performance.now() * 0.001;
      for (let i = 0; i < verts.length; i++) {
        const p = verts[i];
        p.x = p.bx + Math.sin(t * WOBBLE_SPEED + p.ph) * amp;
        p.y = p.by + Math.cos(t * WOBBLE_SPEED * 0.8 + p.ph * 1.3) * amp;
      }
      // ogni pezzo cala da solo (anche a mouse fermo); quelli entro il raggio del cursore
      // tornano pieni: la zona rivelata segue i pezzi del casco, bordi sfaccettati non tondi
      mctx.clearRect(0, 0, W, H);
      for (let i = 0; i < tris.length; i++) {
        const tr = tris[i];
        const cx = (tr[0].x + tr[1].x + tr[2].x) / 3;
        const cy = (tr[0].y + tr[1].y + tr[2].y) / 3;
        let al = triA[i] - decay;
        if (active) {
          const dx = cx - curX, dy = cy - curY;
          if (dx * dx + dy * dy < r2) al = 1;
        }
        if (al < 0) al = 0;
        triA[i] = al;
        if (al <= 0.01) continue;
        mctx.fillStyle = mctx.strokeStyle = "rgba(255,255,255," + al + ")";
        mctx.beginPath();
        mctx.moveTo(tr[0].x, tr[0].y);
        mctx.lineTo(tr[1].x, tr[1].y);
        mctx.lineTo(tr[2].x, tr[2].y);
        mctx.closePath();
        mctx.fill();
        mctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      drawHelmet();
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, 0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      if (active || performance.now() - lastActive < TAIL_MS) {
        rafId = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, W, H);
        mctx.clearRect(0, 0, W, H);
        triA.fill(0);
        running = false;
      }
    };

    const ensureLoop = () => {
      if (!running) { running = true; rafId = requestAnimationFrame(loop); }
    };

    const setPos = (e) => {
      const r = wrap.getBoundingClientRect();
      curX = e.clientX - r.left;
      curY = e.clientY - r.top;
    };

    const startFadeOut = () => {
      active = false;
      lastActive = performance.now();
      wrap.classList.remove("is-hovering");
    };

    const onMove = (e) => {
      setPos(e);
      active = true;
      lastActive = performance.now();
      wrap.classList.add("is-hovering");
      ensureLoop();
    };

    const onLeave = () => startFadeOut();

    helmet.onload = () => {
      resize();
      if (window.matchMedia("(hover: none)").matches) drawHelmet();
    };

    const onResize = () => resize();
    resize();
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={
        "reveal group select-none " +
        (fill
          ? "absolute inset-0 h-full w-full overflow-hidden"
          : "relative w-full overflow-hidden rounded-2xl")
      }
      style={fill ? undefined : { aspectRatio: "1408 / 768" }}
    >
      <img
        src="/img/sottocasco.png"
        alt="Modello KROMA con sottocasco"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {!hideHint && (
        <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-2 font-mono text-[0.7rem] tracking-[0.16em] text-bone/80 uppercase backdrop-blur-sm transition-opacity duration-300 group-[.is-hovering]:opacity-0">
          🦈 Muovi il mouse · indossa il casco 🏴‍☠️
        </span>
      )}
    </div>
  );
}
