export const DURATION_STEPS: (number | null)[] = [
  null, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120, 150, 180, 240, 300, 360, 480,
];

/** Include exact custom durations; committed targets never offer a lower value. */
export function durationOptions(value: number | null, minimum: number | null = null) {
  const values = new Set(DURATION_STEPS.filter((n): n is number => n !== null));
  if (minimum !== null) values.add(minimum);
  if (value !== null) values.add(value);
  const numbers = [...values].filter(n => n >= Math.max(5, minimum ?? 0) && n <= 480).sort((a, b) => a - b);
  return minimum === null ? [null, ...numbers] : numbers;
}
