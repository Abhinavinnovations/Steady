import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { runableManagedAuth } from "@runablehq/managed-auth/server";
import { db } from "./database";
import { sendEmail, emailShell } from "./services/email";

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Steady account",
        text: `Hi ${user.name || "there"}, verify your Steady account: ${url}`,
        html: emailShell(
          "Verify your account",
          `<p style="margin:0 0 20px;font-size:14px;color:#44444f;line-height:1.6;">One verified account per person — it keeps Challenge mode honest. Tap below to verify <b>${user.email}</b>.</p>
           <a href="${url}" style="display:inline-block;background:#6C63FF;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;">Verify email</a>`,
        ),
      });
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
  },
  plugins: [
    ...runableManagedAuth({
      applicationId: process.env.APPLICATION_ID!,
      issuer: process.env.VITE_RUNABLE_AUTH_ISSUER!,
    }),
    expo(),
  ],
});
