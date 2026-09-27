import { APIError } from "better-auth/api";
import { sendEmail, emailShell, escapeHtml } from "./email";

/** Used by Better Auth; never changes verification state or mints its own tokens. */
export async function sendAccountVerification(
  { user, url }: { user: { name?: string | null; email: string }; url: string },
  request?: Request,
) {
  const result = await sendEmail({
    to: user.email,
    subject: "Verify your Steady account",
    text: `Hi ${user.name || "there"}, verify your Steady account: ${url}. Then return to Steady and check your verification status in Profile.`,
    html: emailShell("Verify your account",
      `<p style="margin:0 0 20px;font-size:14px;color:#44444f;line-height:1.6;">Verify <b>${escapeHtml(user.email)}</b> to invite or accept an accountability contact.</p>
       <a href="${escapeHtml(url)}" style="display:inline-block;background:#A4482D;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;">Verify email</a>
       <p>Then return to Steady and check your verification status in Profile.</p>`),
  });
  // A signup can already have created the account. Do not turn a background email
  // failure into a misleading signup failure. Only explicit resend must report it.
  const explicit = request && new URL(request.url).pathname.endsWith("/send-verification-email");
  if (!explicit || result.outcome === "accepted") return;
  const message = result.code === "sender_not_configured"
    ? "Email sending is not configured for Steady yet. The app owner needs to connect the email service. No verification email was sent."
    : result.outcome === "unknown"
      ? "Email delivery could not be confirmed. Check your inbox before requesting another verification email."
      : "The email provider rejected the verification email. The app owner needs to check the sending configuration.";
  throw new APIError("SERVICE_UNAVAILABLE", { code: result.outcome === "unknown" ? "VERIFICATION_EMAIL_UNCONFIRMED" : "VERIFICATION_EMAIL_NOT_SENT", message });
}
