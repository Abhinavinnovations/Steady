import AsyncStorage from "@react-native-async-storage/async-storage";
import { savedRemaining } from "./focus-progress";

// Serialize checkpoints and close writes, so an older async write cannot win.
const writes = new Map<string, Promise<void>>();
const listeners = new Set<(key: string) => void>();
export function saveFocus(key: string, seconds: number) {
  const next = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    await AsyncStorage.setItem(key, String(Math.max(0, seconds)));
    listeners.forEach(notify => notify(key));
  });
  writes.set(key, next);
  void next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => {});
  return next;
}
export async function readFocus(key: string, total: number) {
  await writes.get(key)?.catch(() => {});
  return savedRemaining(await AsyncStorage.getItem(key), total);
}
export function subscribeFocus(notify: (key: string) => void) {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}
