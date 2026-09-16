import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { LiveSpeech, type SpeechPort } from "@/lib/live-speech";
import { continuousSpeechSupported } from "@/lib/native-speech";
import type { AssistantInput } from "../../web/src/shared/assistant-draft";

const noSpeech: SpeechPort = {
  isRecognitionAvailable: () => false, requestPermissionsAsync: async () => ({ granted: false }),
  getStateAsync: async () => "inactive", start: () => {}, stop: () => {}, abort: () => {},
  addListener: () => ({ remove() {} }),
};
export function useLiveSpeech(port: SpeechPort | null, onInput: (input: AssistantInput) => Promise<void>) {
  const input = useRef(onInput); input.current = onInput;
  // Created inside the effect for StrictMode's setup/cleanup replay safety.
  const [controller, setController] = useState<LiveSpeech>(() => new LiveSpeech(noSpeech, async () => {}, false));
  useEffect(() => {
    const session = new LiveSpeech(port ?? noSpeech, text => input.current({ transcript: text }), continuousSpeechSupported());
    setController(session);
    session.setActive(AppState.currentState === "active" || AppState.currentState === null);
    const sub = AppState.addEventListener("change", state => { session.setActive(state === "active"); });
    return () => { sub.remove(); session.dispose(); };
  }, [port]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return {
    ...state, live: true as const,
    meteringAvailable: state.levels.length > 0,
    start: () => controller.start(false),
    pause: () => state.phase === "paused" ? controller.start(true) : controller.pause(),
    finish: () => controller.finish(),
    cancel: () => controller.cancel(),
  };
}
