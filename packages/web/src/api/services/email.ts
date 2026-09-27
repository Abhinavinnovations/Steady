import { configuredEmailProvider, emailProvider, type EmailProvider } from "./email-config";
import { sendGmailEmail } from "./gmail-email";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Frozen sender for idempotent invitation retries. Server-side only. */
  from?: string;
  idempotencyKey?: string;
  /** Freeze provider with invitation payload; old payloads are Resend. */
  provider?: EmailProvider;
}
export type EmailOutcome = {
  outcome: "accepted" | "failed" | "unknown";
  providerId: string | null;
  code: string;
};
export function emailConfigured() {
  return configuredEmailProvider() !== null;
}

/** Never logs recipient/content/credentials. Acceptance is not inbox delivery. */
export async function sendEmail(options: SendEmailOptions): Promise<EmailOutcome> {
  const provider = emailProvider();
  if (!provider) return { outcome: "failed", providerId: null, code: "sender_not_configured" };
  if (options.provider && options.provider !== provider)
    return { outcome: "failed", providerId: null, code: "provider_changed" };
  if (provider === "gmail") return sendGmailEmail(options);
  const key = process.env.RESEND_API_KEY?.trim();
  const from = options.from || process.env.EMAIL_FROM?.trim();
  if (!key || !from) return { outcome: "failed", providerId: null, code: "sender_not_configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    // Direct Resend transport avoids SDK development logs that include raw provider errors.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) },
      body: JSON.stringify({ from, to: [options.to], subject: options.subject, text: options.text, html: options.html }),
    });
    if (!response.ok) {
      const status = response.status;
      const definite = status >= 400 && status < 500 && status !== 408 && status !== 409;
      return { outcome: definite ? "failed" : "unknown", providerId: null, code: definite ? "provider_rejected" : "provider_unconfirmed" };
    }
    const data = await response.json() as { id?: unknown };
    return typeof data.id === "string" && data.id.length > 0
      ? { outcome: "accepted", providerId: data.id, code: "provider_accepted" }
      : { outcome: "unknown", providerId: null, code: "provider_unconfirmed" };
  } catch {
    // Aborting HTTP cannot undo a provider acceptance; preserve the same retry key.
    return { outcome: "unknown", providerId: null, code: controller.signal.aborted ? "provider_timeout" : "provider_unconfirmed" };
  } finally { clearTimeout(timer); }
}
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
/** Body is trusted template markup; interpolate dynamic values only after escaping. */
export function emailShell(title: string, bodyHtml: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f4f4f8;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid rgba(0,0,0,0.06);">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#8e8e9a;">S T E A D Y</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#17171f;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#8e8e9a;">Consistency, without the guilt.</p>
  </div>
</body></html>`;
}
