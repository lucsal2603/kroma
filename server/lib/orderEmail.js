// Template e invio dell'email di conferma ordine al cliente.
import { sendMail } from "./mailer.js";

const euro = (n) => "€ " + Number(n).toFixed(2).replace(".", ",");

/**
 * Costruisce l'HTML della conferma ordine.
 * @param {{id:string, total:number, items:Array, customerName?:string}} order
 */
export function renderOrderEmail({ id, total, items, customerName }) {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee">
          <strong>${i.name}</strong> <span style="color:#888">· ${i.color} · taglia ${i.size}</span><br>
          <span style="color:#888;font-size:13px">${i.quantity} × ${euro(i.price)}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${euro(i.subtotal)}</td>
      </tr>`
    )
    .join("");

  const html = `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#111">
    <div style="background:#1b1b1d;color:#d7ff3e;padding:22px 24px;border-radius:12px 12px 0 0">
      <h1 style="margin:0;font-size:22px;letter-spacing:.04em">KROMA</h1>
      <p style="margin:6px 0 0;color:#cfcfcb;font-size:14px">Ordine confermato 🦈</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <p>Ciao ${customerName || ""}, grazie per il tuo ordine!</p>
      <p style="color:#888;font-size:13px">Ordine <strong>#${String(id).slice(0, 8).toUpperCase()}</strong></p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
        <tr>
          <td style="padding:14px 0 0;font-weight:700">Totale</td>
          <td style="padding:14px 0 0;text-align:right;font-weight:700">${euro(total)}</td>
        </tr>
      </table>
      <p style="color:#666;font-size:13px">Ti avviseremo appena il tuo casco sarà spedito. A presto su strada.</p>
    </div>
  </div>`;

  const text =
    `KROMA — Ordine confermato\nOrdine #${String(id).slice(0, 8).toUpperCase()}\n\n` +
    items.map((i) => `- ${i.name} (${i.color}, ${i.size}) x${i.quantity} = ${euro(i.subtotal)}`).join("\n") +
    `\n\nTotale: ${euro(total)}\nGrazie per il tuo ordine!`;

  return { html, text };
}

/** Invia l'email di conferma ordine al cliente. */
export async function sendOrderConfirmation(to, order) {
  const { html, text } = renderOrderEmail(order);
  return sendMail({
    to,
    subject: `KROMA — conferma ordine #${String(order.id).slice(0, 8).toUpperCase()}`,
    html,
    text,
  });
}
