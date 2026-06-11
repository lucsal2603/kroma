// Stato dello sconto di benvenuto lato client (solo per MOSTRARLO).
// L'importo reale è sempre ricalcolato e forzato dal server.
//
// `user`   -> oggetto utente ({ created_at, welcome_used }) o null
// `config` -> { percent, hours } da /welcome-config
export function welcomeState(user, config) {
  const percent = Number(config?.percent) || 0;
  const hours = Number(config?.hours) || 0;
  const off = { percent, eligible: false, msLeft: 0 };

  if (!user || percent <= 0 || hours <= 0) return off;
  // welcome_used deve essere ESPLICITAMENTE false. Se è undefined (colonna non
  // ancora migrata) lo trattiamo come "non idoneo", così il totale mostrato
  // resta allineato a quello che il server applica davvero (0% di sconto).
  if (user.welcome_used !== false) return off;

  const created = new Date(user.created_at).getTime();
  if (!Number.isFinite(created)) return off;

  const msLeft = created + hours * 3600 * 1000 - Date.now();
  return { percent, eligible: msLeft > 0, msLeft: Math.max(0, msLeft) };
}

// Arrotonda a 2 decimali come fa il server (round2).
export function applyDiscount(subtotal, percent) {
  const discount = Math.round((subtotal * percent) / 100 * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  return { discount, total };
}

// Converte i millisecondi rimasti in "HH:MM:SS".
export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
