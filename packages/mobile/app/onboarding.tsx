import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { DurationWheel, formatDuration } from "@/components/duration-wheel";
import { AccountabilitySetup } from "@/components/accountability-setup";
import { useAccountability } from "@/queries/accountability";
import {
  useConfirmMonth,
  useCreateTask,
  useCurrentTasks,
  useOnboard,
  useRemoveTask,
} from "@/queries/steady";

type Mode = "basic" | "challenge";

function ModeCard({
  title,
  description,
  icon,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.card,
        padding: 20,
        gap: 8,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons
          name={icon}
          size={20}
          color={selected ? colors.primary : colors.mutedForeground}
        />
        <Text
          style={{
            color: colors.foreground,
            fontFamily: Fonts?.semibold,
            fontSize: 17,
          }}
        >
          {title}
        </Text>
        <View style={{ flex: 1 }} />
        {selected ? (
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        ) : null}
      </View>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: Fonts?.sans,
          fontSize: 13,
          lineHeight: 19,
        }}
      >
        {description}
      </Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState<"mode" | "contact" | "tasks">(
    params.step === "tasks" ? "tasks" : "mode",
  );
  const [mode, setMode] = useState<Mode | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onboard = useOnboard();
  const current = useCurrentTasks();
  const createTask = useCreateTask();
  const removeTask = useRemoveTask();
  const confirmMonth = useConfirmMonth();
  const contact = useAccountability();

  const tasks = current.data?.tasks ?? [];
  const monthLabel = new Date().toLocaleString("en", { month: "long" });

  async function chooseMode() {
    if (!mode) return;
    setError(null);
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    try {
      await onboard.mutateAsync({ mode, timezone });
      setStep(mode === "challenge" ? "contact" : "tasks");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    }
  }

  async function addTask() {
    const t = title.trim();
    if (t.length < 2) return;
    setError(null);
    try {
      await createTask.mutateAsync({
        title: t,
        durationMinutes: duration ?? undefined,
        // Tasks inherit the mode picked during onboarding; rollover re-entry
        // (?step=tasks) defaults to basic — editable any time from Today.
        mode: mode ?? "basic",
      });
      setTitle("");
      setDuration(null);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't add task");
    }
  }

  async function lockIn() {
    setError(null);
    try {
      await confirmMonth.mutateAsync(undefined);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't confirm");
    }
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <GradientBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {step === "mode" ? (
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            <View style={{ paddingTop: 40, paddingBottom: 28 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: Fonts?.semibold,
                  fontSize: 26,
                }}
              >
                How do you want to show up?
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                You can switch to Challenge later. Both start the same way.
              </Text>
            </View>

            <View style={{ gap: 14 }}>
              <ModeCard
                title="Basic"
                description="Build consistency privately. Nothing at stake."
                icon="leaf-outline"
                selected={mode === "basic"}
                onPress={() => setMode("basic")}
              />
              <ModeCard
                title="Challenge"
                description="Add an accountability partner and stay answerable."
                icon="people-outline"
                selected={mode === "challenge"}
                onPress={() => setMode("challenge")}
              />
            </View>

            {error ? (
              <Text
                style={{
                  marginTop: 14,
                  color: colors.destructive,
                  fontFamily: Fonts?.sans,
                  fontSize: 13,
                }}
              >
                {error}
              </Text>
            ) : null}

            <View style={{ flex: 1 }} />
            <View style={{ paddingBottom: 24 }}>
              <SteadyButton
                title="Continue"
                onPress={chooseMode}
                disabled={!mode}
                loading={onboard.isPending}
              />
            </View>
          </View>
        ) : step === "contact" ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          >
            <View style={{ paddingTop: 40, paddingBottom: 24 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: Fonts?.semibold,
                  fontSize: 26,
                }}
              >
                Who keeps you honest?
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                Challenge mode needs an accountability contact. If you miss a
                day, they get an email. That's the deal.
              </Text>
            </View>

            <AccountabilitySetup />

            <View style={{ flex: 1 }} />
            <View style={{ paddingVertical: 24 }}>
              <SteadyButton
                title="Continue"
                onPress={() => setStep("tasks")}
                disabled={!contact.data?.verified}
              />
              {!contact.data?.verified ? (
                <Text
                  style={{
                    marginTop: 10,
                    textAlign: "center",
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 12,
                  }}
                >
                  Verify a contact to continue.
                </Text>
              ) : null}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          >
            <View style={{ paddingTop: 40, paddingBottom: 20 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: Fonts?.semibold,
                  fontSize: 26,
                }}
              >
                Your {monthLabel} commitment
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 14,
                  lineHeight: 21,
                }}
              >
                Set the easiest version you can do every day. Once locked, it
                can go up — never down — until next month.
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  paddingHorizontal: 16,
                  fontFamily: Fonts?.sans,
                  fontSize: 15,
                }}
                placeholder="e.g. Read 10 pages"
                placeholderTextColor={colors.mutedForeground}
                value={title}
                onChangeText={setTitle}
                onSubmitEditing={addTask}
                returnKeyType="done"
              />
              <Pressable
                onPress={addTask}
                disabled={createTask.isPending || title.trim().length < 2}
                style={({ pressed }) => ({
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity:
                    title.trim().length < 2 ? 0.4 : pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name="add" size={26} color={colors.primaryForeground} />
              </Pressable>
            </View>

            {/* Optional focus time — watch-style wheel with tick + haptic */}
            <View style={{ marginTop: 14 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="timer-outline"
                  size={14}
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

            <View style={{ marginTop: 20, gap: 10 }}>
              {tasks.map((t) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
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
                  {t.durationMinutes ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: colors.primarySoft,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        marginRight: 10,
                      }}
                    >
                      <Ionicons
                        name="timer-outline"
                        size={12}
                        color={colors.primary}
                      />
                      <Text
                        style={{
                          color: colors.primary,
                          fontFamily: Fonts?.semibold,
                          fontSize: 12,
                        }}
                      >
                        {formatDuration(t.durationMinutes)}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => removeTask.mutate({ id: t.id })}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
              ))}
              {tasks.length === 0 ? (
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 13,
                    textAlign: "center",
                    paddingVertical: 20,
                  }}
                >
                  Add 1–3 small tasks you can sustain daily.
                </Text>
              ) : null}
            </View>

            {error ? (
              <Text
                style={{
                  marginTop: 14,
                  color: colors.destructive,
                  fontFamily: Fonts?.sans,
                  fontSize: 13,
                }}
              >
                {error}
              </Text>
            ) : null}

            <View style={{ flex: 1 }} />
            <View style={{ paddingVertical: 24, gap: 10 }}>
              <SteadyButton
                title={`Lock in for ${monthLabel}`}
                onPress={lockIn}
                disabled={tasks.length === 0}
                loading={confirmMonth.isPending}
              />
              <Text
                style={{
                  textAlign: "center",
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 12,
                }}
              >
                Locked means it can't be reduced until next month.
              </Text>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
