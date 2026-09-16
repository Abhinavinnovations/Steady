import { z } from "zod";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";

/** Compatibility endpoints only. Retain legacy records; never send or mutate. */
function retired(): never {
  throw new ORPCError("FORBIDDEN", {
    message: "Email-code contacts have been retired. Open Profile → Accountability contact, send an invitation and wait for acceptance. Your old record has been retained; no invitation was sent automatically.",
  });
}
export const accountability = {
  get: authed.handler(async ({ context }) => {
    const [c] = await db.select().from(schema.accountabilityContacts)
      .where(eq(schema.accountabilityContacts.userId, context.user.id));
    return c ? { email: c.email, verified: false, verifiedAt: null, codeExpired: true, retired: true } : null;
  }),
  set: authed.input(z.object({ email: z.string().trim().toLowerCase().email().max(120) }))
    .handler(async (): Promise<{ ok: boolean; email: string }> => retired()),
  verify: authed.input(z.object({ code: z.string().trim().length(6) }))
    .handler(async (): Promise<{ ok: boolean; alreadyVerified?: boolean }> => retired()),
  resend: authed.handler(async (): Promise<{ ok: boolean; alreadyVerified?: boolean }> => retired()),
  remove: authed.handler(async (): Promise<{ ok: boolean }> => retired()),
};
