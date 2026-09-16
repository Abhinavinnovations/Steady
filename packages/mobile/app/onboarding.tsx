import { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { DurationWheel, formatDuration } from "@/components/duration-wheel";
import { VoiceSheet } from "@/components/voice-sheet";
import { stageVoiceTasks } from "@/lib/voice-context";
import { PartnerSection } from "@/components/partner-section";
import { usePartner } from "@/queries/partners";
import { useBeginSetup, useConfirmMonth, useConfirmSetup, useCreateTask, useCurrentTasks, useProfile, useRemoveTask, useToday } from "@/queries/steady";
import { definitiveRejection, withDeadline } from "@/lib/voice-draft-state";
type Mode = "basic" | "challenge";
type Staged = { requestId: string; title: string; durationMinutes?: number };
export default function OnboardingScreen() {
  const c = useColors(); const router = useRouter(); const params = useLocalSearchParams<{ step?: string }>();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const today = useToday();
  const later = params.step === "tasks";
  const [step, setStep] = useState<"mode" | "contact" | "tasks">(later ? "tasks" : "mode");
  const [mode, setMode] = useState<Mode | null>(later ? "basic" : null);
  const [title, setTitle] = useState(""); const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null); const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false); const guard = useRef(false); const generation = useRef(0); const alive = useRef(true);
  const [frozen, setFrozen] = useState(false); const finalPayload = useRef<{ month: string; tasks: Staged[] } | null>(null);
  const basicPayload = useRef<Staged | null>(null); const [basicUnknown, setBasicUnknown] = useState(false);
  const begin = useBeginSetup(); const current = useCurrentTasks(); const profile = useProfile(); const contact = usePartner();
  const createTask = useCreateTask(); const removeTask = useRemoveTask(); const confirmMonth = useConfirmMonth(); const confirmSetup = useConfirmSetup();
  const tasks = current.data?.tasks ?? []; const locked = current.data?.confirmed ?? false;
  const month = current.data?.month;
  const monthLabel = month ? new Date(`${month}-01T12:00:00Z`).toLocaleString("en", { month: "long", timeZone: "UTC" }) : "monthly";
  useEffect(() => { const life = alive; const sessionGeneration = generation; life.current = true; return () => { life.current = false; sessionGeneration.current++; }; }, []);
  const valid = (g: number) => alive.current && generation.current === g;
  function leave() {
    generation.current++; setError(null); setTitle(""); setDuration(null); setStaged([]);
    if (later) router.replace("/"); else { setStep("mode"); setMode(null); }
  }
  function back() {
    if (voiceOpen) { setVoiceOpen(false); return; }
    if (guard.current) return;
    if (step === "mode") { if (later || profile.data) router.replace("/"); return; }
    const warning = frozen || basicUnknown ? "An explicitly submitted save may already have finished. Check Today before creating it again. Existing commitments and contacts stay unchanged." : staged.length || title.trim() ? "Discard your unsaved setup entries? Existing tasks and accepted contacts stay unchanged." : null;
    if (!warning) { leave(); return; }
    if (Platform.OS === "web") { if (window.confirm(warning)) leave(); }
    else Alert.alert("Leave setup?", warning, [{ text: "Stay", style: "cancel" }, { text: "Leave setup", onPress: leave }]);
  }
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; }); return () => sub.remove(); });
  async function chooseMode() {
    if (!mode || guard.current) return;
    const chosen = mode; const g = generation.current; guard.current = true; setBusy(true); setError(null);
    try {
      await withDeadline(begin.mutateAsync({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC" }));
      if (valid(g)) { setFrozen(false); finalPayload.current = null; basicPayload.current = null; setBasicUnknown(false); setStep(chosen === "challenge" ? "contact" : "tasks"); }
    } catch (e) { if (valid(g)) setError(e instanceof Error ? e.message : "Could not start setup. Retry."); }
    finally { guard.current = false; if (valid(g)) setBusy(false); }
  }
  async function addTask() {
    if (guard.current || frozen || locked || (title.trim().length < 2 && !basicPayload.current)) return;
    if (tasks.length + staged.length >= 10 && !basicPayload.current) { setError("Max 10 tasks per month — keep it sustainable."); return; }
    setError(null);
    if (mode === "challenge") { setStaged(old => [...old, { requestId: randomUUID(), title: title.trim(), ...(duration ? { durationMinutes: duration } : {}) }]); setTitle(""); setDuration(null); return; }
    guard.current = true; setBusy(true); const g = generation.current;
    basicPayload.current ??= { requestId: randomUUID(), title: title.trim(), ...(duration ? { durationMinutes: duration } : {}) };
    try {
      await withDeadline(createTask.mutateAsync({ ...basicPayload.current, mode: "basic" }));
      basicPayload.current = null;
      if (valid(g)) { setTitle(""); setDuration(null); setBasicUnknown(false); }
    } catch (e) {
      if (definitiveRejection((e as {code?: string})?.code)) basicPayload.current = null;
      if (valid(g)) { setBasicUnknown(!!basicPayload.current); setError(basicPayload.current ? "Save not confirmed. Retry Add unchanged, or leave and check Today before entering it again." : e instanceof Error ? e.message : "Could not add task."); }
    } finally { guard.current = false; if (valid(g)) setBusy(false); }
  }
  async function lockIn() {
    if (guard.current || locked || !month || basicUnknown) return;
    guard.current = true; setBusy(true); setError(null); const g = generation.current;
    try {
      if (mode === "challenge") {
        finalPayload.current ??= { month, tasks: staged }; setFrozen(true);
        await withDeadline(confirmSetup.mutateAsync(finalPayload.current));
      } else await withDeadline(confirmMonth.mutateAsync(undefined));
      if (valid(g)) router.replace("/");
    } catch (e) {
      if (definitiveRejection((e as { code?: string })?.code)) { finalPayload.current = null; if (valid(g)) setFrozen(false); }
      if (valid(g)) setError(e instanceof Error ? `${e.message}${finalPayload.current ? " Retry confirmation unchanged, or check Today before starting over." : ""}` : "Could not confirm. Check Today before trying again.");
    } finally { guard.current = false; if (valid(g)) setBusy(false); }
  }
  async function remove(id: number) { if (guard.current || locked || frozen) return; setError(null); try { await removeTask.mutateAsync({ id }); } catch(e) { setError(e instanceof Error ? e.message : "Could not remove task."); } }
  function skip() { if (!guard.current) { generation.current++; router.replace("/"); } }
  const text = { color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 22 };
  const heading = { color: c.foreground, fontFamily: Fonts.display, fontSize: 42, lineHeight: 48, letterSpacing: -0.5 };
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={{ flex: 1, backgroundColor: c.background }}><GradientBackdrop/>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {step !== "mode" && <View style={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}><SteadyButton title="Back" variant="ghost" disabled={busy} onPress={back}/>{step === "tasks" && mode !== "challenge" && <SteadyButton title={later ? "Not now" : "Skip"} variant="ghost" disabled={busy || basicUnknown} onPress={skip}/>}</View>}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: step === "mode" ? 40 : 16, paddingBottom: 24, gap: 24, width: "100%", maxWidth: 640, alignSelf: "center" }}>
        <Text style={{ color: c.primary, fontFamily: Fonts.semibold, fontSize: 11, letterSpacing: 2 }}>STEADY / {step === "mode" ? "YOUR WAY" : step === "contact" ? "ACCOUNTABILITY" : "COMMITMENT"}</Text>
        {step === "mode" ? <>
          <View style={{ gap: 10 }}><Text style={heading}>How do you want to show up?</Text><Text style={text}>Start privately, or add someone who keeps you accountable. You choose.</Text></View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Starting mode" style={{ gap: 14 }}>{(["basic", "challenge"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === "basic" ? "Basic" : "Challenge"} accessibilityState={{ checked: mode === value, disabled: busy }} aria-checked={mode === value} disabled={busy} onPress={() => setMode(value)} style={{ padding: 22, gap: 10, borderWidth: 1, borderColor: mode === value ? c.accentForeground : c.border, borderRadius: 18, backgroundColor: mode === value ? c.accent : c.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name={value === "basic" ? "leaf-outline" : "people-outline"} size={22} color={c.primary}/><Text style={{ color: c.foreground, fontFamily: Fonts.semibold, fontSize: 18, flex: 1 }}>{value === "basic" ? "Basic" : "Challenge"}</Text>{mode === value && <Ionicons name="checkmark-circle" size={21} color={c.primary}/>}</View><Text style={text}>{value === "basic" ? "Build consistency privately. Set up a commitment now, or skip and start with to-dos." : "Invite an accountability contact. Once they accept, confirm your commitment to start Challenge."}</Text>
          </Pressable>)}</View><View style={{ flex: 1 }}/><SteadyButton title="Continue" disabled={!mode || busy} loading={busy} onPress={() => void chooseMode()}/>
        </> : step === "contact" ? <>
          <View style={{ gap: 10 }}><Text style={heading}>Who keeps you honest?</Text><Text style={text}>Challenge needs an accepted accountability contact. If you miss a Challenge day, they get an email. Back keeps your contact or pending invitation without starting a new Challenge.</Text></View>
          <PartnerSection/><View style={{ flex: 1 }}/><SteadyButton title="Continue" disabled={!(contact.data?.outgoing?.status === "accepted") || busy} onPress={() => { setStep("tasks"); setError(null); }}/>{!(contact.data?.outgoing?.status === "accepted") && <Text style={text}>Your contact must accept the invitation before you continue.</Text>}
        </> : <>
          <View style={{ gap: 10 }}><Text style={heading}>Your {monthLabel} commitment</Text><Text style={text}>{locked ? "This month is already locked. Your existing commitments stay unchanged." : mode === "challenge" ? "New Challenge entries stay on this screen until you lock in. Back discards only these unsaved entries." : "Set the easiest version you can do every day. Or skip for now — your to-dos are ready whenever you are."}</Text></View>
          {!locked && <><View style={{ flexDirection: "row", gap: 10 }}><TextInput accessibilityLabel="Commitment title" value={title} onChangeText={setTitle} editable={!busy && !frozen && !basicUnknown} maxLength={80} onSubmitEditing={() => void addTask()} placeholder="e.g. Read 10 pages" placeholderTextColor={c.mutedForeground} style={{ flex: 1, minHeight: 52, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.card, color: c.foreground, fontFamily: Fonts.sans, fontSize: 15 }}/><Pressable accessibilityRole="button" accessibilityLabel="Add commitment" disabled={busy || frozen || (title.trim().length < 2 && !basicUnknown)} onPress={() => void addTask()} style={{ width: 52, minHeight: 52, backgroundColor: c.primary, borderRadius: 16, justifyContent: "center", alignItems: "center", opacity: busy || frozen || title.trim().length < 2 ? 0.5 : 1 }}><Ionicons name="add" size={26} color={c.primaryForeground}/></Pressable></View>
          <SteadyButton title="Use microphone · multiple commitments" variant="outline" disabled={busy || frozen || basicUnknown} onPress={() => setVoiceOpen(true)}/>
          <Text style={text}>FOCUS TIME · OPTIONAL</Text><DurationWheel disabled={busy || frozen || basicUnknown} value={duration} onChange={setDuration}/></>}
          <View style={{ gap: 10 }}>{tasks.map(task => <GlassCard key={task.id} padding={16}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}><Text style={{ ...text, color: c.foreground, fontFamily: Fonts.medium }}>{task.title}</Text><Text style={{ ...text, fontSize: 11 }}>{task.mode === "challenge" ? "Challenge" : "Basic"}{task.durationMinutes ? ` · ${formatDuration(task.durationMinutes)}` : ""} · {locked ? "Locked" : "Saved draft"}</Text></View>{!locked && mode !== "challenge" && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${task.title}`} disabled={busy || removeTask.isPending || frozen} onPress={() => void remove(task.id)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close-circle-outline" size={22} color={c.mutedForeground}/></Pressable>}</View></GlassCard>)}
          {staged.map(task => <GlassCard key={task.requestId} padding={16}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}><Text style={{ ...text, color: c.foreground, fontFamily: Fonts.medium }}>{task.title}</Text><Text style={{ ...text, fontSize: 11 }}>Challenge · Not saved yet{task.durationMinutes ? ` · ${formatDuration(task.durationMinutes)}` : ""}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove staged ${task.title}`} disabled={busy || frozen} onPress={() => setStaged(old => old.filter(t => t.requestId !== task.requestId))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="close-circle-outline" size={22} color={c.mutedForeground}/></Pressable></View></GlassCard>)}
          {!tasks.length && !staged.length && <Text style={text}>Add 1–3 small tasks you can sustain daily.</Text>}</View>
          <View style={{ flex: 1 }}/>{locked ? <SteadyButton title="Return to Today" onPress={skip}/> : <><SteadyButton title={`Lock in for ${monthLabel}`} disabled={busy || removeTask.isPending || basicUnknown || !month || (mode === "challenge" ? !staged.length : !tasks.length)} loading={busy} onPress={() => void lockIn()}/><Text style={{ ...text, textAlign: "center", fontSize: 12 }}>Locked means it cannot be reduced until next month.{mode === "challenge" && tasks.length ? " Existing tasks keep their current mode." : ""}</Text></>}
        </>}
        {error && <Text accessibilityLiveRegion="polite" style={{ ...text, color: c.destructive }}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
    <VoiceSheet visible={voiceOpen} todayISO={today.data?.localDate ?? new Date().toISOString().slice(0, 10)} context={mode === "challenge" ? "challenge-setup" : "basic-setup"} onClose={() => setVoiceOpen(false)} onStage={cards => {
      if (guard.current || frozen || locked) throw new Error("This setup is locked. Return to Today.");
      const entries = stageVoiceTasks(cards, 10 - tasks.length - staged.length);
      setStaged(old => [...old, ...entries]);
    }}/>
  </SafeAreaView>;
}
