import type { ExpoSpeechRecognitionOptions } from "expo-speech-recognition";

export type SpeechPhase = "idle" | "starting" | "listening" | "paused" | "reading";
type SpeechEvents = {
  start: undefined;
  end: undefined;
  result: { isFinal: boolean; results: { transcript: string }[] };
  error: { error: string };
  volumechange: { value: number };
};
export interface SpeechPort {
  isRecognitionAvailable(): boolean;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  getStateAsync(): Promise<string>;
  start(options: ExpoSpeechRecognitionOptions): void;
  stop(): void;
  abort(): void;
  addListener<K extends keyof SpeechEvents>(name: K, callback: (event: SpeechEvents[K]) => void): { remove(): void };
}
export type SpeechSnapshot = {
  phase: SpeechPhase; text: string; interim: string; seconds: number;
  levels: number[]; denied: boolean; error: string | null; settling: boolean;
};
const initial = (): SpeechSnapshot => ({ phase: "idle", text: "", interim: "", seconds: 0, levels: [], denied: false, error: null, settling: false });
const join = (...parts: string[]) => parts.filter(Boolean).join(" ").trim().slice(0, 2000);
export const speechError = (code: string) => ({
  "not-allowed": "Allow microphone and speech recognition in Settings, or type your tasks. [SPEECH_PERMISSION]",
  "network": "Your speech service lost its connection. Keep the words below, retry, or use recording. [SPEECH_NETWORK]",
  "service-not-allowed": "No speech recognition service is available. Use recording or type your tasks. [SPEECH_SERVICE]",
  "language-not-supported": "Your speech service does not support the selected language. Use recording or type. [SPEECH_LANGUAGE]",
  "no-speech": "No clear speech was detected. Resume, use recording, or type. [SPEECH_EMPTY]",
  "speech-timeout": "Your speech service paused. Resume to continue, or Finish with the words below. [SPEECH_PAUSED]",
  "busy": "The microphone or speech service is busy. Close other voice apps and retry. [SPEECH_BUSY]",
}[code] ?? "Speech was interrupted. Keep the words below, use recording, or type. [SPEECH_INTERRUPTED]");

/** No storage/network here. This controller owns only recognition; never expo-audio.
 * End is the release barrier. Old Android services may end after each utterance:
 * keep the words and offer Resume, rather than restarting an unbounded mic loop.
 */
export class LiveSpeech {
  snapshot = initial();
  private listeners = new Set<() => void>();
  private subscriptions: { remove(): void }[] = [];
  private epoch = 0;
  private dead = false;
  private owned = false;
  private ended: (() => void) | null = null;
  private endPromise: Promise<void> = Promise.resolve();
  private interval: ReturnType<typeof setInterval> | undefined;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;
  private elapsed = 0;
  private began = 0;
  private input: (text: string) => Promise<void>;
  private finishing = false;
  private active = true;
  private now: () => number;

