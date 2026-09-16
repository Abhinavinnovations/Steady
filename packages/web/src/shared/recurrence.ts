export const REPEATS = ["none", "daily", "weekdays", "weekends", "weekly", "monthly"] as const;
export type Repeat = (typeof REPEATS)[number];
export const repeatLabels: Record<Repeat, string> = { none: "Does not repeat", daily: "Every day", weekdays: "Weekdays", weekends: "Weekends", weekly: "Every week", monthly: "Every month" };
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function addDays(value: string, count: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function occursOn(anchor: string, repeat: Repeat, day: string): boolean {
  if (!validDate(anchor) || !validDate(day) || day < anchor) return false;
  const d = new Date(`${day}T12:00:00Z`);
  const a = new Date(`${anchor}T12:00:00Z`);
  switch (repeat) {
    case "none": return day === anchor;
    case "daily": return true;
    case "weekdays": return d.getUTCDay() > 0 && d.getUTCDay() < 6;
    case "weekends": return d.getUTCDay() === 0 || d.getUTCDay() === 6;
    case "weekly": return d.getUTCDay() === a.getUTCDay();
    case "monthly": {
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      return d.getUTCDate() === Math.min(a.getUTCDate(), lastDay);
    }
  }
}
/** One current occurrence per repeating item; missed days do not pile up in Today. */
export function latestOccurrence(anchor: string, repeat: Repeat, today: string): string | null {
  if (anchor > today) return null;
  if (repeat === "none") return anchor;
  for (let i = 0; i < 32; i++) {
    const day = addDays(today, -i);
    if (day < anchor) return null;
    if (occursOn(anchor, repeat, day)) return day;
  }
  return null;
}
export function occurrencesBetween(anchor: string, repeat: Repeat, from: string, to: string): string[] {
  const result: string[] = [];
  for (let day = from > anchor ? from : anchor; day <= to; day = addDays(day, 1)) {
    if (occursOn(anchor, repeat, day)) result.push(day);
    if (result.length > 400) break;
  }
  return result;
}
