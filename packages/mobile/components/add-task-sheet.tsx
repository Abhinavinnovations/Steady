import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { DurationWheel } from "@/components/duration-wheel";
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
  visible,
  submitting,
  error,
  editing,
  onSubmit,
  onClose,
}: Props) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reminder, setReminder] = useState(false);
  const [mode, setMode] = useState<"basic" | "challenge">("basic");
  const [showModeInfo, setShowModeInfo] = useState(false);

  // Reset only when the sheet transitions closed -> open. `editing` is a
  // fresh object every parent render, so depending on its identity would
  // wipe in-progress edits whenever the parent re-renders (query refetch).
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setTitle(editing?.title ?? "");
      setDuration(editing?.durationMinutes ?? null);
      setCategoryId(editing?.categoryId ?? null);
      setTime(editing?.scheduledTime ?? null);
      setReminder(editing?.reminderEnabled ?? false);
      setMode(editing?.mode ?? "basic");
      setShowModeInfo(false);
    }
    wasVisible.current = visible;
  }, [visible, editing]);

  const isEdit = !!editing;
  const valid = isEdit || title.trim().length >= 2;

  return (
    <Modal
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View
            style={{
              backgroundColor: colors.cardElevated,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 36,
              maxHeight: 640,
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
                    fontFamily: Fonts?.semibold,
                    fontSize: 18,
                  }}
                >
                  {isEdit ? editing.title : "Add a task"}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ gap: 14 }}>
                {!isEdit ? (
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Read 10 pages"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={80}
                    editable={!submitting}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
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

                {/* Mode — per task */}
                <View style={{ gap: 8 }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Ionicons
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
                        disabled={submitting}
                        onPress={() => {
                          setMode(m);
                          if (m === "challenge") setShowModeInfo(true);
                        }}
                        style={{
                          flex: 1,
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
                      stays fully private. Challenge needs a partner or verified
                      contact — set one up in Profile first.
                    </Text>
                  ) : null}
                </View>

                <CategoryPicker value={categoryId} onChange={setCategoryId} />

                <View style={{ gap: 8 }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Ionicons
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
                  <DurationWheel value={duration} onChange={setDuration} />
                </View>

                <TimeField value={time} onChange={setTime} />

                {time ? (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                  >
                    <Ionicons
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
                      value={reminder}
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
                      : isEdit
                        ? "Save changes"
                        : "Add to this month"
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
                    ? "Schedule and category are always editable. The task itself stays until next month."
                    : "Counts from today. Tasks can be added any time — removing waits for next month."}
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
