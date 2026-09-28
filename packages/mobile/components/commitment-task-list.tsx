import { useRef, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useCompleteTask, useCurrentTasks, useToday, useUndoTask } from "@/queries/steady";
import { TaskRow } from "./task-row";
import { NoteSheet } from "./note-sheet";
import { SteadyButton } from "./steady-button";
import { formatDuration } from "./duration-wheel";

type Task = NonNullable<ReturnType<typeof useCurrentTasks>["data"]>["tasks"][number];

/** Same completion records, note requirement and daily reset as Consistent Tasks. */
export function CommitmentTaskList({ tasks, month, onEdit }: { tasks: Task[]; month: string; onEdit: (task: Task) => void }) {
  const c = useColors();
  const router = useRouter();
  const today = useToday();
  const complete = useCompleteTask();
  const undo = useUndoTask();
  const [noteTask, setNoteTask] = useState<{ id: number; title: string; expectedDate: string } | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const saving = useRef(false);
  const d = today.data;
  const active = !!d?.confirmed && d.month === month;
  const done = tasks.filter(t => d?.tasks.some(dayTask => dayTask.id === t.id && dayTask.completed)).length;
  const text = { color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20 };

  function check(task: Task) {
    const current = d?.tasks.find(t => t.id === task.id);
    if (!active || !d || !current || saving.current || complete.isPending || undo.isPending) return;
    setError(null);
    if (!current.completed) { setNoteError(null); setNoteTask({ id: task.id, title: task.title, expectedDate: d.localDate }); return; }
    const expectedDate = d.localDate;
    const run = () => undo.mutate({ taskId: task.id, expectedDate }, { onError: e => setError(e.message) });
    if (Platform.OS === "web") run();
    else Alert.alert("Undo completion?", `"${task.title}" will go back to pending.`, [{ text: "Cancel", style: "cancel" }, { text: "Undo", onPress: run }]);
  }
  async function save(note: string) {
    if (!noteTask || saving.current) return;
    saving.current = true; setNoteError(null);
    try {
      await complete.mutateAsync({ taskId: noteTask.id, expectedDate: noteTask.expectedDate, note });
      setNoteTask(null);
    } catch (e) { setNoteError(e instanceof Error ? e.message : "Could not save your completion. Retry."); }
    finally { saving.current = false; }
  }
  return <View style={{ gap: 12 }}>
    {active && <><Text accessibilityLiveRegion="polite" style={{ color: c.foreground, fontFamily: Fonts.medium, fontSize: 15 }}>{done} of {tasks.length} complete today</Text><Text style={text}>Tap a circle to complete or undo. Open task actions to increase focus time.</Text></>}
    {today.isError && <SteadyButton title="Retry daily completions" variant="outline" onPress={() => void today.refetch()}/>}
    {tasks.map(task => {
      const current = d?.tasks.find(t => t.id === task.id);
      const enabled = active && !!current && !today.isError;
      const completed = enabled && !!current?.completed;
      return <TaskRow key={task.id} title={task.title} consistent flagged={task.flagged} done={completed}
        subtitle={`${task.mode === "challenge" ? "Challenge" : "Basic"}${task.durationMinutes ? ` · ${formatDuration(task.durationMinutes)}` : ""} · ${enabled ? completed ? "Done today" : "Not done today" : `Starts ${task.startDate}`}`}
        checkDisabled={!enabled || complete.isPending || undo.isPending}
        onCheck={() => check(task)}
        onPress={() => { if (completed) setExpanded(expanded === task.id ? null : task.id); else if (enabled) check(task); }}
        onEdit={() => onEdit(task)}
        onFocus={enabled && !completed && task.durationMinutes ? () => router.push(`/timer/${task.id}`) : undefined}
        focusIdentity={enabled && task.durationMinutes && d ? { kind: "task", id: task.id, day: d.localDate, durationMinutes: task.durationMinutes } : undefined}>
        {completed && expanded === task.id ? <View style={{ gap: 8 }}><Text style={text}>{current?.note}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Undo completion for ${task.title}`} onPress={() => check(task)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...text, color: c.destructive }}>Undo completion</Text></Pressable></View> : null}
      </TaskRow>;
    })}
    {!!error && <Text accessibilityLiveRegion="polite" style={{ ...text, color: c.destructive }}>{error}</Text>}
    <NoteSheet visible={!!noteTask} taskTitle={noteTask?.title ?? ""} submitting={complete.isPending} error={noteError} onSubmit={note => void save(note)} onClose={() => { if (!saving.current) setNoteTask(null); }}/>
  </View>;
}
