import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useAddCommitmentTask, useToday } from "@/queries/steady";
import { definitiveRejection, withDeadline } from "@/lib/voice-draft-state";
import { AddTaskSheet, type TaskSheetValues } from "./add-task-sheet";
import { SteadyButton } from "./steady-button";

type Payload = Parameters<ReturnType<typeof useAddCommitmentTask>["mutateAsync"]>[0];

export function AddCommitmentTask({ count }: { count: number }) {
  const c = useColors();
  const today = useToday();
  const create = useAddCommitmentTask();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef<Payload | null>(null);
  const saving = useRef(false);
  async function save(values: TaskSheetValues) {
    if (saving.current || !today.data) return;
    saving.current = true; setBusy(true); setError(null); setNotice(null);
    request.current ??= {
      requestId: randomUUID(), expectedDate: today.data.localDate, title: values.title,
      ...(values.durationMinutes != null ? { durationMinutes: values.durationMinutes } : {}),
      ...(values.categoryId != null ? { categoryId: values.categoryId } : {}),
      ...(values.scheduledTime ? { scheduledTime: values.scheduledTime } : {}),
      reminderEnabled: values.reminderEnabled,
    };
    try {
      const task = await withDeadline(create.mutateAsync(request.current));
      const next = new Date(task.startDate + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
      setNotice(`Added to your commitment. Available from ${task.startDate}; email accountability begins ${next.toISOString().slice(0, 10)} in your account timezone.`);
      request.current = null; setFrozen(false); setVisible(false);
    } catch (e) {
      if (definitiveRejection((e as { code?: string })?.code)) {
        request.current = null; setFrozen(false); void today.refetch();
        setError(e instanceof Error ? e.message : "Could not add this task. Retry.");
      } else {
        setFrozen(true);
        setError("Save not confirmed. Retry unchanged to check the same save, without creating a duplicate.");
      }
    } finally { saving.current = false; setBusy(false); }
  }
  return <View style={{ gap: 10 }}>
    <SteadyButton title={frozen ? "Resume commitment save" : "Add commitment task"} variant="outline" disabled={busy || !today.data || (count >= 10 && !frozen)} onPress={() => { if (!frozen) setError(null); setVisible(true); }}/>
    {count >= 10 && <Text style={{ color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 12 }}>This month has reached the existing 10-task limit.</Text>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20 }}>{notice}</Text>}
    <AddTaskSheet commitment frozen={frozen} todayISO={today.data?.localDate ?? ""} monthLocked onChallengeSetup={() => {}} visible={visible} submitting={busy} error={error} onSubmit={values => void save(values)} onClose={() => { if (!saving.current) setVisible(false); }}/>
  </View>;
}
