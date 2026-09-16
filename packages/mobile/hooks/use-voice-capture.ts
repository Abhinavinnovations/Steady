import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { File } from "expo-file-system";
import type { AssistantInput } from "../../web/src/shared/assistant-draft";
export type CapturePhase = "idle" | "starting" | "listening" | "paused" | "reading";
const isWeb = Platform.OS === "web";
import { useLiveSpeech } from "./use-live-speech";
import { nativeSpeech } from "@/lib/native-speech";

/** One microphone owner. Missing native module is a normal Expo Go/web fallback. */
export function useVoiceCapture(onInput: (input: AssistantInput) => Promise<void>, onError: (error: string) => void) {
  const [port] = useState(nativeSpeech);
  const [liveMode, setLiveMode] = useState(!!port);
  const live = useLiveSpeech(port, onInput);
  const recorded = useRecordedVoiceCapture(onInput, onError);
  const useRecording = async () => { if (await live.cancel()) setLiveMode(false); };
  const useLive = () => { if (recorded.phase === "idle" && port) setLiveMode(true); };
  const selected = liveMode ? live : { ...recorded, live: false as const, text: "", interim: "", error: null, settling: false };
  return { ...selected, liveAvailable: !!port, useRecording, useLive };
}

/** Original serialized file recorder, retained for stock Expo Go and web. */
function useRecordedVoiceCapture(onInput: (input: AssistantInput) => Promise<void>, onError: (error: string) => void) {
  const [phase, setPhase] = useState<CapturePhase>("idle"); const phaseRef = useRef<CapturePhase>("idle");
  const [denied, setDenied] = useState(false); const [levels, setLevels] = useState<number[]>([]);
  const token = useRef(0); const alive = useRef(true); const recording = useRef(false); const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inputRef = useRef(onInput); inputRef.current = onInput; const errorRef = useRef(onError); errorRef.current = onError;
  const transition = useCallback((p: CapturePhase) => { phaseRef.current = p; if (alive.current) setPhase(p); }, []);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true }, event => {
    if (event.hasError && ["starting", "listening", "paused"].includes(phaseRef.current)) {
      token.current++; errorRef.current("Recording was interrupted. Start again or type your tasks."); transition("idle"); void release();
    } else if (event.isFinished && phaseRef.current === "listening") {
      transition("paused"); errorRef.current("Recording stopped. Finish to recover its audio, or start again.");
    }
  });
  const status = useAudioRecorderState(recorder, 150);
  const serial = useCallback(<T,>(work: () => Promise<T>) => { const next = queue.current.then(work, work); queue.current = next.catch(() => {}); return next; }, []);
  const dispose = useCallback((uri: string | null) => { if (!uri) return; try { if (isWeb) URL.revokeObjectURL(uri); else { const f = new File(uri); if (f.exists) f.delete(); } } catch {} }, []);
  const stop = useCallback(async () => {
    if (recording.current) { recording.current = false; try { await recorder.stop(); } finally { if (!isWeb) await setAudioModeAsync({ allowsRecording: false }).catch(() => {}); } }
    else if (!isWeb) await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }, [recorder]);
  const release = useCallback(() => serial(async () => { try { await stop(); } catch {} finally { dispose(recorder.uri); } }), [serial, stop, dispose, recorder]);
  useEffect(() => { const life = alive; const session = token; life.current = true; return () => { life.current = false; session.current++; void release(); }; }, [release]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state !== "active" && phaseRef.current === "starting") { token.current++; void release(); transition("idle"); errorRef.current("Microphone setup was interrupted. Start again when ready."); }
      else if (state !== "active" && phaseRef.current === "listening") {
        try { recorder.pause(); transition("paused"); errorRef.current("Recording paused while Steady was away. Resume or Finish."); }
        catch { void release(); transition("idle"); errorRef.current("Recording was interrupted. Start again or type below."); }
      }
    }); return () => sub.remove();
  }, [recorder, release, transition]);
  useEffect(() => {
    if (status.mediaServicesDidReset && ["listening", "paused"].includes(phaseRef.current)) { token.current++; void release(); transition("idle"); errorRef.current("The phone reset its audio service. Please record again."); }
  }, [status.mediaServicesDidReset, release, transition]);
  useEffect(() => {
    if (phase === "listening" && status.metering !== undefined) setLevels(old => [...old.slice(-35), Math.max(0.04, Math.min(1, (status.metering! + 60) / 60))]);
  }, [status.metering, status.durationMillis, phase]);
  const start = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    const current = ++token.current; transition("starting"); setDenied(false); setLevels([]);
    await serial(async () => {
      try {
        if (current !== token.current) return;
        const permission = await requestRecordingPermissionsAsync();
        if (current !== token.current) return;
        if (!permission.granted) { setDenied(true); throw new Error("Microphone access is off. Allow it in Settings, or type your tasks."); }
        if (!isWeb) await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync(); recording.current = true;
        if (current !== token.current) { await stop(); dispose(recorder.uri); return; }
        recorder.record(); transition("listening");
      } catch (e) { await stop().catch(() => {}); dispose(recorder.uri); if (current === token.current && alive.current) { errorRef.current(e instanceof Error ? e.message : "Microphone could not start."); transition("idle"); } }
    });
  }, [serial, recorder, stop, dispose, transition]);
  const finish = useCallback(async () => {
    if (!["listening", "paused"].includes(phaseRef.current)) return;
    const current = token.current; transition("reading");
    try {
      const input = await serial(async (): Promise<AssistantInput | null> => {
        let uri: string | null = null;
        try {
          await stop(); uri = recorder.uri;
          if (current !== token.current || !alive.current) return null;
          if (!uri) throw new Error("No recording was saved. Please try again.");
          let audioBase64: string; let mimeType: AssistantInput["mimeType"] = "audio/mp4";
          if (isWeb) {
            const blob = await (await fetch(uri)).blob();
            mimeType = blob.type.includes("mp4") ? "audio/mp4" : blob.type.includes("ogg") ? "audio/ogg" : "audio/webm";
            audioBase64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1]); r.onerror = reject; r.readAsDataURL(blob); });
          } else audioBase64 = await new File(uri).base64();
          if (audioBase64.length < 350) throw new Error("That recording was too short. Speak for a few seconds, then Finish.");
          if (audioBase64.length > 8 * 1024 * 1024 * 1.4) throw new Error("Recording is too large. Try a shorter request.");
          return { audioBase64, mimeType };
        } finally { dispose(uri); }
      });
      if (input && current === token.current && alive.current) await inputRef.current(input);
    } catch (e) { if (current === token.current && alive.current) errorRef.current(e instanceof Error ? e.message : "Recording could not be read."); }
    finally { if (current === token.current && alive.current) transition("idle"); }
  }, [serial, stop, recorder, dispose, transition]);
  useEffect(() => { if (status.durationMillis >= 60_000 && status.isRecording && phaseRef.current === "listening") void finish(); }, [status.durationMillis, status.isRecording, finish]);
  const pause = () => { try { if (phaseRef.current === "paused") { recorder.record(); transition("listening"); } else if (phaseRef.current === "listening") { recorder.pause(); transition("paused"); } } catch { errorRef.current("Could not resume. Finish the available recording."); } };
  return { phase, denied, levels, meteringAvailable: status.metering !== undefined, seconds: Math.floor(status.durationMillis / 1000), start, pause, finish };
}
