// Mark KROMA: dome del casco con visiera teal. L'outline eredita currentColor
// (così funziona su scuro, su chiaro e in versione avatar), la visiera usa il
// token --color-chrome. Disegnato sul viewBox 0 0 64 60 del logo originale.
export function Mark({ className = "h-8 w-8", visor = "var(--color-chrome)" }) {
  return (
    <svg
      viewBox="0 0 64 60"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      {/* dome del casco */}
      <path
        d="M6 30 A26 26 0 0 1 58 30 L58 48 Q58 54 52 54 L12 54 Q6 54 6 48 Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* visiera */}
      <rect x="18" y="27.5" width="30" height="11" rx="5.5" fill={visor} />
      {/* mentoniera */}
      <path
        d="M15 45 L24 45"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Logo({
  className = "",
  markClass = "h-8 w-8",
  textClass = "text-2xl",
  visor,
}) {
  return (
    <span className={"inline-flex items-center gap-2.5 text-bone " + className}>
      <Mark className={markClass} visor={visor} />
      <span className={"font-display tracking-[0.22em] " + textClass}>KROMA</span>
    </span>
  );
}
