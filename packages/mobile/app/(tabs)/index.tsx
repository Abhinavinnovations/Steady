import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { TaskRow } from "@/components/task-row";
import { repeatLabels } from "@/lib/recurrence";
import { ProgressRing } from "@/components/progress-ring";
import { NoteSheet } from "@/components/note-sheet";
import { AddTaskSheet, type TaskSheetValues } from "@/components/add-task-sheet";
import { AddTodoSheet, type TodoSheetValues } from "@/components/add-todo-sheet";
import { VoiceSheet } from "@/components/voice-sheet";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { formatDuration } from "@/components/duration-wheel";
import { formatTime12 } from "@/components/schedule-fields";
import { usePartner } from "@/queries/partners";
import {
  cancelReminder,
  reportReminder,
  refreshReminders,
  taskReminderId,
  todoReminderId,
} from "@/lib/reminders";
import { useTabClearance } from "@/components/paper-tab-bar";
import { PaperHeading } from "@/components/paper-heading";
import {
  useCompleteTask,
  useCopyPrevious,
  useCreateTask,
  useProfile,
  useToday,
  useUndoTask,
} from "@/queries/steady";
import {
  useCategories,
  useCreateTodo,
  useRemoveCategory,
  useRemoveTodo,
  useTodos,
  useToggleTodo,
  useUpdateTask,
  useUpdateTodo,
} from "@/queries/todos";

type TodayTask = {
  id: number;
  title: string;
  completed: boolean;
  flagged: boolean;
  note: string | null;
  durationMinutes: number | null;
  categoryId: number | null;
  scheduledTime: string | null;
  reminderEnabled: boolean;
  mode: "basic" | "challenge";
};

