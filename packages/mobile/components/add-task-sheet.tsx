import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { DurationWheel } from "@/components/duration-wheel";

type Props = {
  visible: boolean;
  submitting: boolean;
  error?: string | null;
  onSubmit: (title: string, durationMinutes: number | null) => void;
  onClose: () => void;
};

/**
 * Mid-month "add a task" bottom sheet. Commitments can only grow —
 * tasks added here count from today and can't be removed until next month.
 */
export function AddTaskSheet({
  visible,
  submitting,
  error,
  onSubmit,
  onClose,
}: Props) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle("");
      setDuration(null);
    }
  }, [visible]);

  const valid = title.trim().length >= 2;

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
              padding: 24,
              paddingBottom: 36,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                  Raise the bar
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: colors.foreground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 18,
                  }}
                >
                  Add a task
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

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
              title={submitting ? "Adding..." : "Add to this month"}
              disabled={!valid || submitting}
              onPress={() => onSubmit(title.trim(), duration)}
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
              Counts from today. Tasks can be added any time — removing waits
              for next month.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
