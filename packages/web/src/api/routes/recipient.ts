import { z } from "zod";
import { base } from "../__core/app";
import { inspectRecipient, respondRecipient } from "../services/recipient-consent";

const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
// POST even for inspection: bearer capabilities never enter URL/access logs.
// Page loads do not change any relationship or consent record.
export const recipient = {
  inspect: base.route({ method: "POST" }).input(z.object({ token })).handler(({ input }) => inspectRecipient(input.token)),
  respond: base.route({ method: "POST" }).input(z.object({ token, action: z.enum(["accept", "decline", "stop"]) }))
    .handler(({ input }) => respondRecipient(input.token, input.action)),
};
