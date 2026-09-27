import { expect, test } from "bun:test";
import { durationOptions } from "./duration-options";

test("unlocked duration keeps no timer and original steps", () => {
  expect(durationOptions(null)[0]).toBeNull();
  expect(durationOptions(25)).toContain(25);
});
test("committed duration cannot decrease or lose timer", () => {
  const options = durationOptions(30, 25);
  expect(options[0]).toBe(25);
  expect(options).not.toContain(null);
  expect(options.every(n => n !== null && n >= 25)).toBe(true);
});
test("custom committed durations remain exact and ordered", () => {
  expect(durationOptions(27, 27).slice(0, 3)).toEqual([27, 30, 35]);
  expect(durationOptions(480, 480)).toEqual([480]);
  const options = durationOptions(37, 27);
  expect(options).toEqual([...new Set(options)].sort((a, b) => Number(a)-Number(b)));
});
