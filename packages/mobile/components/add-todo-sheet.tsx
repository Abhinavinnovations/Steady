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
import {
  CategoryPicker,
  DateChips,
  TimeField,
} from "@/components/schedule-fields";

export type TodoSheetValues = {
  title: string;
  durationMinutes: number | null;
  dueDate: string;
  scheduledTime: string | null;
  reminderEnabled: boolean;
  categoryId: number | null;
};

type Props = {
  visible: boolean;
  submitting: boolean;
  error?: string | null;
  /** Today's date in the user's timezone ("YYYY-MM-DD"). */
  todayISO: string;
  /** When set, the sheet edits an existing to-do (everything editable). */
  editing?: (TodoSheetValues & { id: number }) | null;
  onSubmit: (values: TodoSheetValues) => void;
  onClose: () => void;
};

/**
 * Add / edit sheet for temporary to-dos — the casual list. No month lock,
 * no streaks, deletable any time. Stays on the list until done or deleted.
 */
export function AddTodoSheet({
  visible,
  submitting,
  error,
  todayISO,
  editing,
  onSubmit,
  onClose,
}: Props) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(todayISO);
  const [time, setTime] = useState<string | null>(null);
  const [reminder, setReminder] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // Reset only when the sheet transitions closed -> open. `editing` is a
  // fresh object every parent render, so depending on its identity would
  // wipe in-progress edits whenever the parent re-renders (query refetch).
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setTitle(editing?.title ?? "");
      setDuration(editing?.durationMinutes ?? null);
      setDueDate(editing?.dueDate ?? todayISO);
      setTime(editing?.scheduledTime ?? null);
      setReminder(editing?.reminderEnabled ?? false);
      setCategoryId(editing?.categoryId ?? null);
    }
    wasVisible.current = visible;
  }, [visible, editing, todayISO]);

  const isEdit = !!editing;
  const valid = title.trim().length >= 1;

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
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 14,
              }}
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
                  {isEdit ? "Edit to-do" : "Just for now"}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: colors.foreground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 18,
                  }}
                >
                  {isEdit ? "Update to-do" : "Add a to-do"}
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
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Pick up the parcel"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={120}
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

                <DateChips value={dueDate} onChange={setDueDate} todayISO={todayISO} />

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
                      Remind me
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
                    submitting ? "Saving..." : isEdit ? "Save changes" : "Add to-do"
                  }
                  disabled={!valid || submitting}
                  onPress={() =>
                    onSubmit({
                      title: title.trim(),
                      durationMinutes: duration,
                      dueDate,
                      scheduledTime: time,
                      reminderEnabled: time ? reminder : false,
                      categoryId,
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
                  To-dos don't touch your streak or rankings. They stay on the
                  list until done or deleted.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
