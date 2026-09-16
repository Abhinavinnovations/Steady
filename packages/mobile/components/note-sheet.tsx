import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { PaperModal as Modal } from "@/components/paper-modal";
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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) setNote("");
  }, [visible]);

  const remaining = MIN_CHARS - note.trim().length;
  const close = () => { if (!submitting) onClose(); };

  return (
    <Modal accessibilityLabel="Completion note" visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={close} />
        <KeyboardAvoidingView
          style={{ width: "100%", maxWidth: 640, alignSelf: "center", maxHeight: height - insets.top - 12 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
            contentContainerStyle={{
              padding: 24,
              paddingBottom: Math.max(24, insets.bottom + 16),
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Fonts.display,
                    fontSize: 36,
                    lineHeight: 41,
                  }}
                >
                  What did you do?
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: colors.foreground,
                    fontFamily: Fonts.medium,
                    fontSize: 14,
                  }}
                >
                  {taskTitle}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close completion note" disabled={submitting} onPress={close} style={{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <TextInput
              accessibilityLabel="Completion note"
              editable={!submitting}
              maxLength={1000}
              style={{
                minHeight: 132,
                maxHeight: 160,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.inputBorder,
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
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
