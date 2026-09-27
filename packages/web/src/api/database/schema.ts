import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

/** Per-user app profile — timezone anchors the "local day", mode is basic/challenge. */
export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  mode: text("mode", { enum: ["basic", "challenge"] })
    .notNull()
    .default("basic"),
  displayName: text("display_name").notNull().default(""),
  /** Leaderboards are opt-out — flip this to disappear from all boards. */
  leaderboardOptOut: integer("leaderboard_opt_out", { mode: "boolean" })
    .notNull()
    .default(false),
  onboardedAt: integer("onboarded_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Monthly commitment lock — one row per user per month (YYYY-MM).
 * Once confirmedAt is set, tasks of that month cannot be deleted, only added.
 */
export const commitments = sqliteTable(
  "commitments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // "YYYY-MM" in the user's timezone
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("commitments_user_month").on(t.userId, t.month)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createRequestId: text("create_request_id"),
    createFingerprint: text("create_fingerprint"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // "YYYY-MM"
    title: text("title").notNull(),
    flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
    /**
     * Per-task stakes. Basic = fully private. Challenge = your partner /
     * accountability contact hears about it when the streak breaks, and the
     * task ranks on the challenge leaderboard.
     */
    mode: text("mode", { enum: ["basic", "challenge"] })
      .notNull()
      .default("basic"),
    /** Optional planned duration in minutes — powers the full-screen focus timer. */
    durationMinutes: integer("duration_minutes"),
    /** Local date (YYYY-MM-DD) the task becomes active — days before this don't require it. */
    startDate: text("start_date").notNull(),
    /** Optional user-defined category. */
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    /** Optional time of day "HH:mm" (user's local clock) the task is planned for. */
    scheduledTime: text("scheduled_time"),
    /** Fire a local reminder notification at scheduledTime (device-side). */
    reminderEnabled: integer("reminder_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("tasks_user_month").on(t.userId, t.month), uniqueIndex("tasks_user_request").on(t.userId, t.createRequestId)],
);

/** User-defined task categories (work, study, wishlist, ...) — never hardcoded. */
export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("categories_user_name").on(t.userId, t.name)],
);

/**
 * Temporary tasks ("today's tasks") — casual todos, fully deletable, never part
 * of streaks, badges or leaderboards. They stay on the list until done or deleted.
 */
export const todos = sqliteTable(
  "todos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createRequestId: text("create_request_id"),
    createFingerprint: text("create_fingerprint"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
    /** Optional focus-timer duration in minutes (same timer as consistent tasks). */
    durationMinutes: integer("duration_minutes"),
    /** Local date "YYYY-MM-DD" the todo is planned for (defaults to today). */
    dueDate: text("due_date").notNull(),
    repeat: text("repeat", { enum: ["none", "daily", "weekdays", "weekends", "weekly", "monthly"] }).notNull().default("none"),
    /** Optional time of day "HH:mm". */
    scheduledTime: text("scheduled_time"),
    reminderEnabled: integer("reminder_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("todos_user_due").on(t.userId, t.dueDate),
    index("todos_user_open").on(t.userId, t.completedAt),
    uniqueIndex("todos_user_request").on(t.userId, t.createRequestId),
  ],
);

export const completions = sqliteTable(
  "completions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(), // "YYYY-MM-DD" in the user's timezone
    note: text("note").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("completions_task_day").on(t.taskId, t.localDate),
    index("completions_user_day").on(t.userId, t.localDate),
  ],
);

/** Challenge mode: one accountability partner per user, invited by email. */
export const partners = sqliteTable(
  "partners",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    partnerEmail: text("partner_email").notNull(),
    partnerUserId: text("partner_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: ["invited", "accepted", "declined"] })
      .notNull()
      .default("invited"),
    inviteToken: text("invite_token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    respondedAt: integer("responded_at", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("partners_owner").on(t.ownerId)],
);

/** Separate transport ledger; existing relationships are not rewritten or backfilled. */
export const invitationDeliveries = sqliteTable("invitation_deliveries", {
  id: text("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
  outcome: text("outcome", { enum: ["sending", "accepted", "failed", "unknown"] }).notNull(),
  providerId: text("provider_id"),
  code: text("code").notNull(),
  /** Exact provider payload for safe replay, never returned to clients. */
  payload: text("payload").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  leaseUntil: integer("lease_until", { mode: "timestamp_ms" }).notNull(),
}, t => [index("invitation_deliveries_partner_created").on(t.partnerId, t.createdAt)]);

/** Bearer secrets are hashed here; stop capabilities survive relationship removal. */
export const recipientLinks = sqliteTable("recipient_links", {
  tokenHash: text("token_hash").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  recipientKey: text("recipient_key").notNull(),
  kind: text("kind", { enum: ["invite", "stop"] }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  decision: text("decision", { enum: ["accepted", "declined"] }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, t => [index("recipient_links_partner").on(t.partnerId)]);

export const recipientConsents = sqliteTable("recipient_consents", {
  partnerId: integer("partner_id").primaryKey().references(() => partners.id, { onDelete: "cascade" }),
  acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }).notNull(),
  startDate: text("start_date").notNull(),
  version: text("version").notNull(),
});

/** Owner + normalized mailbox digest. No FK: cancellation must not bypass opt-out. */
export const recipientSuppressions = sqliteTable("recipient_suppressions", {
  recipientKey: text("recipient_key").primaryKey(),
  stoppedAt: integer("stopped_at", { mode: "timestamp_ms" }).notNull(),
});

/** A claim is not a sent email. Unfinished claims are uncertain and never replayed. */
export const missAlertDeliveries = sqliteTable("miss_alert_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  partnerId: integer("partner_id").references(() => partners.id, { onDelete: "set null" }),
  missedDate: text("missed_date").notNull(),
  outcome: text("outcome", { enum: ["sending", "accepted", "failed", "unknown", "suppressed"] }).notNull(),
  code: text("code").notNull(),
  providerId: text("provider_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, t => [uniqueIndex("miss_alert_deliveries_user_day").on(t.userId, t.missedDate)]);

/** Minimal automatic badges — awarded lazily when earned, never revoked. */
export const badges = sqliteTable(
  "badges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    earnedAt: integer("earned_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("badges_user_code").on(t.userId, t.code)],
);

/** Nudge log — max one per missed day, keeps nudges gentle. */
export const nudges = sqliteTable(
  "nudges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    missedDate: text("missed_date").notNull(), // "YYYY-MM-DD"
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("nudges_partner_day").on(t.partnerId, t.missedDate)],
);

/**
 * Challenge accountability contact — any email (not an app user) that gets
 * told when the owner misses a day. Must be verified with a code first.
 */
export const accountabilityContacts = sqliteTable(
  "accountability_contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    verifyCode: text("verify_code"),
    verifyExpiresAt: integer("verify_expires_at", { mode: "timestamp" }),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("accountability_user").on(t.userId)],
);

/** Missed-day alert log — max one email per user per missed local date. */
export const missAlerts = sqliteTable(
  "miss_alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    missedDate: text("missed_date").notNull(), // "YYYY-MM-DD" in owner's timezone
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("miss_alerts_user_day").on(t.userId, t.missedDate)],
);

/** Repeating to-do checkoffs are independent of consistency and streaks. */
export const todoCompletions = sqliteTable("todo_completions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  todoId: integer("todo_id").notNull().references(() => todos.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  localDate: text("local_date").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, t => [uniqueIndex("todo_completions_day").on(t.todoId, t.localDate), index("todo_completions_user").on(t.userId)]);
