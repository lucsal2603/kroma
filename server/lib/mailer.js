// Invio email tramite SMTP (nodemailer).
// Se le variabili SMTP non sono configurate, va in "modalità sviluppo":
// non invia nulla ma stampa l'email in console (utile per leggere il token reset).
import "dotenv/config";
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = "KROMA <no-reply@kroma.dev>",
} = process.env;

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Invia un'email. In dev (SMTP non configurato) la stampa in console.
 * @param {{to:string, subject:string, html:string, text?:string}} msg
 */
export async function sendMail({ to, subject, html, text }) {
  if (!smtpConfigured) {
    console.log("\n📧 [DEV] Email non inviata (SMTP non configurato). Anteprima:");
    console.log("   To:     ", to);
    console.log("   Subject:", subject);
    if (text) console.log("   Text:   ", text);
    console.log("   (configura SMTP_HOST/SMTP_USER/SMTP_PASS in .env per l'invio reale)\n");
    return { delivered: false, dev: true };
  }

  const info = await transporter.sendMail({ from: MAIL_FROM, to, subject, html, text });
  return { delivered: true, messageId: info.messageId };
}

export { smtpConfigured };
