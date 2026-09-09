import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { auth } from "./auth";
import { ping } from "./routes/ping";
import { profile } from "./routes/profile";
import { tasks } from "./routes/tasks";
import { today } from "./routes/today";
import { stats } from "./routes/stats";
import { partners } from "./routes/partners";
import { leaderboard } from "./routes/leaderboard";
import { badges } from "./routes/badges";
import { accountability } from "./routes/accountability";
import { admin } from "./routes/admin";
import { categories } from "./routes/categories";
import { todos } from "./routes/todos";

export const router = {
  ping,
  profile,
  tasks,
  today,
  stats,
  partners,
  leaderboard,
  badges,
  accountability,
  admin,
  categories,
  todos,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

// Better Auth handler (email/password + Runable managed Google login)
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export default app;
