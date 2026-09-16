import { describe, expect, test } from "bun:test";
import { createGoogleAttempt, googleError, installSecureRandom } from "./auth-random";

describe("secure native auth compatibility", () => {
  test("installs missing crypto method, forwards the exact view, keeps existing crypto", () => {
    const crypto: { subtle: string; getRandomValues?: (a: Uint8Array) => Uint8Array } = { subtle: "untouched" };
    const host = { crypto }; let seen: unknown;
    installSecureRandom(host, a => { seen = a; new Uint8Array(a.buffer, a.byteOffset, a.byteLength).fill(7); return a; });
    const bytes = new Uint8Array(32);
    expect(host.crypto.getRandomValues!(bytes)).toBe(bytes); expect(seen).toBe(bytes);
    expect([...bytes].every(n => n === 7)).toBe(true); expect(host.crypto.subtle).toBe("untouched");
  });
  test("creates crypto when absent; does not replace a browser implementation", () => {
    const host: { crypto?: { getRandomValues?: unknown } } = {};
    installSecureRandom(host, a => a); expect(typeof host.crypto?.getRandomValues).toBe("function");
    const original = () => {}; const browser = { crypto: { getRandomValues: original } };
    installSecureRandom(browser, () => { throw Error("must not call"); }); expect(browser.crypto.getRandomValues).toBe(original);
  });
  test("a failed secure source fails closed", () => {
    const host: { crypto?: { getRandomValues?: unknown } } = {};
    installSecureRandom(host, () => { throw Error("secure source unavailable"); });
    expect(() => (host.crypto!.getRandomValues as (a: Uint8Array) => Uint8Array)(new Uint8Array(32))).toThrow();
  });
  test("caught synchronous/async startup throws clear busy; unknown details stay private", async () => {
    const attempt = createGoogleAttempt(); const states: unknown[] = [];
    await attempt(() => { throw Error("secret callback URL"); }, (...s) => states.push(s));
    expect(states).toEqual([[true, null], [false, googleError()]]);
    states.length = 0;
    await attempt(async () => { throw Error("private"); }, (...s) => states.push(s));
    expect(states).toEqual([[true, null], [false, googleError()]]);
    expect(JSON.stringify(states)).not.toContain("private");
  });
  test("rapid taps serialize, success cleans up and another attempt is allowed", async () => {
    let done!: (value: { error: null }) => void; let calls = 0;
    const attempt = createGoogleAttempt(); const states: unknown[] = [];
    const first = attempt(() => { calls++; return new Promise(resolve => { done = resolve; }); }, (...s) => states.push(s));
    await attempt(async () => { calls++; return { error: null }; }, () => {}); expect(calls).toBe(1);
    done({ error: null }); await first; expect(states).toEqual([[true, null], [false, null]]);
    await attempt(async () => { calls++; return { error: null }; }, () => {}); expect(calls).toBe(2);
  });
  test("dismiss/cancel are quiet; callback/exchange/popup failures actionable", async () => {
    expect(googleError("AUTH_SESSION_DISMISSED")).toBeNull(); expect(googleError("POPUP_CLOSED")).toBeNull();
    for (const code of ["INVALID_CALLBACK", "EXCHANGE_FAILED", "POPUP_BLOCKED", "POPUP_TIMEOUT"]) expect(googleError(code)).toContain("[AUTH_");
    const states: unknown[] = [];
    await createGoogleAttempt()(async () => ({ error: { code: "INVALID_CALLBACK", message: "private url" } }), (...s) => states.push(s));
    expect(states).toEqual([[true, null], [false, googleError("INVALID_CALLBACK")]]);
  });
});
