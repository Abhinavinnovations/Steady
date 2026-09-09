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

const MIN_CHARS = 10;

type Props = {
  visible: boolean;
  taskTitle: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
};

export function NoteSheet({
  visible,
  taskTitle,
  submitting,
  error,
  onSubmit,
  onClose,
}: Props) {
  const colors = useColors();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) setNote("");
  }, [visible]);

  const remaining = MIN_CHARS - note.trim().length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
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
                  What did you do?
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: colors.foreground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 18,
                  }}
                >
                  {taskTitle}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <TextInput
              style={{
                minHeight: 96,
                maxHeight: 160,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                color: colors.foreground,
                padding: 14,
                fontFamily: Fonts?.sans,
                fontSize: 15,
                textAlignVertical: "top",
              }}
              placeholder="One honest line about what you actually did…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={note}
              onChangeText={setNote}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="mic-outline" size={14} color={colors.mutedForeground} />
              <Text
                style={{
                  flex: 1,
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 12,
                }}
              >
                Tip: tap the mic on your keyboard to speak instead of typing.
              </Text>
              {remaining > 0 ? (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.medium,
                    fontSize: 12,
                  }}
                >
                  {remaining} more
                </Text>
              ) : null}
            </View>

            {error ? (
              <Text
                style={{ color: colors.destructive, fontFamily: Fonts?.sans, fontSize: 13 }}
              >
                {error}
              </Text>
            ) : null}

            <SteadyButton
              title="Mark done"
              onPress={() => onSubmit(note.trim())}
              disabled={remaining > 0}
              loading={submitting}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
