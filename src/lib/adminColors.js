// Colore fisso per ogni admin: lo stesso nome → sempre lo stesso colore.
// Il proprietario (lukesalvemini@gmail.com) ha il giallo riservato; gli altri
// pescano da una palette che il giallo non lo contiene, così resta unico suo.
// Condiviso tra Registro attività e lista Iscritti per restare coerente.
export const OWNER_COLOR = "#facc15"; // giallo (riservato al proprietario)

export const NAME_COLORS = [
  "#7dd3fc", // azzurro
  "#f0abfc", // rosa
  "#86efac", // verde
  "#fca5a5", // rosso tenue
  "#c4b5fd", // viola
  "#fdba74", // arancio
  "#5eead4", // turchese
];

export const colorForName = (name, isOwner) => {
  if (isOwner) return OWNER_COLOR;
  const s = String(name || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};
