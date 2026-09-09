import { createGateway } from "ai";

/** Self-hosted AI gateway — included with the app, no extra account or cost. */
export const gateway = createGateway({
  baseURL: process.env.AI_GATEWAY_BASE_URL,
  apiKey: process.env.AI_GATEWAY_API_KEY,
});