type Todo = NonNullable<ReturnType<typeof useTodos>["data"]>["todos"][number];

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function TodayScreen() {
  const colors = useColors();
  const tabClearance = useTabClearance();
  const router = useRouter();
  const profile = useProfile();
  const today = useToday();
  const todos = useTodos();
  const categories = useCategories();
  const complete = useCompleteTask();
  const undo = useUndoTask();
  const copyPrevious = useCopyPrevious();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const toggleTodo = useToggleTodo();
  const removeTodo = useRemoveTodo();
  const removeCategory = useRemoveCategory();

  const params = useLocalSearchParams<{ note?: string; noteDate?: string }>();
  const accountability = usePartner();

  const [noteTask, setNoteTask] = useState<(TodayTask & { expectedDate: string }) | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [flagOnly, setFlagOnly] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [catFilter, setCatFilter] = useState<number | "all">("all");

  // Consistent-task sheet (create or edit-settings)
  const [taskSheet, setTaskSheet] = useState<
    { mode: "create" } | { mode: "edit"; task: TodayTask } | null
  >(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  // To-do sheet (create or edit)
  const [todoSheet, setTodoSheet] = useState<
    { mode: "create" } | { mode: "edit"; todo: Todo } | null
  >(null);
  const [todoError, setTodoError] = useState<string | null>(null);

  // Voice assistant sheet
  const [voiceOpen, setVoiceOpen] = useState(false);

  async function submitTaskSheet(v: TaskSheetValues) {
    setTaskError(null);
    try {
      if (taskSheet?.mode === "edit") {
        const id = taskSheet.task.id;
        await updateTask.mutateAsync({
          id,
          durationMinutes: v.durationMinutes,
          categoryId: v.categoryId,
          scheduledTime: v.scheduledTime,
          reminderEnabled: v.reminderEnabled,
          mode: v.mode,
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void refreshReminders().then(reportReminder);
        } else {
          void cancelReminder(taskReminderId(id));
        }
      } else {
        await createTask.mutateAsync({
          title: v.title,
          mode: v.mode,
          ...(v.durationMinutes ? { durationMinutes: v.durationMinutes } : {}),
          ...(v.categoryId ? { categoryId: v.categoryId } : {}),
          ...(v.scheduledTime ? { scheduledTime: v.scheduledTime } : {}),
          ...(v.reminderEnabled ? { reminderEnabled: true } : {}),
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void refreshReminders().then(reportReminder);
        }
      }
      setTaskSheet(null);
    } catch (e: any) {
      setTaskError(e?.message ?? "Couldn't save the task");
    }
  }

  async function submitTodoSheet(v: TodoSheetValues) {
    setTodoError(null);
    try {
      if (todoSheet?.mode === "edit") {
        const id = todoSheet.todo.id;
        await updateTodo.mutateAsync({
          id,
          title: v.title,
          durationMinutes: v.durationMinutes,
          dueDate: v.dueDate,
          repeat: v.repeat,
          scheduledTime: v.scheduledTime,
          reminderEnabled: v.reminderEnabled,
          categoryId: v.categoryId,
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void refreshReminders().then(reportReminder);
        } else {
          void cancelReminder(todoReminderId(id));
        }
      } else {
        await createTodo.mutateAsync({
          title: v.title,
          dueDate: v.dueDate,
          repeat: v.repeat,
          ...(v.durationMinutes ? { durationMinutes: v.durationMinutes } : {}),
          ...(v.categoryId ? { categoryId: v.categoryId } : {}),
          ...(v.scheduledTime ? { scheduledTime: v.scheduledTime } : {}),
          ...(v.reminderEnabled ? { reminderEnabled: true } : {}),
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void refreshReminders().then(reportReminder);
        }
      }
      setTodoSheet(null);
    } catch (e: any) {
      setTodoError(e?.message ?? "Couldn't save the to-do");
    }
  }

  function confirmDeleteTodo(todo: Todo) {
    const run = () => {
      void cancelReminder(todoReminderId(todo.id));
      removeTodo.mutate({ id: todo.id }, { onError: e => setActionError(e.message) });
    };
    if (Platform.OS === "web") {
      if (window.confirm("Delete this item? This cannot be undone.")) run();
      return;
    }
    Alert.alert("Delete to-do?", `"${todo.title}" will be gone for good.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: run },
    ]);
  }

  function confirmDeleteCategory(id: number, name: string) {
    const run = () => {
      if (catFilter === id) setCatFilter("all");
      removeCategory.mutate({ id });
    };
    if (Platform.OS === "web") {
      if (window.confirm("Delete this item? This cannot be undone.")) run();
      return;
    }
    Alert.alert(
      "Delete category?",
      `Tasks tagged "${name}" stay — they just lose the label.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: run },
      ],
    );
  }

  // Timer finished → open the note sheet for that task.
  useEffect(() => {
    if (!params.note || !today.data) return;
    const t = today.data.tasks.find((x) => String(x.id) === params.note);
    router.setParams({ note: undefined, noteDate: undefined });
    if (!params.noteDate || params.noteDate !== today.data.localDate) {
      setActionError("The date changed during focus. Review Today before completing a task.");
      return;
    }
    if (t && !t.completed) {
      setNoteError(null);
      setNoteTask({ ...t, expectedDate: params.noteDate });
    }
  }, [params.note, params.noteDate, today.data, router]);

  if (profile.isLoading || today.isLoading) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (profile.isSuccess && profile.data === null) {
    return <Redirect href="/onboarding" />;
  }

  const d = today.data;
  if (!d) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans }}>
          Couldn't load today. Pull to retry.
        </Text>
        <SteadyButton
          title="Retry"
          variant="outline"
          onPress={() => today.refetch()}
          style={{ marginTop: 16, alignSelf: "stretch" }}
        />
      </SafeAreaView>
    );
  }

  const dateLabel = new Date(`${d.localDate}T12:00:00`).toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const progress = d.totalCount > 0 ? d.doneCount / d.totalCount : 0;
  const subline = d.allDone
    ? "That's a full day. See you tomorrow."
    : d.yesterdayStatus === "missed"
      ? "Fresh start today."
      : "Do one thing, write one line.";

  const catList = categories.data ?? [];
  const visibleTasks = d.tasks.filter(t => (catFilter === "all" || t.categoryId === catFilter) && (!flagOnly || t.flagged)).sort((a,b)=>Number(b.flagged)-Number(a.flagged));
  const todoList = todos.data?.todos ?? [];
  const visibleTodos = todoList.filter(t => (catFilter === "all" || t.categoryId === catFilter) && (!flagOnly || t.flagged));
  function focus(t: TodayTask | Todo, todo: boolean) {
    if (!todo && !d?.confirmed) { setActionError("Confirm this month before starting focus."); return; }
    if (!t.durationMinutes) { if (todo) { setTodoError("Choose a focus duration, then save."); setTodoSheet({mode:"edit",todo:t as Todo}); } else { setTaskError("Choose a focus duration, then save."); setTaskSheet({mode:"edit",task:t as TodayTask}); } return; }
    router.push(todo ? `/timer/${t.id}?type=todo&occurrenceDate=${(t as Todo).occurrenceDate}` : `/timer/${t.id}`);
  }


  async function submitNote(note: string) {
    if (!noteTask) return;
    setNoteError(null);
    try {
      await complete.mutateAsync({ taskId: noteTask.id, expectedDate: noteTask.expectedDate, note });
      setNoteTask(null);
    } catch (e: any) {
      setNoteError(e?.message ?? "Couldn't save");
    }
  }

  function confirmUndo(task: TodayTask) {
    const expectedDate = d!.localDate;
    if (Platform.OS === "web") {
      undo.mutate({ taskId: task.id, expectedDate }, { onError: e => setActionError(e.message) });
      return;
    }
    Alert.alert("Undo completion?", `"${task.title}" will go back to pending.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => undo.mutate({ taskId: task.id, expectedDate }, { onError: e => setActionError(e.message) }) },
    ]);
  }

  const catName = (id: number | null) =>
    id === null ? null : (catList.find((c) => c.id === id)?.name ?? null);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <GradientBackdrop />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: tabClearance, width: "100%", maxWidth: 700, alignSelf: "center" }}
        refreshControl={
          <RefreshControl
            refreshing={today.isRefetching}
            onRefresh={() => {
              void today.refetch();
              void todos.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <PaperHeading title="Today" subtitle={dateLabel} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add task by voice"
            onPress={() => setVoiceOpen(true)}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              marginRight: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="mic-outline" size={19} color={colors.primary} />
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="flame" size={16} color={colors.streak} />
            <Text
              style={{
                color: colors.streak,
                fontFamily: Fonts?.semibold,
                fontSize: 15,
              }}
            >
              {d.streak}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 26, paddingVertical: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <ProgressRing progress={progress} size={86} strokeWidth={5}>
            <Text style={{ color: colors.foreground, fontFamily: Fonts.semibold, fontSize: 20 }}>{d.doneCount}<Text style={{color:colors.mutedForeground,fontSize:13}}>/{d.totalCount}</Text></Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{color:colors.primary,fontFamily:Fonts.medium,fontSize:10,letterSpacing:1.5}}>YOUR DAILY COMMITMENT</Text>
            <Text style={{color:colors.foreground,fontFamily:Fonts.display,fontSize:29,lineHeight:33}}>{d.allDone ? "A day well spent." : "One thing at a time."}</Text>
            <Text style={{color:colors.mutedForeground,fontFamily:Fonts.sans,fontSize:12,lineHeight:19}}>{subline}</Text>
          </View>
        </View>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:18}}>
          <Text style={{flex:1,color:colors.mutedForeground,fontFamily:Fonts.sans,fontSize:11}}>{profile.data?.timezone} · Swipe left for actions</Text>
          <Pressable accessibilityRole="button" accessibilityState={{selected:flagOnly}} aria-pressed={flagOnly} onPress={()=>setFlagOnly(!flagOnly)} style={{minHeight:44,flexDirection:"row",gap:6,alignItems:"center",paddingHorizontal:10}}><Ionicons name={flagOnly?"flag":"flag-outline"} size={16} color={colors.primary}/><Text style={{color:colors.primary,fontFamily:Fonts.medium,fontSize:12}}>{flagOnly?"Flagged":"All tasks"}</Text></Pressable>
        </View>
        {actionError && <Pressable onPress={()=>setActionError(null)}><Text accessibilityLiveRegion="polite" style={{color:colors.destructive,fontFamily:Fonts.sans,paddingVertical:12}}>{actionError}</Text></Pressable>}

        {/* Month not confirmed (rollover) */}
        {!d.confirmed ? (
          <View
            style={{
              marginTop: 20,
              backgroundColor: colors.primarySoft,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.primary,
              padding: 16,
              gap: 10,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontFamily: Fonts?.semibold,
                fontSize: 15,
              }}
            >
              {d.hasCommittedBefore ? "New month, new commitment" : "A commitment, when you’re ready"}
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {d.hasCommittedBefore ? "Confirm your tasks for this month to start ticking days again." : "To-dos work right away. A daily commitment is optional; saved drafts stay here until you confirm."}
            </Text>
            <SteadyButton
              title={d.hasCommittedBefore ? "Set up this month" : "Set up your commitment"}
              onPress={() => router.push("/onboarding?step=tasks")}
            />
            {d.hasCommittedBefore && <SteadyButton
              title={
                copyPrevious.isPending ? "Copying..." : "Reuse last month's tasks"
              }
              variant="outline"
              onPress={async () => {
                if (copyPrevious.isPending) return;
                try {
                  await copyPrevious.mutateAsync({});
                } catch {
                  // No previous month or already confirmed — setup flow handles it.
                }
                router.push("/onboarding?step=tasks");
              }}
            />}
          </View>
        ) : null}

        {/* Challenge tasks without a verified accountability contact */}
        {d.tasks.some((t) => t.mode === "challenge") &&
        accountability.isSuccess &&
        accountability.data?.outgoing?.status !== "accepted" ? (
          <GlassCard style={{ marginTop: 20 }} padding={16} radius={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="shield-outline" size={22} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 14,
                  }}
                >
                  No accepted accountability contact
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  Invite an accountability contact in Profile and wait for acceptance. Pending and old email-code contacts receive no alerts.
                </Text>
              </View>
              <Pressable onPress={() => router.push("/profile")} hitSlop={8}>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: Fonts?.semibold,
                    fontSize: 13,
                  }}
                >
                  Add
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        {/* Category filter — appears once the user has made categories */}
        {catList.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 24 }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[{ id: "all" as const, name: "All" }, ...catList].map((c) => {
                const active = catFilter === c.id;
                return (
                  <Pressable
                    key={String(c.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Category: ${c.name}`}
                    accessibilityState={{ selected: active }}
                    aria-pressed={active}
                    onPress={() => setCatFilter(c.id as number | "all")}
                    onLongPress={
                      c.id === "all"
                        ? undefined
                        : () => confirmDeleteCategory(c.id as number, c.name)
                    }
                    style={({ pressed }) => ({
                      minHeight: 44,
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primarySoft : colors.card,
                      borderRadius: 999,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.mutedForeground,
                        fontFamily: Fonts?.semibold,
                        fontSize: 13,
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}

        {/* Consistent tasks — the month-locked list that builds the streak */}
        <View
          style={{
            marginTop: catList.length > 0 ? 20 : 28,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="flame-outline" size={13} color={colors.mutedForeground} />
          <Text
            style={{
              color: colors.foreground,
              fontFamily: Fonts.display,
              fontSize: 27,
              lineHeight: 33,
            }}
          >
            Consistent
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          {visibleTasks.map(t => <TaskRow key={t.id} title={t.title} focusIdentity={t.durationMinutes ? {kind:"task",id:t.id,day:d.localDate,durationMinutes:t.durationMinutes} : undefined} consistent done={t.completed} flagged={t.flagged}
            subtitle={[t.scheduledTime ? formatTime12(t.scheduledTime) : null, t.durationMinutes ? formatDuration(t.durationMinutes) : null, catName(t.categoryId),t.mode === "challenge" ? "Challenge" : "Daily commitment"].filter(Boolean).join(" · ")}
            onPress={()=>{if(!d.confirmed)return;if(t.completed)setExpanded(expanded===t.id?null:t.id);else{setNoteError(null);setNoteTask({...t,expectedDate:d.localDate});}}}
            onSchedule={()=>{setTaskError(null);setTaskSheet({mode:"edit",task:t});}}
            onFlag={()=>updateTask.mutate({id:t.id,flagged:!t.flagged},{onError:e=>setActionError(e.message)})}
            onFocus={t.completed?undefined:()=>focus(t,false)}>
            {t.completed && expanded===t.id ? <View style={{gap:10}}><Text style={{color:colors.mutedForeground,fontFamily:Fonts.sans,fontSize:13,lineHeight:20}}>“{t.note}”</Text><Pressable accessibilityRole="button" onPress={()=>confirmUndo(t)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:colors.destructive,fontFamily:Fonts.medium}}>Undo completion</Text></Pressable></View>:null}
          </TaskRow>)}
          {visibleTasks.length === 0 && d.confirmed ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 20,
              }}
            >
              {catFilter === "all"
                ? "No tasks yet this month."
                : "Nothing consistent in this category."}
            </Text>
          ) : null}
          {d.confirmed && d.tasks.length < 10 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a task"
              onPress={() => {
                setTaskError(null);
                setTaskSheet({ mode: "create" });
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border,
                borderRadius: 16,
                paddingVertical: 14,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: Fonts?.semibold,
                  fontSize: 14,
                }}
              >
                Add a task
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Temporary to-dos — casual, deletable, no streak impact */}
        <View
          style={{
            marginTop: 28,
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons
            name="checkbox-outline"
            size={13}
            color={colors.mutedForeground}
          />
          <Text
            style={{
              flex: 1,
              color: colors.foreground,
              fontFamily: Fonts.display,
              fontSize: 27,
              lineHeight: 33,
            }}
          >
            To-dos
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: Fonts?.sans,
              fontSize: 11,
            }}
          >
            no streak, no pressure
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          {todos.isError && <Pressable accessibilityRole="button" accessibilityLabel="Retry to-dos" style={{minHeight:44,justifyContent:"center"}} onPress={()=>void todos.refetch()}><Text style={{color:colors.destructive,fontFamily:Fonts.sans}}>Could not load to-dos. Tap to retry.</Text></Pressable>}
          {visibleTodos.map(t => <TaskRow key={t.id} title={t.title} focusIdentity={t.durationMinutes ? {kind:"todo",id:t.id,day:t.occurrenceDate,durationMinutes:t.durationMinutes} : undefined} done={!!t.completedAt} flagged={t.flagged}
            subtitle={[t.occurrenceDate<d.localDate?shortDate(t.occurrenceDate):null,t.scheduledTime?formatTime12(t.scheduledTime):null,t.durationMinutes?formatDuration(t.durationMinutes):null,t.repeat!=="none"?repeatLabels[t.repeat]:null,catName(t.categoryId)].filter(Boolean).join(" · ")}
            onPress={()=>{setTodoError(null);setTodoSheet({mode:"edit",todo:t});}}
            onCheck={()=>toggleTodo.mutate({id:t.id,done:!t.completedAt,occurrenceDate:t.occurrenceDate},{onSuccess:()=>{if(!t.completedAt)void cancelReminder(`${todoReminderId(t.id)}:${t.occurrenceDate}`);},onError:e=>setActionError(e.message)})}
            onSchedule={()=>{setTodoError(null);setTodoSheet({mode:"edit",todo:t});}}
            onFlag={()=>updateTodo.mutate({id:t.id,flagged:!t.flagged},{onError:e=>setActionError(e.message)})}
            onFocus={t.completedAt?undefined:()=>focus(t,true)} onDelete={()=>confirmDeleteTodo(t)}/>
          )}
          {visibleTodos.length === 0 ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 14,
              }}
            >
              {catFilter === "all"
                ? "Nothing casual on the list."
                : "No to-dos in this category."}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a to-do"
            onPress={() => {
              setTodoError(null);
              setTodoSheet({ mode: "create" });
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.border,
              borderRadius: 16,
              paddingVertical: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontFamily: Fonts?.semibold,
                fontSize: 14,
              }}
            >
              Add a to-do
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <NoteSheet
        visible={noteTask !== null}
        taskTitle={noteTask?.title ?? ""}
        submitting={complete.isPending}
        error={noteError}
        onSubmit={submitNote}
        onClose={() => setNoteTask(null)}
      />
      <AddTaskSheet
        visible={taskSheet !== null}
        submitting={createTask.isPending || updateTask.isPending}
        error={taskError}
        editing={
          taskSheet?.mode === "edit"
            ? {
                id: taskSheet.task.id,
                title: taskSheet.task.title,
                durationMinutes: taskSheet.task.durationMinutes,
                categoryId: taskSheet.task.categoryId,
                scheduledTime: taskSheet.task.scheduledTime,
                reminderEnabled: taskSheet.task.reminderEnabled,
                mode: taskSheet.task.mode,
              }
            : null
        }
        onSubmit={submitTaskSheet}
        onClose={() => setTaskSheet(null)}
      />
      <AddTodoSheet
        visible={todoSheet !== null}
        submitting={createTodo.isPending || updateTodo.isPending}
        error={todoError}
        todayISO={todos.data?.today ?? d.localDate}
        editing={
          todoSheet?.mode === "edit"
            ? {
                id: todoSheet.todo.id,
                scheduleLocked: todoSheet.todo.scheduleLocked,
                title: todoSheet.todo.title,
                durationMinutes: todoSheet.todo.durationMinutes,
                dueDate: todoSheet.todo.dueDate,
                repeat: todoSheet.todo.repeat,
                scheduledTime: todoSheet.todo.scheduledTime,
                reminderEnabled: todoSheet.todo.reminderEnabled,
                categoryId: todoSheet.todo.categoryId,
              }
            : null
        }
        onSubmit={submitTodoSheet}
        onClose={() => setTodoSheet(null)}
      />
      <VoiceSheet
        visible={voiceOpen}
        todayISO={todos.data?.today ?? d.localDate}
        onClose={() => setVoiceOpen(false)}
      />
    </SafeAreaView>
  );
}
