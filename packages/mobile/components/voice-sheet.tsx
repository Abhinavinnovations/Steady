import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { File } from "expo-file-system";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { useAssistantParse } from "@/queries/assistant";
import { useCreateTask } from "@/queries/steady";
import { useCategories, useCreateTodo } from "@/queries/todos";
import { scheduleTaskReminder, scheduleTodoReminder } from "@/lib/reminders";

type Draft = {
  kind: "consistent" | "todo";
  title: string;
  durationMinutes: number | null;
  date: string | null;
  time: string | null;
  reminder: boolean;
  categoryName: string | null;
};

type Props = {
  visible: boolean;
  /** Today's date in the user's timezone ("YYYY-MM-DD"). */
  todayISO: string;
  onClose: () => void;
};

const isWeb = Platform.OS === "web";

/** Chrome/Safari built-in speech recognition — free, on-device/browser. */
function getWebRecognition(): any | null {
  if (!isWeb || typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Voice add — say "add gym at 4 for an hour, daily" and confirm the draft.
 * Web: browser speech recognition (or type it). Native: records with the mic
 * and the AI transcribes. Parsing runs on the app's built-in AI — no extra
 * account, no cost to the user.
 */
export function VoiceSheet({ visible, todayISO, onClose }: Props) {
  const colors = useColors();
  const parse = useAssistantParse();
  const createTask = useCreateTask();
  const createTodo = useCreateTodo();
  const categories = useCategories();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recognitionRef = useRef<any>(null);

  const [phase, setPhase] = useState<
    "idle" | "listening" | "parsing" | "draft" | "saving"
  >("idle");
  const [typed, setTyped] = useState("");
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Full reset when the sheet transitions closed -> open.
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setPhase("idle");
      setTyped("");
      setTranscript("");
      setDraft(null);
      setError(null);
    }
    wasVisible.current = visible;
  }, [visible]);

  // Stop any web recognition when unmounting/closing.
  useEffect(() => {
    if (!visible && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, [visible]);

  async function runParse(input: { transcript?: string; audioBase64?: string; mimeType?: string }) {
    setPhase("parsing");
    setError(null);
    try {
      const res = await parse.mutateAsync(input);
      setTranscript(res.transcript);
      setDraft(res.draft);
      setPhase("draft");
    } catch (e: any) {
      setError(e?.message ?? "Didn't catch that — try again");
      setPhase("idle");
    }
  }

  async function startListening() {
    setError(null);
    if (isWeb) {
      const rec = getWebRecognition();
      if (!rec) {
        setError("This browser can't listen — type it below instead");
        return;
      }
      recognitionRef.current = rec;
      rec.lang = "en-US";
      rec.interimResults = true;
      let finalText = "";
      rec.onresult = (ev: any) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        setTranscript((finalText + interim).trim());
      };
      rec.onerror = () => {
        setError("Mic didn't work here — type it below instead");
        setPhase("idle");
      };
      rec.onend = () => {
        recognitionRef.current = null;
        const said = finalText.trim();
        if (said.length >= 2) void runParse({ transcript: said });
        else setPhase("idle");
      };
      setTranscript("");
      setPhase("listening");
      try {
        rec.start();
      } catch {
        setError("Mic didn't work here — type it below instead");
        setPhase("idle");
      }
      return;
    }
    // Native: record audio, let the AI transcribe it.
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError("Mic permission denied — type it below instead");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setTranscript("");
      setPhase("listening");
    } catch {
      setError("Couldn't start the mic — type it below instead");
      setPhase("idle");
    }
  }

  async function stopListening() {
    if (isWeb) {
      try {
        recognitionRef.current?.stop();
      } catch {
        setPhase("idle");
      }
      return;
    }
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error("no recording");
      const base64 = await new File(uri).base64();
      await runParse({ audioBase64: base64, mimeType: "audio/mp4" });
    } catch {
      setError("Recording failed — type it below instead");
      setPhase("idle");
    }
  }

  async function confirmDraft() {
    if (!draft) return;
    setPhase("saving");
    setError(null);
    // Category names map to the user's existing categories, case-insensitive.
    const categoryId =
      draft.categoryName != null
        ? (categories.data?.find(
            (c) => c.name.toLowerCase() === draft.categoryName!.toLowerCase(),
          )?.id ?? null)
        : null;
    try {
      if (draft.kind === "consistent") {
        const task = await createTask.mutateAsync({
          title: draft.title,
          durationMinutes: draft.durationMinutes ?? undefined,
          scheduledTime: draft.time ?? undefined,
          reminderEnabled: !!(draft.time && draft.reminder),
          categoryId: categoryId ?? undefined,
        });
        if (draft.time && draft.reminder)
          void scheduleTaskReminder(task.id, task.title, draft.time);
      } else {
        const todo = await createTodo.mutateAsync({
          title: draft.title,
          dueDate: draft.date ?? todayISO,
          durationMinutes: draft.durationMinutes ?? undefined,
          scheduledTime: draft.time ?? undefined,
          reminderEnabled: !!(draft.time && draft.reminder),
          categoryId: categoryId ?? undefined,
        });
        if (draft.time && draft.reminder)
          void scheduleTodoReminder(
            todo.id,
            todo.title,
            draft.date ?? todayISO,
            draft.time,
          );
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't add it — try again");
      setPhase("draft");
    }
  }

  const guide = [
    "what the task is",
    "how long it takes",
    "what time",
    "daily habit, or just once",
  ];

  const busy = phase === "parsing" || phase === "saving";

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
        <Pressable style={{ flex: 1 }} onPress={busy ? undefined : onClose} />
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
                  Voice add
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: colors.foreground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 18,
                  }}
                >
                  {phase === "draft" ? "Did I get it right?" : "Just say it"}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} disabled={busy}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(phase === "draft" || phase === "saving") && draft ? (
                <View style={{ gap: 14 }}>
                  {transcript ? (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      “{transcript}”
                    </Text>
                  ) : null}
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      backgroundColor: colors.card,
                      padding: 16,
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Ionicons
                        name={draft.kind === "consistent" ? "repeat" : "checkbox-outline"}
                        size={15}
                        color={colors.primary}
                      />
                      <Text
                        style={{
                          color: colors.primary,
                          fontFamily: Fonts?.semibold,
                          fontSize: 11,
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                        }}
                      >
                        {draft.kind === "consistent"
                          ? "Every day this month"
                          : "One-off to-do"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: Fonts?.semibold,
                        fontSize: 17,
                      }}
                    >
                      {draft.title}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {draft.kind === "todo" && draft.date ? (
                        <DraftChip icon="calendar-outline" label={draft.date === todayISO ? "Today" : draft.date} />
                      ) : null}
                      {draft.time ? (
                        <DraftChip icon="time-outline" label={draft.time} />
                      ) : null}
                      {draft.durationMinutes ? (
                        <DraftChip icon="timer-outline" label={`${draft.durationMinutes} min`} />
                      ) : null}
                      {draft.time && draft.reminder ? (
                        <DraftChip icon="notifications-outline" label="Reminder" />
                      ) : null}
                      {draft.categoryName ? (
                        <DraftChip icon="pricetag-outline" label={draft.categoryName} />
                      ) : null}
                    </View>
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
                    title={phase === "saving" ? "Adding..." : "Add it"}
                    disabled={busy}
                    onPress={() => void confirmDraft()}
                  />
                  <Pressable
                    onPress={() => {
                      setDraft(null);
                      setTranscript("");
                      setPhase("idle");
                    }}
                    disabled={busy}
                    style={{ alignItems: "center", paddingVertical: 4 }}
                  >
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.medium,
                        fontSize: 13,
                      }}
                    >
                      Try again
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  <View style={{ gap: 6 }}>
                    {guide.map((g) => (
                      <View
                        key={g}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: colors.primary,
                          }}
                        />
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontFamily: Fonts?.sans,
                            fontSize: 13,
                          }}
                        >
                          {g}
                        </Text>
                      </View>
                    ))}
                    <Text
                      style={{
                        marginTop: 4,
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 12,
                        fontStyle: "italic",
                      }}
                    >
                      e.g. “add gym at 4 for an hour, daily” or “buy milk
                      tomorrow at 6pm”
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      phase === "listening"
                        ? void stopListening()
                        : void startListening()
                    }
                    disabled={busy}
                    style={{
                      alignSelf: "center",
                      width: 84,
                      height: 84,
                      borderRadius: 42,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        phase === "listening" ? colors.destructive : colors.primary,
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons
                        name={phase === "listening" ? "stop" : "mic"}
                        size={34}
                        color="#fff"
                      />
                    )}
                  </Pressable>
                  <Text
                    style={{
                      textAlign: "center",
                      color: colors.mutedForeground,
                      fontFamily: Fonts?.medium,
                      fontSize: 13,
                    }}
                  >
                    {phase === "listening"
                      ? "Listening... tap to finish"
                      : phase === "parsing"
                        ? "Working it out..."
                        : "Tap to talk"}
                  </Text>
                  {phase === "listening" && transcript ? (
                    <Text
                      style={{
                        textAlign: "center",
                        color: colors.foreground,
                        fontFamily: Fonts?.sans,
                        fontSize: 14,
                      }}
                    >
                      “{transcript}”
                    </Text>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 12,
                      }}
                    >
                      or type it
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={typed}
                      onChangeText={setTyped}
                      placeholder="add gym at 4 for an hour, daily"
                      placeholderTextColor={colors.mutedForeground}
                      maxLength={300}
                      editable={!busy}
                      onSubmitEditing={() => {
                        if (typed.trim().length >= 2)
                          void runParse({ transcript: typed.trim() });
                      }}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        backgroundColor: colors.card,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        color: colors.foreground,
                        fontFamily: Fonts?.sans,
                        fontSize: 14,
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        if (typed.trim().length >= 2)
                          void runParse({ transcript: typed.trim() });
                      }}
                      disabled={busy || typed.trim().length < 2}
                      style={{
                        width: 46,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.primary,
                        opacity: busy || typed.trim().length < 2 ? 0.4 : 1,
                      }}
                    >
                      <Ionicons name="arrow-up" size={20} color="#fff" />
                    </Pressable>
                  </View>

                  {error ? (
                    <Text
                      style={{
                        color: colors.destructive,
                        fontFamily: Fonts?.medium,
                        fontSize: 13,
                        textAlign: "center",
                      }}
                    >
                      {error}
                    </Text>
                  ) : null}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function DraftChip({ icon, label }: { icon: any; label: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Ionicons name={icon} size={12} color={colors.mutedForeground} />
      <Text
        style={{
          color: colors.foreground,
          fontFamily: Fonts?.medium,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
