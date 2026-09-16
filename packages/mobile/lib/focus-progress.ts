export type FocusIdentity = { kind: "task" | "todo"; id: number; day: string; durationMinutes: number };
export const focusKey = (item: Pick<FocusIdentity, "kind" | "id" | "day">) =>
  `steady.timer.${item.kind === "todo" ? "t" : ""}${item.id}.${item.day}`;

/** Read the original numeric storage format, including a fully elapsed timer. */
export function savedRemaining(raw: string | null, totalSeconds: number) {
  const value = raw === null || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= totalSeconds ? Math.round(value) : totalSeconds;
}
export function focusTime(seconds: number) {
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${minutes}m`;
}
export function focusLabel(remaining: number, durationMinutes: number) {
  return `${focusTime(remaining)} left of ${focusTime(durationMinutes * 60)}`;
}
export function remainingAt(end: number | null, latest: number | null, paused: boolean, now: number) {
  return paused || end === null ? latest : Math.max(0, Math.round((end - now) / 1000));
}
