import { afterEach, describe, expect, jest, test } from "bun:test";
import { LiveSpeech, speechError, type SpeechPort } from "./live-speech";
import type { ExpoSpeechRecognitionOptions } from "expo-speech-recognition";
class FakeSpeech implements SpeechPort {
  events = new Map<string, Set<(e: never) => void>>();
  granted = true; available = true; state = "inactive"; starts = 0; stops = 0; aborts = 0;
  startEvent = true; stopEvent = true; abortEvent = true; final = "";
  options?: ExpoSpeechRecognitionOptions;
  permission: (() => Promise<{ granted: boolean }>) | undefined;
  isRecognitionAvailable = () => this.available;
  requestPermissionsAsync = () => this.permission ? this.permission() : Promise.resolve({ granted: this.granted });
  getStateAsync = async () => this.state;
  start(options: ExpoSpeechRecognitionOptions) { this.starts++; this.options = options; this.state = "recognizing"; if (this.startEvent) this.emit("start"); }
  stop() { this.stops++; if (this.final) this.result(this.final, true); if (this.stopEvent) this.end(); }
  abort() { this.aborts++; if (this.abortEvent) this.end(); }
  addListener(name: string, cb: (e: never) => void) {
    const callbacks = this.events.get(name) ?? new Set(); callbacks.add(cb); this.events.set(name, callbacks);
    return { remove: () => { callbacks.delete(cb); } };
  }
  emit(name: string, event?: unknown) { const callbacks = Array.from(this.events.get(name) ?? []); for (const cb of callbacks) cb(event as never); }
  result(text: string, final = false) { this.emit("result", { isFinal: final, results: [{ transcript: text }] }); }
  end() { this.state = "inactive"; this.emit("end"); }
}
const sessions: LiveSpeech[] = [];
function setup(continuous = true, callback?: (text: string) => Promise<void>) {
  const port = new FakeSpeech(); const inputs: string[] = [];
  const session = new LiveSpeech(port, callback ?? (async text => { inputs.push(text); }), continuous);
  sessions.push(session); return { port, session, inputs };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
afterEach(() => { sessions.splice(0).forEach(s => s.dispose()); jest.useRealTimers(); });

describe("native live dictation with mocked OS events (not device execution)", () => {
  test("interim text replaces earlier hypotheses and creates/sends nothing while listening", async () => {
    const { port, session, inputs } = setup(); await session.start();
    port.result("Buy"); port.result("Buy groceries");
    expect(session.snapshot.interim).toBe("Buy groceries"); expect(session.snapshot.text).toBe(""); expect(inputs).toEqual([]);
    expect(port.options).toMatchObject({ interimResults: true, continuous: true, recordingOptions: { persist: false } });
  });
  test("final segments commit exactly once, next interim replaces only current segment", async () => {
    const { port, session, inputs } = setup(); await session.start();
    port.result("Buy groceries", true); port.result("Call"); port.result("Call Mum tomorrow");
    expect(session.snapshot.text).toBe("Buy groceries"); expect(session.snapshot.interim).toBe("Call Mum tomorrow");
    port.final = "Call Mum tomorrow"; await session.finish();
    expect(inputs).toEqual(["Buy groceries Call Mum tomorrow"]); expect(session.snapshot.phase).toBe("idle");
  });
  test("Finish waits for end/final; rapid Finish sends only once", async () => {
    const { port, session, inputs } = setup(); await session.start(); port.result("Draft"); port.stopEvent = false;
    const done = session.finish(); await session.finish(); expect(inputs).toEqual([]); expect(session.snapshot.settling).toBe(true);
    port.result("Final corrected phrase", true); port.end(); await done;
    expect(inputs).toEqual(["Final corrected phrase"]); expect(port.stops).toBe(1);
  });
  test("Pause waits for release and Resume preserves words across microphone sessions", async () => {
    const { port, session, inputs } = setup(); await session.start(); port.result("First task");
    await session.pause(); expect(session.snapshot.phase).toBe("paused"); expect(inputs).toEqual([]);
    await session.start(true); port.result("Second task", true); await session.finish();
    expect(inputs).toEqual(["First task Second task"]); expect(port.starts).toBe(2);
  });
  test("older Android single-utterance end pauses safely instead of looping", async () => {
    const { port, session, inputs } = setup(false); await session.start(); port.result("One task", true); port.end();
    expect(port.options?.continuous).toBe(false); expect(session.snapshot.phase).toBe("paused"); expect(port.starts).toBe(1);
    expect(session.snapshot.error).toContain("Resume"); await session.finish(); expect(inputs).toEqual(["One task"]);
  });
  test("permission denial never starts mic; retry after permission recovers", async () => {
    const { port, session } = setup(); port.granted = false; await session.start();
    expect(port.starts).toBe(0); expect(session.snapshot.denied).toBe(true); expect(session.snapshot.error).toContain("SPEECH_PERMISSION");
    port.granted = true; await session.start(true); expect(port.starts).toBe(1); expect(session.snapshot.denied).toBe(false);
  });
  test("missing speech service offers fallback without touching mic", async () => {
    const { port, session } = setup(); port.available = false; await session.start();
    expect(port.starts).toBe(0); expect(session.snapshot.error).toContain("SPEECH_SERVICE");
  });
  test("busy service cannot be stolen by a new session", async () => {
    const { port, session } = setup(); port.state = "recognizing"; await session.start();
    expect(port.starts).toBe(0); expect(port.aborts).toBe(0); expect(session.snapshot.error).toContain("SPEECH_BUSY");
  });
  test("rapid start taps open one permission request/recognizer", async () => {
    const { port, session } = setup(); let allow!: (p: { granted: boolean }) => void;
    port.permission = () => new Promise(resolve => { allow = resolve; });
    const start = session.start(); await session.start(); allow({ granted: true }); await start; expect(port.starts).toBe(1);
  });
  test("cancel during permission request prevents late microphone startup", async () => {
    const { port, session, inputs } = setup(); let allow!: (p: { granted: boolean }) => void;
    port.permission = () => new Promise(resolve => { allow = resolve; });
    const start = session.start(); expect(await session.cancel()).toBe(true); allow({ granted: true }); await start;
    expect(port.starts).toBe(0); expect(inputs).toEqual([]); expect(session.snapshot.phase).toBe("idle");
  });
  test("close during permission request ignores late grant", async () => {
    const { port, session } = setup(); let allow!: (p: { granted: boolean }) => void;
    port.permission = () => new Promise(resolve => { allow = resolve; }); const start = session.start(); session.dispose();
    allow({ granted: true }); await start; expect(port.starts).toBe(0);
  });
  test("background pauses; no automatic restart when returning", async () => {
    const { port, session } = setup(); await session.start(); port.result("Keep me"); session.setActive(false); await flush();
    expect(session.snapshot.phase).toBe("paused"); expect(session.snapshot.interim).toBe("Keep me");
    session.setActive(true); expect(port.starts).toBe(1);
  });
  test("background during permission request does not start audio afterward", async () => {
    const { port, session } = setup(); let allow!: (p: { granted: boolean }) => void;
    port.permission = () => new Promise(resolve => { allow = resolve; }); const start = session.start(); session.setActive(false);
    allow({ granted: true }); await start; expect(port.starts).toBe(0); expect(session.snapshot.phase).toBe("paused");
  });
  test("network error preserves words, releases microphone, exposes only content-free code", async () => {
    const { port, session, inputs } = setup(); await session.start(); port.result("Keep this task");
    port.emit("error", { error: "network", message: "private token or transcript" }); await flush();
    expect(session.snapshot.error).toContain("SPEECH_NETWORK"); expect(session.snapshot.error).not.toContain("private");
    expect(session.snapshot.interim).toBe("Keep this task"); await session.finish(); expect(inputs).toEqual(["Keep this task"]);
  });
  test("cancel clears words, ignores late results, and never sends text", async () => {
    const { port, session, inputs } = setup(); await session.start(); port.result("Discard this"); expect(await session.cancel()).toBe(true);
    port.result("late stale text", true); expect(session.snapshot.text).toBe(""); expect(session.snapshot.interim).toBe(""); expect(inputs).toEqual([]);
  });
  test("close while finishing prevents late parse", async () => {
    const { port, session, inputs } = setup(); await session.start(); port.stopEvent = false; port.abortEvent = false;
    const done = session.finish(); session.dispose(); port.result("Late result", true); port.end(); await done; expect(inputs).toEqual([]);
  });
  test("empty speech never reaches parser", async () => {
    const { session, inputs } = setup(); await session.start(); await session.finish(); expect(inputs).toEqual([]); expect(session.snapshot.error).toContain("SPEECH_EMPTY");
  });
  test("metering is real event-driven and bounded, never synthesized", async () => {
    const { port, session } = setup(); await session.start(); expect(session.snapshot.levels).toEqual([]);
    for (let i = 0; i < 40; i++) port.emit("volumechange", { value: i }); port.emit("volumechange", { value: NaN });
    expect(session.snapshot.levels.length).toBe(36); expect(Math.max(...session.snapshot.levels)).toBe(1);
  });
  test("60-second cap finishes and paused wall time does not count", async () => {
    jest.useFakeTimers(); jest.setSystemTime(1_000_000);
    const { port, session, inputs } = setup(); await session.start(); port.result("Timed task");
    jest.advanceTimersByTime(20_000); await session.pause(); jest.advanceTimersByTime(60_000); expect(inputs).toEqual([]);
    await session.start(true); jest.advanceTimersByTime(40_000); await flush(); expect(inputs).toEqual(["Timed task"]); expect(session.snapshot.seconds).toBe(60);
  });
  test("2,000-character budget bounds text and triggers review without extra saves", async () => {
    const { port, session, inputs } = setup(); await session.start(); port.result("x".repeat(3000)); await flush();
    expect(inputs).toHaveLength(1); expect(inputs[0].length).toBe(2000);
  });
  test("service startup timeout leaves actionable controls instead of stuck spinner", async () => {
    jest.useFakeTimers(); const { port, session } = setup(); port.startEvent = false; await session.start();
    jest.advanceTimersByTime(10_000); await flush(); expect(session.snapshot.phase).toBe("paused"); expect(session.snapshot.settling).toBe(false); expect(session.snapshot.error).toContain("SPEECH_START");
  });
  test("missing final/end is bounded; abort recovery keeps interim words", async () => {
    jest.useFakeTimers(); const { port, session, inputs } = setup(); await session.start(); port.result("Recovered interim"); port.stopEvent = false;
    const done = session.finish(); jest.advanceTimersByTime(4000); await flush(); await done;
    expect(port.aborts).toBe(1); expect(inputs).toEqual(["Recovered interim"]);
  });
  test("broken mic release fails closed and a later end restores controls", async () => {
    jest.useFakeTimers(); const { port, session, inputs } = setup(); await session.start(); port.result("Keep"); port.stopEvent = false; port.abortEvent = false;
    const done = session.finish(); jest.advanceTimersByTime(4000); await flush(); jest.advanceTimersByTime(1500); await flush(); await done;
    expect(inputs).toEqual([]); expect(session.snapshot.settling).toBe(true); expect(session.snapshot.error).toContain("SPEECH_STOP");
    await session.start(true); expect(port.starts).toBe(1); port.end(); expect(session.snapshot.settling).toBe(false);
  });
  test("parser rejection does not erase recognized words", async () => {
    const { port, session } = setup(true, async () => { throw Error("private server text"); }); await session.start(); port.result("Keep for editing"); await session.finish();
    expect(session.snapshot.interim).toBe("Keep for editing"); expect(session.snapshot.error).toContain("SPEECH_REVIEW");
  });
  test("all known service failures produce safe actionable messages", () => {
    for (const code of ["not-allowed", "network", "service-not-allowed", "language-not-supported", "no-speech", "speech-timeout", "busy", "unknown", "private message"]) {
      expect(speechError(code)).toContain("[SPEECH_"); expect(speechError(code)).not.toContain("private message");
    }
  });
});
