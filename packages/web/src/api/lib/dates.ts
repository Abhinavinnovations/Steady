/** Date helpers — all "local" values are computed in the user's IANA timezone. */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(timezone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      f = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
    fmtCache.set(timezone, f);
  }
  return f;
}

/** "YYYY-MM-DD" for `date` (default now) in the given timezone. */
export function localDate(timezone: string, date: Date = new Date()): string {
  return formatter(timezone).format(date); // en-CA gives YYYY-MM-DD
}

/** "YYYY-MM" for now in the given timezone. */
export function localMonth(timezone: string, date: Date = new Date()): string {
  return localDate(timezone, date).slice(0, 7);
}

/** Shift a "YYYY-MM-DD" string by n days (calendar math, timezone-independent). */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** All "YYYY-MM-DD" days from start to end inclusive. */
export function dayRange(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = shiftDay(d, 1);
  }
  return out;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
