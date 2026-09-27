import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import { partners } from "../database/schema";

/** Invitations and legacy verification are not consent to start Challenge. */
export async function requireChallengeContact(userId: string, reader: Pick<typeof db, "select"> = db) {
  const [contact] = await reader.select({ id: partners.id }).from(partners)
    .where(and(eq(partners.ownerId, userId), eq(partners.status, "accepted")));
  if (!contact) throw new ORPCError("FORBIDDEN", {
    message: "Challenge requires an accepted accountability contact. Invite someone in Profile and wait for them to accept.",
  });
}
