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
import { AddTaskSheet } from "@/components/add-task-sheet";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { formatDuration } from "@/components/duration-wheel";
import { useAccountability } from "@/queries/accountability";
import { TAB_BAR_CLEARANCE } from "./_layout";
import {
  useCompleteTask,
  useCopyPrevious,
  useCreateTask,
  useProfile,
  useToday,
  useUndoTask,
} from "@/queries/steady";

type TodayTask = {
  id: number;
  title: string;
  completed: boolean;
  note: string | null;
  durationMinutes: number | null;
};

export default function TodayScreen() {
  const colors = useColors();
  const router = useRouter();
  const profile = useProfile();
  const today = useToday();
  const complete = useCompleteTask();
  const undo = useUndoTask();
  const copyPrevious = useCopyPrevious();

  const params = useLocalSearchParams<{ note?: string }>();
  const accountability = useAccountability();

  const [noteTask, setNoteTask] = useState<TodayTask | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const createTask = useCreateTask();

  async function submitNewTask(title: string, durationMinutes: number | null) {
    setAddError(null);
    try {
      await createTask.mutateAsync({
        title,
        ...(durationMinutes ? { durationMinutes } : {}),
      });
      setAdding(false);
    } catch (e: any) {
      setAddError(e?.message ?? "Couldn't add the task");
    }
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
            onRefresh={() => today.refetch()}
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

        {/* Ring hero */}
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
                copyPrevious.isPending
                  ? "Copying..."
                  : "Reuse last month's tasks"
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
                  Challenge mode alerts someone when you miss a day. Add them
                  in Profile.
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

        {/* Task list */}
        <Text
          style={{
            marginTop: 28,
            marginBottom: 12,
            color: colors.mutedForeground,
            fontFamily: Fonts?.semibold,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Tasks
        </Text>
        <View style={{ gap: 10 }}>
          {d.tasks.map((t) => (
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
                borderColor: t.completed ? colors.border : colors.border,
                borderRadius: 16,
                padding: 16,
                opacity: pressed ? 0.9 : t.completed ? 0.75 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {t.completed ? (
                  <Ionicons name="checkmark-circle" size={26} color={colors.success} />
                ) : (
                  <Ionicons name="ellipse-outline" size={26} color={colors.mutedForeground} />
                )}
                <Text
                  style={{
                    flex: 1,
                    color: colors.foreground,
                    fontFamily: Fonts?.medium,
                    fontSize: 15,
                  }}
                >
                  {t.title}
                </Text>
                {t.completed ? (
                  <Ionicons
                    name={expanded === t.id ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.mutedForeground}
                  />
                ) : t.durationMinutes ? (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
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
                  </View>
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
          {d.tasks.length === 0 && d.confirmed ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 20,
              }}
            >
              No tasks yet this month.
            </Text>
          ) : null}
          {d.confirmed && d.tasks.length < 10 ? (
            <Pressable
              onPress={() => {
                setAddError(null);
                setAdding(true);
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
        visible={adding}
        submitting={createTask.isPending}
        error={addError}
        onSubmit={submitNewTask}
        onClose={() => setAdding(false)}
      />
    </SafeAreaView>
  );
}
