export class FontReadinessError extends Error {
  constructor(public code: string) { super(code); }
}

/** Await actual loading, then inspect the registry rather than the JS isLoaded cache. */
export async function verifyFontReadiness(
  load: () => Promise<void>,
  registered: () => string[],
  expected: readonly string[],
  timeoutMs = 20000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(load),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new FontReadinessError("FONT_LOAD_TIMEOUT")), timeoutMs);
      }),
    ]);
    const names = new Set(registered());
    if (!expected.every(name => names.has(name))) throw new FontReadinessError("FONT_REGISTRY_MISSING");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function safeFontError(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]{1,60}$/.test(code) ? code : "FONT_LOAD_FAILED";
}
