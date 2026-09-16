import { and, eq, gte } from "drizzle-orm";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate } from "../lib/dates";
import { addDays, occurrencesBetween } from "../../shared/recurrence";

/** Read-only device queue. No server worker, push service, or private notes. */
export const reminders = {
  plan: authed.handler(async ({ context }) => {
    const uid = context.user.id;
    const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, uid));
    if (!p?.onboardedAt) return { userId:uid, timezone: "UTC", entries: [] };
    const today = localDate(p.timezone);
    const month = today.slice(0, 7);
    const [commitment] = await db.select().from(schema.commitments).where(and(eq(schema.commitments.userId, uid), eq(schema.commitments.month, month)));
    const [todos, tasks, todoDone, taskDone] = await Promise.all([
      db.select().from(schema.todos).where(and(eq(schema.todos.userId, uid), eq(schema.todos.reminderEnabled, true))),
      db.select().from(schema.tasks).where(and(eq(schema.tasks.userId, uid), eq(schema.tasks.month, month), eq(schema.tasks.reminderEnabled, true))),
      db.select().from(schema.todoCompletions).where(and(eq(schema.todoCompletions.userId, uid), gte(schema.todoCompletions.localDate, today))),
      db.select().from(schema.completions).where(and(eq(schema.completions.userId, uid), gte(schema.completions.localDate, today))),
    ]);
    const done = new Set([...todoDone.map(c => `todo-${c.todoId}:${c.localDate}`), ...taskDone.map(c => `task-${c.taskId}:${c.localDate}`)]);
    const entries: { identifier: string; title: string; day: string; time: string }[] = [];
    for (const t of todos) {
      if (!t.scheduledTime || (t.repeat === "none" && t.completedAt)) continue;
      const from = t.dueDate > today ? t.dueDate : today;
      for (const day of occurrencesBetween(t.dueDate, t.repeat, from, addDays(from, 370)).slice(0, 13)) {
        const identifier = `todo-${t.id}:${day}`;
        if (!done.has(identifier)) entries.push({ identifier, title: t.title, day, time: t.scheduledTime });
      }
    }
    if (commitment?.confirmedAt) for (const t of tasks) {
      if (!t.scheduledTime) continue;
      for (const day of occurrencesBetween(t.startDate, "daily", today, addDays(today, 13))) {
        const identifier = `task-${t.id}:${day}`;
        if (day.startsWith(month) && !done.has(identifier)) entries.push({ identifier, title: t.title, day, time: t.scheduledTime });
      }
    }
    return { userId:uid, timezone: p.timezone, entries };
  }),
};
