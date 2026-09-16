import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VoiceReceipt } from "./voice-draft-state";
const PREFIX = "steady.voice-pending.v1:";
let owner: string | null = null;
let revision = 0;
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>) { const next = queue.then(work, work); queue = next.catch(() => {}); return next; }
/** Auth gate calls this before exposing the next account. Old queued writes cannot resurrect its journal. */
export function setVoiceOwner(next: string | null) {
  if (owner === next) return;
  owner = next; revision++;
  const generation = revision;
  void serial(async () => {
    if (generation !== revision) return;
    const keys = await AsyncStorage.getAllKeys();
    if (generation !== revision) return;
    const obsolete = keys.filter(k => k.startsWith(PREFIX) && k !== (next ? PREFIX + next : ""));
    if (obsolete.length) await AsyncStorage.multiRemove(obsolete);
  }).catch(() => { console.warn("[voice] journal account cleanup failed"); });
}
export const voiceOwnerActive = (id: string) => owner === id;
export async function readVoiceJournal(id: string): Promise<VoiceReceipt[]> {
  return serial(async () => {
    if (owner !== id) return [];
    const raw = await AsyncStorage.getItem(PREFIX + id);
    if (!raw) return [];
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 20 || rows.some(r => !r?.payload?.requestId || typeof r.payload.title !== "string" || !["todo", "consistent"].includes(r.kind))) throw new Error("Pending-save recovery is unavailable. Check Today before recording again.");
    return rows as VoiceReceipt[];
  });
}
/** Store only explicitly submitted payloads; never audio/transcript or unsubmitted review cards. */
export function writeVoiceJournal(id: string, rows: VoiceReceipt[]) {
  const generation = revision;
  return serial(async () => {
    if (owner !== id || generation !== revision) throw new Error("Account changed. Reopen voice capture.");
    if (rows.length) await AsyncStorage.setItem(PREFIX + id, JSON.stringify(rows));
    else await AsyncStorage.removeItem(PREFIX + id);
  });
}
