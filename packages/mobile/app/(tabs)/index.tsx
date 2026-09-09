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
import { ProgressRing } from "@/components/progress-ring";
import { NoteSheet } from "@/components/note-sheet";
import { AddTaskSheet, type TaskSheetValues } from "@/components/add-task-sheet";
import { AddTodoSheet, type TodoSheetValues } from "@/components/add-todo-sheet";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { formatDuration } from "@/components/duration-wheel";
import { formatTime12 } from "@/components/schedule-fields";
import { useAccountability } from "@/queries/accountability";
import {
  cancelReminder,
  scheduleTaskReminder,
  scheduleTodoReminder,
  taskReminderId,
  todoReminderId,
} from "@/lib/reminders";
import { TAB_BAR_CLEARANCE } from "./_layout";
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
  note: string | null;
  durationMinutes: number | null;
  categoryId: number | null;
  scheduledTime: string | null;
  reminderEnabled: boolean;
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

  const params = useLocalSearchParams<{ note?: string }>();
  const accountability = useAccountability();

  const [noteTask, setNoteTask] = useState<TodayTask | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
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
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void scheduleTaskReminder(id, taskSheet.task.title, v.scheduledTime);
        } else {
          void cancelReminder(taskReminderId(id));
        }
      } else {
        const task = await createTask.mutateAsync({
          title: v.title,
          ...(v.durationMinutes ? { durationMinutes: v.durationMinutes } : {}),
          ...(v.categoryId ? { categoryId: v.categoryId } : {}),
          ...(v.scheduledTime ? { scheduledTime: v.scheduledTime } : {}),
          ...(v.reminderEnabled ? { reminderEnabled: true } : {}),
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void scheduleTaskReminder(task.id, v.title, v.scheduledTime);
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
          scheduledTime: v.scheduledTime,
          reminderEnabled: v.reminderEnabled,
          categoryId: v.categoryId,
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void scheduleTodoReminder(id, v.title, v.dueDate, v.scheduledTime);
        } else {
          void cancelReminder(todoReminderId(id));
        }
      } else {
        const todo = await createTodo.mutateAsync({
          title: v.title,
          dueDate: v.dueDate,
          ...(v.durationMinutes ? { durationMinutes: v.durationMinutes } : {}),
          ...(v.categoryId ? { categoryId: v.categoryId } : {}),
          ...(v.scheduledTime ? { scheduledTime: v.scheduledTime } : {}),
          ...(v.reminderEnabled ? { reminderEnabled: true } : {}),
        });
        if (v.scheduledTime && v.reminderEnabled) {
          void scheduleTodoReminder(todo.id, v.title, v.dueDate, v.scheduledTime);
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
      removeTodo.mutate({ id: todo.id });
    };
    if (Platform.OS === "web") {
      run();
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
      run();
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
    router.setParams({ note: undefined });
    if (t && !t.completed) {
      setNoteError(null);
      setNoteTask(t);
    }
  }, [params.note, today.data, router]);

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
  const visibleTasks =
    catFilter === "all" ? d.tasks : d.tasks.filter((t) => t.categoryId === catFilter);
  const todoList = todos.data?.todos ?? [];
  const visibleTodos =
    catFilter === "all"
      ? todoList
      : todoList.filter((t) => t.categoryId === catFilter);

  async function submitNote(note: string) {
    if (!noteTask) return;
    setNoteError(null);
    try {
      await complete.mutateAsync({ taskId: noteTask.id, note });
      setNoteTask(null);
    } catch (e: any) {
      setNoteError(e?.message ?? "Couldn't save");
    }
  }

  function confirmUndo(task: TodayTask) {
    if (Platform.OS === "web") {
      undo.mutate({ taskId: task.id });
      return;
    }
    Alert.alert("Undo completion?", `"${task.title}" will go back to pending.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Undo", style: "destructive", onPress: () => undo.mutate({ taskId: task.id }) },
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
        contentContainerStyle={{ padding: 20, paddingBottom: TAB_BAR_CLEARANCE }}
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
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.medium,
                fontSize: 13,
              }}
            >
              {dateLabel}
            </Text>
            <Text
              style={{
                marginTop: 2,
                color: colors.foreground,
                fontFamily: Fonts?.semibold,
                fontSize: 24,
              }}
            >
              Today
            </Text>
          </View>
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

        {/* Ring hero — consistent tasks only */}
        <View style={{ alignItems: "center", marginTop: 28, marginBottom: 8 }}>
          <ProgressRing progress={progress}>
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: Fonts?.semibold,
                  fontSize: 34,
                }}
              >
                {d.doneCount}
                <Text style={{ color: colors.mutedForeground, fontSize: 20 }}>
                  /{d.totalCount}
                </Text>
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 12,
                }}
              >
                done today
              </Text>
            </View>
          </ProgressRing>
          <Text
            style={{
              marginTop: 16,
              color: d.allDone ? colors.success : colors.mutedForeground,
              fontFamily: Fonts?.medium,
              fontSize: 14,
            }}
          >
            {subline}
          </Text>
        </View>

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
              New month, new commitment
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              Confirm your tasks for this month to start ticking days again.
            </Text>
            <SteadyButton
              title="Set up this month"
              onPress={() => router.push("/onboarding?step=tasks")}
            />
            <SteadyButton
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
            />
          </View>
        ) : null}

        {/* Challenge users without a verified accountability contact */}
        {profile.data?.mode === "challenge" &&
        accountability.isSuccess &&
        !accountability.data?.verified ? (
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
                  No accountability contact yet
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
                  Challenge mode alerts someone when you miss a day. Add them in
                  Profile.
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
                    onPress={() => setCatFilter(c.id as number | "all")}
                    onLongPress={
                      c.id === "all"
                        ? undefined
                        : () => confirmDeleteCategory(c.id as number, c.name)
                    }
                    style={({ pressed }) => ({
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
              color: colors.mutedForeground,
              fontFamily: Fonts?.semibold,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
            }}
          >
            Consistent
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          {visibleTasks.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                if (!d.confirmed) return;
                if (t.completed) {
                  setExpanded(expanded === t.id ? null : t.id);
                } else {
                  setNoteError(null);
                  setNoteTask(t);
                }
              }}
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 16,
                opacity: pressed ? 0.9 : t.completed ? 0.75 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {t.completed ? (
                  <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                ) : (
                  <Ionicons
                    name="ellipse-outline"
                    size={26}
                    color={colors.mutedForeground}
                  />
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: Fonts?.medium,
                      fontSize: 15,
                    }}
                  >
                    {t.title}
                  </Text>
                  {t.scheduledTime || catName(t.categoryId) ? (
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      {t.scheduledTime ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Ionicons
                            name={
                              t.reminderEnabled ? "alarm-outline" : "time-outline"
                            }
                            size={11}
                            color={colors.mutedForeground}
                          />
                          <Text
                            style={{
                              color: colors.mutedForeground,
                              fontFamily: Fonts?.medium,
                              fontSize: 12,
                            }}
                          >
                            {formatTime12(t.scheduledTime)}
                          </Text>
                        </View>
                      ) : null}
                      {catName(t.categoryId) ? (
                        <Text
                          style={{
                            color: colors.primary,
                            fontFamily: Fonts?.medium,
                            fontSize: 12,
                          }}
                        >
                          {catName(t.categoryId)}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {t.completed ? (
                  <Ionicons
                    name={expanded === t.id ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                ) : (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                  >
                    {t.durationMinutes ? (
                      <>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: colors.muted,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                          }}
                        >
                          <Ionicons
                            name="timer-outline"
                            size={12}
                            color={colors.mutedForeground}
                          />
                          <Text
                            style={{
                              color: colors.mutedForeground,
                              fontFamily: Fonts?.semibold,
                              fontSize: 12,
                            }}
                          >
                            {formatDuration(t.durationMinutes)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            if (d.confirmed) router.push(`/timer/${t.id}`);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons
                            name="play-circle"
                            size={34}
                            color={colors.primary}
                          />
                        </Pressable>
                      </>
                    ) : (
                      <Text
                        style={{
                          color: colors.primary,
                          fontFamily: Fonts?.semibold,
                          fontSize: 13,
                        }}
                      >
                        Do it
                      </Text>
                    )}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setTaskError(null);
                        setTaskSheet({ mode: "edit", task: t });
                      }}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  </View>
                )}
              </View>
              {t.completed && expanded === t.id ? (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: Fonts?.sans,
                      fontSize: 13,
                      lineHeight: 19,
                      fontStyle: "italic",
                    }}
                  >
                    “{t.note}”
                  </Text>
                  <Pressable onPress={() => confirmUndo(t)} hitSlop={6}>
                    <Text
                      style={{
                        color: colors.destructive,
                        fontFamily: Fonts?.medium,
                        fontSize: 13,
                      }}
                    >
                      Undo
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          ))}
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
              color: colors.mutedForeground,
              fontFamily: Fonts?.semibold,
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
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
          {visibleTodos.map((t) => {
            const done = !!t.completedAt;
            const overdue = !done && t.dueDate < d.localDate;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTodoError(null);
                  setTodoSheet({ mode: "edit", todo: t });
                }}
                style={({ pressed }) => ({
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 14,
                  opacity: pressed ? 0.9 : done ? 0.6 : 1,
                })}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      if (done) {
                        toggleTodo.mutate({ id: t.id, done: false });
                      } else {
                        void cancelReminder(todoReminderId(t.id));
                        toggleTodo.mutate({ id: t.id, done: true });
                      }
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={done ? "checkbox" : "square-outline"}
                      size={24}
                      color={done ? colors.success : colors.mutedForeground}
                    />
                  </Pressable>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: Fonts?.medium,
                        fontSize: 15,
                        textDecorationLine: done ? "line-through" : "none",
                      }}
                    >
                      {t.title}
                    </Text>
                    {overdue || t.scheduledTime || catName(t.categoryId) ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {overdue ? (
                          <Text
                            style={{
                              color: colors.warning,
                              fontFamily: Fonts?.medium,
                              fontSize: 12,
                            }}
                          >
                            since {shortDate(t.dueDate)}
                          </Text>
                        ) : null}
                        {t.scheduledTime ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Ionicons
                              name={
                                t.reminderEnabled ? "alarm-outline" : "time-outline"
                              }
                              size={11}
                              color={colors.mutedForeground}
                            />
                            <Text
                              style={{
                                color: colors.mutedForeground,
                                fontFamily: Fonts?.medium,
                                fontSize: 12,
                              }}
                            >
                              {formatTime12(t.scheduledTime)}
                            </Text>
                          </View>
                        ) : null}
                        {catName(t.categoryId) ? (
                          <Text
                            style={{
                              color: colors.primary,
                              fontFamily: Fonts?.medium,
                              fontSize: 12,
                            }}
                          >
                            {catName(t.categoryId)}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                  {!done && t.durationMinutes ? (
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: colors.muted,
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Ionicons
                          name="timer-outline"
                          size={12}
                          color={colors.mutedForeground}
                        />
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontFamily: Fonts?.semibold,
                            fontSize: 12,
                          }}
                        >
                          {formatDuration(t.durationMinutes)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/timer/${t.id}?type=todo`);
                        }}
                        hitSlop={6}
                      >
                        <Ionicons
                          name="play-circle"
                          size={30}
                          color={colors.primary}
                        />
                      </Pressable>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      confirmDeleteTodo(t);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
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
                title: todoSheet.todo.title,
                durationMinutes: todoSheet.todo.durationMinutes,
                dueDate: todoSheet.todo.dueDate,
                scheduledTime: todoSheet.todo.scheduledTime,
                reminderEnabled: todoSheet.todo.reminderEnabled,
                categoryId: todoSheet.todo.categoryId,
              }
            : null
        }
        onSubmit={submitTodoSheet}
        onClose={() => setTodoSheet(null)}
      />
    </SafeAreaView>
  );
}
