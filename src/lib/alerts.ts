// Alertes email via Resend + Telegram optionnel. Tolerant aux pannes:
// une alerte qui echoue ne doit jamais casser un job ou un cron.

export async function sendAlert(subject: string, body: string): Promise<void> {
  await Promise.allSettled([sendResend(subject, body), sendTelegram(`${subject}\n${body}`)]);
}

async function sendResend(subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL || process.env.ALERT_EMAIL;
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Cockpit SEO <onboarding@resend.dev>",
        to: [to],
        subject,
        text: body,
      }),
      cache: "no-store",
    });
  } catch {
    // silencieux: l'alerte est best-effort
  }
}

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
      cache: "no-store",
    });
  } catch {
    // silencieux
  }
}
