import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SteadyIcon } from "@/components/steady-icon";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { PaperModal as Modal } from "@/components/paper-modal";
import { SteadyButton } from "@/components/steady-button";
import { DurationWheel } from "@/components/duration-wheel";
import { VoiceEntryButton } from "./voice-entry-button";
import { VoiceSheet } from "./voice-sheet";
import { CategoryPicker, TimeField } from "@/components/schedule-fields";

export type TaskSheetValues = {
  title: string;
  durationMinutes: number | null;
  categoryId: number | null;
  scheduledTime: string | null;
  reminderEnabled: boolean;
  mode: "basic" | "challenge";
};

type Props = {
  todayISO: string;
  commitment?: boolean;
  frozen?: boolean;
  monthLocked: boolean;
  onChallengeSetup: () => void;
  visible: boolean;
  submitting: boolean;
  error?: string | null;
  /**
   * When set, the sheet edits an existing task's settings.
   * The title is locked — the commitment is on WHAT you do, settings are free.
   */
  editing?: (TaskSheetValues & { id: number }) | null;
  onSubmit: (values: TaskSheetValues) => void;
  onClose: () => void;
};

/**
 * Add / edit sheet for consistent (month-locked) tasks. Commitments can only
 * grow — tasks added here count from today and can't be removed until next
 * month. Schedule, category, and focus time stay editable any time.
 */
