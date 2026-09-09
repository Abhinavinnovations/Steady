import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Local reminder notifications — $0, fully on-device, no server involved.
 *
 * - Consistent tasks: daily repeating reminder at the task's scheduled time.
 * - To-dos: one-shot reminder at dueDate + time.
 *
 * Identifiers are deterministic (`task-<id>` / `todo-<id>`) so re-scheduling
 * replaces the old one and cancelling is a simple lookup.
 *
 * On web this is a silent no-op — browser pages can't schedule OS-level
 * notifications the way a device can. Everything works on the phone.
 */

const isWeb = Platform.OS === "web";

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureReminderPermission(): Promise<boolean> {
  if (isWeb) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export function taskReminderId(taskId: number) {
  return `task-${taskId}`;
}

export function todoReminderId(todoId: number) {
  return `todo-${todoId}`;
}

/** Daily repeating reminder for a consistent task at "HH:mm" local time. */
export async function scheduleTaskReminder(
  taskId: number,
  title: string,
  time: string,
): Promise<boolean> {
  if (isWeb) return false;
  const ok = await ensureReminderPermission();
  if (!ok) return false;
  const [hour, minute] = time.split(":").map(Number);
  try {
    await Notifications.cancelScheduledNotificationAsync(taskReminderId(taskId)).catch(
      () => {},
    );
    await Notifications.scheduleNotificationAsync({
      identifier: taskReminderId(taskId),
      content: {
        title: "Steady — time for your task",
        body: title,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** One-shot reminder for a to-do at dueDate ("YYYY-MM-DD") + time ("HH:mm"). */
export async function scheduleTodoReminder(
  todoId: number,
  title: string,
  dueDate: string,
  time: string,
): Promise<boolean> {
  if (isWeb) return false;
  const ok = await ensureReminderPermission();
  if (!ok) return false;
  const [y, m, d] = dueDate.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const when = new Date(y, m - 1, d, hour, minute, 0, 0);
  if (when.getTime() <= Date.now()) return false; // moment already passed
  try {
    await Notifications.cancelScheduledNotificationAsync(todoReminderId(todoId)).catch(
      () => {},
    );
    await Notifications.scheduleNotificationAsync({
      identifier: todoReminderId(todoId),
      content: {
        title: "Steady — to-do",
        body: title,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelReminder(identifier: string): Promise<void> {
  if (isWeb) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // nothing scheduled — fine
  }
}
