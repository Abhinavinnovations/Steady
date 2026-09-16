/** Profile wall-clock -> instant. DST gaps shift forward; overlaps use first instant. */
export function zonedInstant(day: string, time: string, timezone: string): Date {
  const target = new Date(`${day}T${time}:00Z`).getTime();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let instant = target;
  const visited: number[] = [];
  for (let i = 0; i < 5; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(instant)).map(x => [x.type, x.value]));
    const wall = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`).getTime();
    if (wall === target) return new Date(instant);
    visited.push(instant);
    const next = instant + target - wall;
    if (visited.includes(next)) return new Date(Math.max(instant, next));
    instant = next;
  }
  return new Date(instant);
}
