// Notifica Telegram al titolare (es. nuovo ordine).
// Se TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID non sono configurati, logga in console.
// TELEGRAM_CHAT_ID può contenere più destinatari separati da virgola,
// es. "788505321,205811619": il messaggio viene inviato a tutti.
import "dotenv/config";

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

// Lista dei destinatari (uno o più id separati da virgola).
const CHAT_IDS = String(TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const configured = Boolean(TELEGRAM_BOT_TOKEN && CHAT_IDS.length);

// Invia il testo a un singolo destinatario.
async function sendToChat(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) {
      console.error(`Telegram error (chat ${chatId}):`, r.status, await r.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Telegram exception (chat ${chatId}):`, err.message);
    return false;
  }
}

/**
 * Invia un messaggio Telegram a tutti i destinatari configurati.
 * Non lancia: in caso di errore logga soltanto, così un problema di
 * notifica non blocca mai un ordine andato a buon fine.
 * @param {string} text  Testo (supporta HTML di Telegram)
 */
export async function sendTelegram(text) {
  if (!configured) {
    console.log("\n📨 [DEV] Telegram non configurato. Messaggio che avrei inviato:\n" + text + "\n");
    return { delivered: false, dev: true };
  }
  const results = await Promise.all(CHAT_IDS.map((id) => sendToChat(id, text)));
  return { delivered: results.some(Boolean) };
}

export { configured as telegramConfigured };