export function AddTaskSheet({
  todayISO, monthLocked, onChallengeSetup, commitment = false, frozen = false,
  visible,
  submitting,
  error,
  editing,
  onSubmit,
  onClose,
}: Props) {
  const colors = useColors();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reminder, setReminder] = useState(false);
  const [mode, setMode] = useState<"basic" | "challenge">("basic");
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Reset only when the sheet transitions closed -> open. `editing` is a
  // fresh object every parent render, so depending on its identity would
  // wipe in-progress edits whenever the parent re-renders (query refetch).
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current && !frozen) {
      setVoiceOpen(false);
      setTitle(editing?.title ?? "");
      setDuration(editing?.durationMinutes ?? null);
      setCategoryId(editing?.categoryId ?? null);
      setTime(editing?.scheduledTime ?? null);
      setReminder(editing?.reminderEnabled ?? false);
      setMode(editing?.mode ?? (commitment ? "challenge" : "basic"));
      setShowModeInfo(false);
    }
    wasVisible.current = visible;
  }, [visible, editing, commitment, frozen]);

  const isEdit = !!editing;
  const needsSetup = !commitment && !isEdit && mode === "challenge" && monthLocked;
  const minimumDuration = isEdit && monthLocked ? editing.durationMinutes : null;
  const valid = !needsSetup && (isEdit || title.trim().length >= 2) && (duration ?? 0) >= (minimumDuration ?? 0);
  if (voiceOpen && visible) return <VoiceSheet visible todayISO={todayISO} context={mode === "challenge" ? "challenge-task" : "basic-task"} onClose={() => setVoiceOpen(false)}/>;

  return (
    <Modal
      accessibilityLabel={isEdit ? "Task settings" : commitment ? "Add commitment task" : "Add a task"}
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView
          style={{ width: "100%", maxWidth: 640, alignSelf: "center" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: Math.max(24, insets.bottom + 16),
              maxHeight: Math.min(760, height - insets.top - 12),
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                  }}
                >
                  {isEdit ? "Task settings" : "Raise the bar"}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: colors.foreground,
                    fontFamily: Fonts.display,
                    fontSize: 34,
                    lineHeight: 40,
                  }}
                >
                  {isEdit ? editing.title : commitment ? "Add commitment task" : "Add a task"}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close task editor" onPress={onClose} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}>
                <SteadyIcon name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ gap: 14 }}>
                {!isEdit && !commitment && <View style={{ alignItems: "flex-end" }}><VoiceEntryButton label="Add consistent tasks by voice" disabled={submitting || needsSetup} onPress={() => setVoiceOpen(true)}/></View>}
                {needsSetup && <View style={{ gap: 8 }}><Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 13 }}>This month is locked. Set up separate Challenge commitments for next month. Your Basic tasks stay private.</Text><SteadyButton title="Set up next month’s Challenge" onPress={onChallengeSetup}/></View>}
                {!isEdit ? (
                  <TextInput
                    accessibilityLabel="Task title"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Read 10 pages"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={80}
                    editable={!submitting && !frozen}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      borderRadius: 14,
                      backgroundColor: colors.card,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      color: colors.foreground,
                      fontFamily: Fonts?.sans,
                      fontSize: 15,
                    }}
                  />
                ) : null}

                {commitment && <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 }}>Challenge only. Starts today; email accountability begins on the next full day. Consistent Tasks stay separate.</Text>}
                {/* Mode is fixed for commitment additions. */}
                {!commitment && <View style={{ gap: 8 }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <SteadyIcon
                      name="flag-outline"
                      size={13}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.semibold,
                        fontSize: 11,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                      }}
                    >
                      Mode
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 4,
                    }}
                  >
                    {(["basic", "challenge"] as const).map((m) => (
                      <Pressable
                        key={m}
                        accessibilityRole="radio"
                        accessibilityLabel={`${m} task mode`}
                        accessibilityState={{ checked: mode === m, disabled: submitting || isEdit }}
                        aria-checked={mode === m}
                        disabled={submitting || isEdit}
                        onPress={() => {
                          setMode(m);
                          if (m === "challenge") setShowModeInfo(true);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 44,
                          justifyContent: "center",
                          paddingVertical: 8,
                          borderRadius: 9,
                          alignItems: "center",
                          backgroundColor:
                            mode === m ? colors.primary : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color:
                              mode === m
                                ? colors.primaryForeground
                                : colors.mutedForeground,
                            fontFamily: Fonts?.medium,
                            fontSize: 13,
                            textTransform: "capitalize",
                          }}
                        >
                          {m}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {isEdit && <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 12 }}>Mode stays fixed to protect your past results. Create a separate task to use another mode.</Text>}
                  {mode === "challenge" && showModeInfo ? (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 12,
                        lineHeight: 17,
                      }}
                    >
                      Challenge means someone hears about it when you break your
                      streak, and this task ranks on the challenge board. Basic
                      stays fully private. Challenge needs an accepted accountability
                      contact — invite one in Profile and wait for acceptance.
                    </Text>
                  ) : null}
                </View>}

                <CategoryPicker value={categoryId} onChange={value => { if (!submitting && !frozen) setCategoryId(value); }} />

                <View style={{ gap: 8 }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <SteadyIcon
                      name="timer-outline"
                      size={13}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.semibold,
                        fontSize: 11,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                      }}
                    >
                      Focus time (optional)
                    </Text>
                  </View>
                  <DurationWheel value={duration} onChange={setDuration} minimum={minimumDuration} disabled={submitting || frozen} />
                  {isEdit && monthLocked && <Text style={{ color: colors.mutedForeground, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18 }}>Committed focus time can only increase. The task cannot be deleted.</Text>}
                </View>

                <TimeField value={time} onChange={value => { if (!submitting && !frozen) setTime(value); }} />

                {time ? (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                  >
                    <SteadyIcon
                      name="notifications-outline"
                      size={15}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.foreground,
                        fontFamily: Fonts?.medium,
                        fontSize: 14,
                      }}
                    >
                      Daily reminder
                    </Text>
                    <Switch
                      accessibilityLabel="Daily reminder"
                      value={reminder}
                      disabled={submitting || frozen}
                      onValueChange={setReminder}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>
                ) : null}
                {time && reminder && Platform.OS === "web" ? (
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: Fonts?.sans,
                      fontSize: 12,
                      lineHeight: 17,
                    }}
                  >
                    Reminders fire on your phone — the browser preview can't
                    schedule device notifications.
                  </Text>
                ) : null}

                {error ? (
                  <Text
                    style={{
                      color: colors.destructive,
                      fontFamily: Fonts?.medium,
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </Text>
                ) : null}

                <SteadyButton
                  title={
                    submitting
                      ? "Saving..."
                      : frozen
                        ? "Retry unchanged"
                        : isEdit
                        ? "Save changes"
                        : commitment ? "Add commitment task" : "Add to this month"
                  }
                  disabled={!valid || submitting}
                  onPress={() =>
                    onSubmit({
                      title: title.trim(),
                      durationMinutes: duration,
                      categoryId,
                      scheduledTime: time,
                      reminderEnabled: time ? reminder : false,
                      mode,
                    })
                  }
                />
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 12,
                    lineHeight: 17,
                    textAlign: "center",
                  }}
                >
                  {isEdit
                    ? "Schedule and category stay editable. A committed task cannot be deleted or have its focus time reduced."
                    : commitment ? "Saving commits this task immediately. It cannot be deleted, and focus time can only increase." : "Counts from today. Once committed, tasks cannot be deleted or reduced."}
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
