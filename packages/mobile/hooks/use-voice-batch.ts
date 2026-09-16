import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { client, orpc } from "@/lib/api";
import { refreshReminders } from "@/lib/reminders";
import { voiceDiagnostic } from "@/lib/voice-diagnostics";
import { readVoiceJournal, voiceOwnerActive, writeVoiceJournal } from "@/lib/voice-save-journal";
import { definitiveRejection, editableCard, freezePayload, recoverCard, validCard, withDeadline, type VoiceCard } from "@/lib/voice-draft-state";

/** A mounted, account-owned review. Closing cancels future work, never an in-flight server write. */
export function useVoiceBatch(owner: string, today: string, staging = false) {
  const qc = useQueryClient();
  const [cards, setCards] = useState<VoiceCard[]>([]); const rows = useRef<VoiceCard[]>([]);
  const [busy, setBusy] = useState(false); const guard = useRef(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); const alive = useRef(true);
  const active = () => alive.current && voiceOwnerActive(owner);
  const replace = (next: VoiceCard[]) => { rows.current = next; if (active()) setCards(next); };
  const patch = (id: string, changes: Partial<VoiceCard>) => replace(rows.current.map(c => c.localId === id ? { ...c, ...changes } : c));
  const persist = () => writeVoiceJournal(owner, rows.current.filter(c => c.payload && ["saving", "unknown"].includes(c.status)).map(c => ({ kind: c.kind, localId: c.localId, payload: c.payload! })));
  useEffect(() => {
    alive.current = true;
    // Setup staging must never recover, overwrite or submit the global save journal.
    if (staging) { setLoading(false); return () => { alive.current = false; }; }
    void readVoiceJournal(owner).then(pending => { if (active()) { replace(pending.map(recoverCard)); setLoading(false); } }).catch(() => { if (active()) { setError("Pending-save recovery is unavailable. Close and check Today before trying again."); } });
    return () => { alive.current = false; };
    // This session is keyed by account and is never reused across owners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  function refresh() {
    if (!active()) return;
    void withDeadline(Promise.all([orpc.todos.key(), orpc.tasks.key(), orpc.today.key(), orpc.calendar.key()].map(queryKey => qc.invalidateQueries({ queryKey }))), 10_000)
      .then(() => { if (active()) voiceDiagnostic("refresh", "batch"); })
      .catch(() => { if (active()) setNotice("Tasks saved. Today is taking longer to refresh; pull to refresh there."); });
    if (!rows.current.some(c => c.status === "saved" && c.payload?.reminderEnabled)) { setNotice("Tasks saved. Find scheduled items on their date in Calendar."); return; }
    setNotice("Tasks saved. Checking reminders separately…");
    void withDeadline(refreshReminders(), 12_000).then(ok => {
      if (active()) { setNotice(ok ? "Tasks saved. Reminder check complete." : "Tasks saved; reminders unavailable. Check notification settings in Profile."); voiceDiagnostic("reminders", "batch", undefined, ok ? "OK" : "UNAVAILABLE"); }
    }).catch(() => { if (active()) { setNotice("Tasks saved; reminder check is delayed. Check notification settings in Profile."); voiceDiagnostic("reminders", "batch", undefined, "TIMEOUT"); } });
  }
  async function reconcile() {
    if (staging || guard.current || loading || !active()) return;
    const unknown = rows.current.filter(c => c.status === "unknown" && c.payload);
    if (!unknown.length) return;
    guard.current = true; setBusy(true); setError(null);
    try {
      const receipts = await withDeadline(client.assistant.receipts({ requestIds: unknown.map(c => c.payload!.requestId) }));
      if (!active()) return;
      for (const c of unknown) {
        const receipt = receipts.find(r => r.requestId === c.payload!.requestId && r.kind === c.kind);
        if (receipt) patch(c.localId, { status: "saved", savedId: receipt.id, selected: false, error: undefined, diagnostic: voiceDiagnostic("receipt", c.kind, c.payload!.requestId) });
        else patch(c.localId, { error: "No receipt yet. Retry unchanged with the same save ID; a delayed write may still finish." });
      }
      await persist();
      if (receipts.length) refresh();
    } catch (e) { if (active()) setError(e instanceof Error ? e.message : "Could not check saved status. Retry when connected."); }
    finally { guard.current = false; if (active()) setBusy(false); }
  }
  async function save() {
    if (staging || guard.current || loading || !active()) return;
    const selected = rows.current.filter(c => c.selected && c.status !== "saved");
    if (!selected.length || selected.some(c => !validCard(c, today))) return;
    guard.current = true; setBusy(true); setError(null); let saved = 0;
    try {
      for (const original of selected) {
        if (!active()) break;
        const payload = original.payload ?? freezePayload(original, randomUUID(), today);
        const diagnostic = voiceDiagnostic("press", original.kind, payload.requestId);
        patch(original.localId, { status: "saving", payload, error: undefined, diagnostic });
        try { await persist(); }
        catch { patch(original.localId, { status: original.payload ? "unknown" : "rejected", payload: original.payload, error: "Could not store retry protection. Nothing new was submitted. Close and check your device storage." }); break; }
        if (!active()) break;
        try {
          voiceDiagnostic("request", original.kind, payload.requestId);
          const result = await withDeadline<{ id: number }>(original.kind === "todo" ? client.todos.create(payload) : client.tasks.create(payload));
          if (!active()) break;
          saved++; patch(original.localId, { status: "saved", savedId: result.id, selected: false, error: undefined, diagnostic: voiceDiagnostic("saved", original.kind, payload.requestId) });
        } catch (e) {
          if (!active()) break;
          const code = (e as { code?: string })?.code;
          const rejected = definitiveRejection(code);
          patch(original.localId, { status: rejected ? "rejected" : "unknown", payload: rejected ? undefined : payload,
            error: rejected ? (e instanceof Error ? e.message : "Review this task and try again.") : "Save not confirmed. Details are locked to prevent duplicates. Check saved status or retry unchanged.",
            diagnostic: voiceDiagnostic(rejected ? "rejected" : "unknown", original.kind, payload.requestId, code) });
        }
        try { await persist(); } catch { if (active()) setError("Saved-status recovery could not update. Check Today before starting a new recording."); break; }
      }
    } finally { guard.current = false; if (active()) { setBusy(false); if (saved) refresh(); } }
  }
  function edit(id: string, changes: Partial<VoiceCard>) {
    if (guard.current) return;
    const card = rows.current.find(c => c.localId === id);
    if (card && editableCard(card)) patch(id, { ...changes, status: "editable", payload: undefined, error: undefined, diagnostic: undefined });
  }
  function select(id: string) { if (!guard.current) replace(rows.current.map(c => c.localId === id && c.status !== "saved" ? { ...c, selected: !c.selected } : c)); }
  return { cards, busy, loading, error, notice, replace, edit, select, save, reconcile, submitted: cards.some(c => !!c.payload || c.status === "saved") };
}
