import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { SendEmailOptions } from "./email";

// Capability URLs must not be plaintext in the frozen retry ledger.
// The auth secret already lives only in root .env. Rotation requires retaining old key
// until uncertain deliveries have been resolved; decoding fails closed otherwise.
function key() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("payload_key_missing");
  return createHash("sha256").update(`steady-invitation-payload-v1:${secret}`).digest();
}
export function freezePayload(payload: SendEmailOptions) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `encrypted-v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${data.toString("base64url")}`;
}
export function thawPayload(value: string): SendEmailOptions {
  if (!value.startsWith("encrypted-v1:")) return JSON.parse(value) as SendEmailOptions;
  const [, iv, tag, data] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")) as SendEmailOptions;
}
