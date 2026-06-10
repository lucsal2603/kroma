// Notifica Telegram al titolare (es. nuovo ordine).
// Se TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID non sono configurati, logga in console.
import "dotenv/config";

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
const configured = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

/**
 * Invia un messaggio Telegram. Non lancia: in caso di errore logga soltanto,
 * così un problema di notifica non blocca mai un ordine andato a buon fine.
 * @param {string} text  Testo (supporta HTML di Telegram)
 */
export async function sendTelegram(text) {
  if (!configured) {
    console.log("\n📨 [DEV] Telegram non configurato. Messaggio che avrei inviato:\n" + text + "\n");
    return { delivered: false, dev: true };
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) {
      console.error("Telegram error:", r.status, await r.text());
      return { delivered: false };
    }
    return { delivered: true };
  } catch (err) {
    console.error("Telegram exception:", err.message);
    return { delivered: false };
  }
}

export { configured as telegramConfigured };
