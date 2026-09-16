import { describe, expect, test } from "bun:test";
import { addDays, latestOccurrence, occursOn, occurrencesBetween, validDate } from "./recurrence";
import { zonedInstant } from "./reminder-time";
describe("calendar recurrence", () => {
  test("rejects impossible dates",()=>{for(const d of ["2026-02-29","2026-04-31","2026-13-01","nope"])expect(validDate(d)).toBe(false);expect(validDate("2024-02-29")).toBe(true);});
  test("UTC date arithmetic handles leap and year rollover",()=>{expect(addDays("2024-02-28",1)).toBe("2024-02-29");expect(addDays("2026-12-31",1)).toBe("2027-01-01");});
  test("monthly clamps but does not drift",()=>{expect(occurrencesBetween("2026-01-31","monthly","2026-02-01","2026-04-30")).toEqual(["2026-02-28","2026-03-31","2026-04-30"]);expect(occursOn("2024-01-31","monthly","2024-02-29")).toBe(true);});
  test("weekdays and weekends",()=>{expect(latestOccurrence("2026-09-11","weekdays","2026-09-13")).toBe("2026-09-11");expect(latestOccurrence("2026-09-11","weekends","2026-09-11")).toBeNull();expect(occurrencesBetween("2026-09-11","weekends","2026-09-11","2026-09-14")).toEqual(["2026-09-12","2026-09-13"]);});
  test("weekly anchor and latest-only projection",()=>{expect(latestOccurrence("2026-09-01","weekly","2026-09-11")).toBe("2026-09-08");expect(latestOccurrence("2026-09-01","daily","2026-09-11")).toBe("2026-09-11");expect(latestOccurrence("2026-09-12","daily","2026-09-11")).toBeNull();});
  test("one-offs retain their date",()=>{expect(latestOccurrence("2026-08-01","none","2026-09-11")).toBe("2026-08-01");expect(occursOn("2026-09-11","none","2026-09-12")).toBe(false);});
});
describe("profile timezone notification instants",()=>{
  test("half-hour timezone",()=>expect(zonedInstant("2026-09-11","14:00","Asia/Kolkata").toISOString()).toBe("2026-09-11T08:30:00.000Z"));
  test("DST seasons",()=>{expect(zonedInstant("2026-01-11","14:00","America/New_York").toISOString()).toBe("2026-01-11T19:00:00.000Z");expect(zonedInstant("2026-09-11","14:00","America/New_York").toISOString()).toBe("2026-09-11T18:00:00.000Z");});
  test("DST nonexistent time shifts forward",()=>expect(zonedInstant("2026-03-08","02:30","America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z"));
  test("DST overlap uses first occurrence",()=>expect(zonedInstant("2026-11-01","01:30","America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z"));
});
