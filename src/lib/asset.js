// Risolve i percorsi degli asset rispetto al base di Vite.
// In locale BASE_URL è "/", su GitHub Pages è "/kroma/".
export const asset = (p) => import.meta.env.BASE_URL + String(p).replace(/^\//, "");
