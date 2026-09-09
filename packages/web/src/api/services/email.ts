import { Resend } from "resend";

/**
 * Thin Resend wrapper. Degrades gracefully when RESEND_API_KEY is missing:
 * logs and returns null so the calling flow (invite, nudge, verification)
 * still succeeds — email is best-effort, never a hard dependency.
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const FROM = "Steady <onboarding@resend.dev>";

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY missing — skipped "${subject}" to ${to}`);
    return null;
  }
  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      text,
      html,
    });
    if (error) {
      console.error(`[email] failed "${subject}" to ${to}: ${error.message}`);
      return null;
    }
    return data;
  } catch (e) {
    console.error(`[email] error "${subject}" to ${to}:`, e);
    return null;
  }
}

/** Shared minimal template — calm, no images, matches the app's quiet voice. */
export function emailShell(title: string, bodyHtml: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f4f4f8;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid rgba(0,0,0,0.06);">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#8e8e9a;">S T E A D Y</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#17171f;">${title}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#8e8e9a;">Consistency, without the guilt.</p>
  </div>
</body></html>`;
}
