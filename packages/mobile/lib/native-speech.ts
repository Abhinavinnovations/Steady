import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type { SpeechPort } from "./live-speech";

// Never runtime-import expo-speech-recognition: its mandatory native lookup throws
// inside stock Expo Go. Autolinking/config plugin still include it in custom builds.
export function nativeSpeech(): SpeechPort | null {
  if (Platform.OS === "web") return null;
  try { return requireOptionalNativeModule<SpeechPort>("ExpoSpeechRecognition"); }
  catch { return null; }
}

export function continuousSpeechSupported() {
  return Platform.OS !== "android" || Number(Platform.Version) >= 33;
}
