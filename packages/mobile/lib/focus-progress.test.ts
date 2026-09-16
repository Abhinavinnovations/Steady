import { expect, test } from "bun:test";
import { focusKey, focusLabel, savedRemaining, remainingAt } from "./focus-progress";

test("two hours less one minute resumes at 1h 59m for either task mode or to-do", () => {
  for (const kind of ["task", "todo"] as const) {
    const left = remainingAt(7200000, 7200, false, 60000)!;
    expect(left).toBe(7140);
    expect(savedRemaining(String(left), 7200)).toBe(7140);
    expect(focusLabel(left, 120)).toBe("1h 59m left of 2h");
    expect(focusKey({kind, id:1, day:"2026-09-16"})).toContain("2026-09-16");
  }
});
test("pause does not consume time; close uses deadline rather than stale display", () => {
  expect(remainingAt(7200000, 7140, true, 99999999)).toBe(7140);
  expect(remainingAt(7200000, 7200, false, 61000)).toBe(7139);
  expect(remainingAt(null, null, false, 61000)).toBeNull();
});
test("task, to-do and occurrence keys cannot collide", () => {
  const keys = [focusKey({kind:"task",id:1,day:"2026-09-16"}),focusKey({kind:"todo",id:1,day:"2026-09-16"}),focusKey({kind:"todo",id:1,day:"2026-09-17"})];
  expect(new Set(keys).size).toBe(3);
});
test("zero remains complete; invalid legacy storage cannot create invalid timer", () => {
  expect(savedRemaining("0",7200)).toBe(0);
  expect(focusLabel(0,120)).toBe("0m left of 2h");
  for (const raw of [null,"","garbage","-1","7201","Infinity"]) expect(savedRemaining(raw,7200)).toBe(7200);
  expect(focusLabel(3599,120)).toBe("1h left of 2h");
  expect(focusLabel(1,120)).toBe("1m left of 2h");
});