  constructor(private port: SpeechPort, input: (text: string) => Promise<void>, private continuous: boolean, now = Date.now) {
    this.input = input; this.now = now;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  setActive(active: boolean) {
    this.active = active;
    if (!active && this.snapshot.phase === "listening") void this.pause();
  }
  private update(change: Partial<SpeechSnapshot>) {
    if (this.dead) return;
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.listeners) listener();
  }
  private freeze() {
    if (this.began) { this.elapsed += this.now() - this.began; this.began = 0; }
    clearInterval(this.interval); this.interval = undefined;
  }
  private clearEvents() {
    clearTimeout(this.startupTimer);
    this.subscriptions.forEach(sub => sub.remove()); this.subscriptions = [];
  }
  private end() {
    this.freeze(); this.owned = false; this.clearEvents();
    this.ended?.(); this.ended = null;
    if (this.snapshot.phase === "listening" || this.snapshot.phase === "starting") {
      this.update({ phase: "paused", settling: false, error: this.snapshot.error ?? "Speech service paused. Tap Resume to continue, or Finish." });
    } else if (this.snapshot.phase === "paused" && !this.finishing) this.update({ settling: false });
  }
  async start(resume = false) {
    if (this.dead || this.snapshot.settling || this.finishing || !["idle", "paused"].includes(this.snapshot.phase)) return;
    const current = ++this.epoch;
    if (!resume) { this.elapsed = 0; this.update(initial()); }
    else this.update({ text: join(this.snapshot.text, this.snapshot.interim), interim: "" });
    this.update({ phase: "starting", error: null, denied: false });
    try {
      if (!this.port.isRecognitionAvailable()) throw new Error("service-not-allowed");
      const permission = await this.port.requestPermissionsAsync();
      if (current !== this.epoch || this.dead) return;
      if (!permission.granted) { this.update({ denied: true }); throw new Error("not-allowed"); }
      // Never steal a microphone still being released by an older mounted session.
      if (await this.boundedState() !== "inactive") throw new Error("busy");
      if (current !== this.epoch || this.dead) return;
      if (!this.active) { this.update({ phase: "paused", error: "Return to Steady, then Resume to start listening." }); return; }
      this.endPromise = new Promise(resolve => { this.ended = resolve; });
      const on = <K extends keyof SpeechEvents>(name: K, callback: (event: SpeechEvents[K]) => void) => {
        this.subscriptions.push(this.port.addListener(name, event => { if (this.epoch === current) callback(event); }));
      };
      on("start", () => {
        clearTimeout(this.startupTimer);
        if (this.dead || this.snapshot.settling) return;
        this.began = this.now(); this.update({ phase: "listening" });
        if (!this.active) { void this.pause(); return; }
        this.interval = setInterval(() => {
          const ms = this.elapsed + (this.began ? this.now() - this.began : 0);
          this.update({ seconds: Math.min(60, Math.floor(ms / 1000)) });
          if (ms >= 60_000) void this.finish();
        }, 200);
      });
      on("result", event => {
        if (this.dead) return;
        const words = event.results[0]?.transcript?.trim();
        if (!words) return;
        // Interim hypotheses replace one another; a final result commits one segment.
        if (event.isFinal) this.update({ text: join(this.snapshot.text, words), interim: "" });
        else this.update({ interim: words.slice(0, Math.max(0, 2000 - this.snapshot.text.length - (this.snapshot.text ? 1 : 0))) });
        if (join(this.snapshot.text, this.snapshot.interim).length >= 2000) void this.finish();
      });
      on("volumechange", event => {
        if (this.snapshot.phase !== "listening" || !Number.isFinite(event.value)) return;
        this.update({ levels: [...this.snapshot.levels.slice(-35), Math.max(0.03, Math.min(1, event.value / 10))] });
      });
      on("error", event => {
        if (event.error !== "aborted") this.update({ error: speechError(event.error), denied: event.error === "not-allowed" });
        // Per native contract, end follows error. Bound broken services via pause().
        if (!this.snapshot.settling && !this.dead) void this.pause();
      });
      on("end", () => this.end());
      this.owned = true;
      this.startupTimer = setTimeout(() => {
        this.update({ error: "Speech service did not start. Try recording or type your tasks. [SPEECH_START]" });
        void this.pause();
      }, 10_000);
      this.port.start({
        lang: "en-US", interimResults: true, continuous: this.continuous, maxAlternatives: 1,
        requiresOnDeviceRecognition: false, addsPunctuation: false,
        recordingOptions: { persist: false }, volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
      });
    } catch (e) {
      if (current !== this.epoch || this.dead) return;
      if (this.owned) await this.release(true);
      this.update({ phase: "paused", error: speechError(e instanceof Error ? e.message : "unknown") });
    }
  }
  private async waitEnd(ms: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([this.endPromise.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), ms); })]); }
    finally { clearTimeout(timer); }
  }
  private async boundedState() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([this.port.getStateAsync(), new Promise<string>(resolve => { timer = setTimeout(() => resolve("unknown"), 1000); })]); }
    finally { clearTimeout(timer); }
  }
  private async release(abort = false): Promise<boolean> {
    this.freeze(); clearTimeout(this.startupTimer);
    if (!this.owned) return true;
    try { if (abort) this.port.abort(); else this.port.stop(); } catch { /* Check state below. */ }
    if (await this.waitEnd(abort ? 1500 : 4000)) return true;
    try {
      this.port.abort();
      if (await this.waitEnd(1500)) return true;
      const state = await this.boundedState();
      if (state === "inactive") { this.end(); return true; }
    } catch { /* Fail closed: no new mic owner until end arrives. */ }
    this.update({ error: "Speech service did not release the microphone. Close voice capture and retry. [SPEECH_STOP]" });
    return false;
  }
  async pause() {
    if (this.dead || this.snapshot.settling || !["listening", "starting"].includes(this.snapshot.phase)) return;
    // Permission request may still be open; invalidate it without opening the mic.
    if (!this.owned) { this.epoch++; this.update({ phase: "paused" }); return; }
    this.update({ phase: "paused", settling: true });
    const released = await this.release();
    this.update({ settling: !released });
  }
  async finish() {
    if (this.dead || this.finishing || this.snapshot.settling || !["listening", "paused"].includes(this.snapshot.phase)) return;
    this.finishing = true;
    const current = this.epoch;
    this.update({ phase: "reading", settling: true });
    try {
      if (!await this.release()) return;
      if (this.dead || current !== this.epoch) return;
      const text = join(this.snapshot.text, this.snapshot.interim);
      if (text.length < 2) { this.update({ error: speechError("no-speech") }); return; }
      // Only this explicit action (or documented 60-second cap) reaches Steady.
      await this.input(text);
    } catch {
      this.update({ error: "Could not review these words. They remain below; type or retry. [SPEECH_REVIEW]" });
    } finally {
      this.finishing = false;
      if (!this.dead && current === this.epoch) this.update({ phase: this.owned ? "paused" : "idle", settling: this.owned });
    }
  }
  /** Explicit mode switch discards only this in-memory dictation. */
  async cancel() {
    if (this.finishing || this.snapshot.settling) return false;
    this.update({ settling: true });
    const released = await this.release(true);
    if (!released) return false;
    this.epoch++; this.elapsed = 0; this.update(initial()); return true;
  }
  dispose() {
    this.dead = true; this.listeners.clear();
    if (this.owned) void this.release(true).then(() => { this.clearEvents(); this.epoch++; });
    else { this.epoch++; this.clearEvents(); }
  }
}
