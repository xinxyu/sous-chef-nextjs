import { getEnv } from "./env";

/** Send email via Resend's HTTP API. Returns false (and logs) when not configured. */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY not set; skipping email to ${to}: ${subject}\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.FROM_EMAIL || "Sous Chef <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`Failed to send email: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Failed to send email:", e);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
