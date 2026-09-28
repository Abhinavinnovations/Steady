import { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SteadyIcon } from "@/components/steady-icon";
import { randomUUID } from "expo-crypto";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { DurationWheel, formatDuration } from "@/components/duration-wheel";
import { VoiceSheet } from "@/components/voice-sheet";
import { VoiceEntryButton } from "@/components/voice-entry-button";
import { stageVoiceTasks } from "@/lib/voice-context";
import { CommitmentDurationSheet } from "@/components/commitment-duration-sheet";
import { CommitmentTaskList } from "@/components/commitment-task-list";
import { AddCommitmentTask } from "@/components/add-commitment-task";
import { useUpdateTask } from "@/queries/todos";
import { PartnerSection } from "@/components/partner-section";
import { usePartner } from "@/queries/partners";
import { useBeginSetup, useChallengeSetup, useConfirmMonth, useConfirmSetup, useCreateTask, useCurrentTasks, useProfile, useRemoveTask, useStartCommitmentToday, useToday } from "@/queries/steady";
import { definitiveRejection, withDeadline } from "@/lib/voice-draft-state";
type Mode = "basic" | "challenge";
type Staged = { requestId: string; title: string; durationMinutes?: number };
export default function OnboardingScreen() {
  const c = useColors(); const router = useRouter(); const params = useLocalSearchParams<{ step?: string; entry?: string }>();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [editingDuration, setEditingDuration] = useState<{ id: number; title: string; durationMinutes: number | null } | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const updateTask = useUpdateTask();
  const today = useToday();
  const startToday = useStartCommitmentToday();
  const later = params.step === "tasks";
  const fromProfile = params.entry === "profile";
  const [step, setStep] = useState<"mode" | "contact" | "tasks">(fromProfile ? "contact" : later ? "tasks" : "mode");
  const [mode, setMode] = useState<Mode | null>(fromProfile ? "challenge" : later ? "basic" : null);
  const [title, setTitle] = useState(""); const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null); const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false); const guard = useRef(false); const generation = useRef(0); const alive = useRef(true);
  const [frozen, setFrozen] = useState(false); const finalPayload = useRef<{ month: string; tasks: Staged[] } | null>(null);
  const basicPayload = useRef<Staged | null>(null); const [basicUnknown, setBasicUnknown] = useState(false);
  const begin = useBeginSetup(); const current = useCurrentTasks(); const profile = useProfile(); const contact = usePartner();
  const createTask = useCreateTask(); const removeTask = useRemoveTask(); const confirmMonth = useConfirmMonth(); const confirmSetup = useConfirmSetup();
  const setup = useChallengeSetup(mode === "challenge" && !!profile.data?.onboardedAt);
  // Pin the reviewed target. Refetches must never silently move staged commitments.
  const [target, setTarget] = useState<typeof setup.data>(undefined);
  useEffect(() => { if (setup.data && !target) setTarget(setup.data); }, [setup.data, target]);
  // Pin unsaved setup, but keep saved commitments live across activation and edits.
  const challenge = target?.confirmed ? setup.data ?? target : target;
  const data = mode === "challenge" ? challenge : current.data;
  const tasks = data?.tasks ?? []; const locked = data?.confirmed ?? false;
  const ready = !!data;
  const month = data?.month;
  useEffect(() => { if (fromProfile && setup.data?.confirmed) setStep("tasks"); }, [fromProfile, setup.data?.confirmed]);
  const monthLabel = month ? new Date(`${month}-01T12:00:00Z`).toLocaleString("en", { month: "long", timeZone: "UTC" }) : "monthly";
  useEffect(() => { const life = alive; const sessionGeneration = generation; life.current = true; return () => { life.current = false; sessionGeneration.current++; }; }, []);
  const valid = (g: number) => alive.current && generation.current === g;
  function leave() {
    generation.current++; setError(null); setTitle(""); setDuration(null); setStaged([]);
    setTarget(undefined); setFrozen(false); finalPayload.current = null;
    if (fromProfile) router.replace("/(tabs)/profile"); else if (later) router.replace("/"); else { setStep("mode"); setMode(null); }
  }
  function back() {
    if (editingDuration) { if (!updateTask.isPending) setEditingDuration(null); return; }
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
    if (guard.current || !ready || frozen || locked || (title.trim().length < 2 && !basicPayload.current)) return;
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
    if (guard.current || (!frozen && locked) || !month || basicUnknown) return;
    guard.current = true; setBusy(true); setError(null); const g = generation.current;
    try {
      if (mode === "challenge") {
        finalPayload.current ??= { month, tasks: staged }; setFrozen(true);
        await withDeadline(confirmSetup.mutateAsync(finalPayload.current));
      } else await withDeadline(confirmMonth.mutateAsync(undefined));
      if (valid(g)) router.replace(fromProfile || target?.scheduled ? "/(tabs)/profile" : "/");
    } catch (e) {
      if (definitiveRejection((e as { code?: string })?.code)) { finalPayload.current = null; if (valid(g)) setFrozen(false); }
      if (valid(g)) setError(e instanceof Error ? `${e.message}${finalPayload.current ? " Retry confirmation unchanged, or check Today before starting over." : ""}` : "Could not confirm. Check Today before trying again.");
    } finally { guard.current = false; if (valid(g)) setBusy(false); }
  }
  async function activate() {
    if (guard.current || !challenge?.scheduled || !today.data) return;
    guard.current = true; setBusy(true); setError(null);
    try {
      await startToday.mutateAsync({ month: challenge.month, expectedDate: today.data.localDate, taskIds: tasks.filter(t => t.mode === "challenge").map(t => t.id) });
      const refreshed = await setup.refetch();
      if (refreshed.data) setTarget(refreshed.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start your commitment. Retry without creating it again."); }
    finally { guard.current = false; setBusy(false); }
  }
  function requestStart() {
    const message = "Start these Challenge tasks today instead of next month? The same tasks will move into this month. Their titles and focus times stay unchanged; previous days will not count.";
    if (Platform.OS === "web") { if (window.confirm(message)) void activate(); }
    else Alert.alert("Start commitment today?", message, [{ text: "Cancel", style: "cancel" }, { text: "Start today", onPress: () => void activate() }]);
  }
  async function remove(id: number) { if (guard.current || locked || frozen) return; setError(null); try { await removeTask.mutateAsync({ id }); } catch(e) { setError(e instanceof Error ? e.message : "Could not remove task."); } }
  async function saveDuration(durationMinutes: number | null) {
    if (!editingDuration || updateTask.isPending) return;
    setDurationError(null);
    try {
      const updated = await updateTask.mutateAsync({ id: editingDuration.id, durationMinutes });
      setTarget(old => old ? { ...old, tasks: old.tasks.map(t => t.id === updated.id ? updated : t) } : old);
      setEditingDuration(null);
    } catch (e) { setDurationError(e instanceof Error ? e.message : "Could not save focus time. Retry without reducing your commitment."); }
  }
  function skip() { if (!guard.current) { generation.current++; router.replace(fromProfile ? "/(tabs)/profile" : "/"); } }
  const text = { color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 22 };
  const heading = { color: c.foreground, fontFamily: Fonts.display, fontWeight: "normal" as const, fontStyle: "normal" as const, includeFontPadding: false, fontSize: 42, lineHeight: 48, letterSpacing: -0.5 };
  return <SafeAreaView edges={["top", "left", "right", "bottom"]} style={{ flex: 1, backgroundColor: c.background }}><GradientBackdrop/>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {step !== "mode" && <View style={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between" }}><SteadyButton title="Back" variant="ghost" disabled={busy} onPress={back}/>{step === "tasks" && mode !== "challenge" && <SteadyButton title={later ? "Not now" : "Skip"} variant="ghost" disabled={busy || basicUnknown} onPress={skip}/>}</View>}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: step === "mode" ? 40 : 16, paddingBottom: 24, gap: 24, width: "100%", maxWidth: 640, alignSelf: "center" }}>
        <Text style={{ color: c.primary, fontFamily: Fonts.semibold, fontSize: 11, letterSpacing: 2 }}>STEADY / {step === "mode" ? "YOUR WAY" : step === "contact" ? "ACCOUNTABILITY" : "COMMITMENT"}</Text>
        {step === "mode" ? <>
          <View style={{ gap: 10 }}><Text style={heading}>How do you want to show up?</Text><Text style={text}>Start privately, or add someone who keeps you accountable. You choose.</Text></View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Starting mode" style={{ gap: 14 }}>{(["basic", "challenge"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === "basic" ? "Basic" : "Challenge"} accessibilityState={{ checked: mode === value, disabled: busy }} aria-checked={mode === value} disabled={busy} onPress={() => setMode(value)} style={{ padding: 22, gap: 10, borderWidth: 1, borderColor: mode === value ? c.accentForeground : c.border, borderRadius: 18, backgroundColor: mode === value ? c.accent : c.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><SteadyIcon name={value === "basic" ? "leaf-outline" : "people-outline"} size={22} color={c.primary}/><Text style={{ color: c.foreground, fontFamily: Fonts.semibold, fontSize: 18, flex: 1 }}>{value === "basic" ? "Basic" : "Challenge"}</Text>{mode === value && <SteadyIcon name="checkmark-circle" size={21} color={c.primary}/>}</View><Text style={text}>{value === "basic" ? "Build consistency privately. Set up a commitment now, or skip and start with to-dos." : "Invite an accountability contact. Once they accept, confirm your commitment to start Challenge."}</Text>
          </Pressable>)}</View><View style={{ flex: 1 }}/><SteadyButton title="Continue" disabled={!mode || busy} loading={busy} onPress={() => void chooseMode()}/>
        </> : step === "contact" ? <>
          <View style={{ gap: 10 }}><Text style={heading}>Who keeps you honest?</Text><Text style={text}>Challenge needs an accepted accountability contact. Only Challenge progress is shared; your Basic tasks remain private. Back keeps your contact or pending invitation without starting a new Challenge.</Text></View>
          <PartnerSection/><View style={{ flex: 1 }}/><SteadyButton title="Continue" disabled={!(contact.data?.outgoing?.status === "accepted") || busy} onPress={() => { setStep("tasks"); setError(null); }}/>{!(contact.data?.outgoing?.status === "accepted") && <Text style={text}>Your contact must accept the invitation before you continue.</Text>}
        </> : <>
          <View style={{ gap: 10 }}><Text style={heading}>Your {monthLabel} commitment</Text>{mode === "challenge" && challenge && <Text style={text}>{challenge.scheduled ? `Starts ${challenge.startDate}. Keep this date, or choose Start today below to make these tasks available now.` : locked ? "Complete your Challenge tasks here, one day at a time." : `Starts ${challenge.startDate} after confirmation. Basic tasks keep their mode and privacy.`}</Text>}<Text style={text}>{locked ? "Tasks cannot be deleted. Focus time can only increase." : mode === "challenge" ? "New Challenge entries stay on this screen until you lock in. Back discards only these unsaved entries." : "Set the easiest version you can do every day. Or skip for now. Your to-dos are ready whenever you are."}</Text>{locked && mode === "challenge" && <Text style={text}>Missed Challenge days can notify your consenting contact by email. Basic tasks and notes stay private.</Text>}</View>
          {!ready && <SteadyButton title={setup.isFetching || current.isFetching ? "Loading commitment month…" : "Retry commitment month"} variant="outline" disabled={setup.isFetching || current.isFetching} onPress={() => { void setup.refetch(); void current.refetch(); }}/>}
          {ready && !locked && <><View style={{ alignItems: "flex-end" }}><VoiceEntryButton label={mode === "challenge" ? "Add Challenge commitments by voice" : "Add consistent tasks by voice"} disabled={busy || frozen || basicUnknown} onPress={() => setVoiceOpen(true)}/></View><View style={{ flexDirection: "row", gap: 10 }}><TextInput accessibilityLabel="Commitment title" value={title} onChangeText={setTitle} editable={!busy && !frozen && !basicUnknown} maxLength={80} onSubmitEditing={() => void addTask()} placeholder="e.g. Read 10 pages" placeholderTextColor={c.mutedForeground} style={{ flex: 1, minHeight: 52, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.inputBorder, backgroundColor: c.card, color: c.foreground, fontFamily: Fonts.sans, fontSize: 15 }}/><Pressable accessibilityRole="button" accessibilityLabel="Add commitment" disabled={busy || frozen || (title.trim().length < 2 && !basicUnknown)} onPress={() => void addTask()} style={{ width: 52, minHeight: 52, backgroundColor: c.primary, borderRadius: 16, justifyContent: "center", alignItems: "center", opacity: busy || frozen || title.trim().length < 2 ? 0.5 : 1 }}><SteadyIcon name="add" size={26} color={c.primaryForeground}/></Pressable></View>
          <Text style={text}>FOCUS TIME · OPTIONAL</Text><DurationWheel disabled={busy || frozen || basicUnknown} value={duration} onChange={setDuration}/></>}
          <View style={{ gap: 10 }}>{locked && month ? <CommitmentTaskList month={month} tasks={tasks.filter(t => t.mode === mode)} onEdit={task => { setDurationError(null); setEditingDuration(task); }}/> : tasks.filter(task => task.mode === mode).map(task => <GlassCard key={task.id} padding={16}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}><Text style={{ ...text, color: c.foreground, fontFamily: Fonts.medium }}>{task.title}</Text><Text style={{ ...text, fontSize: 11 }}>{task.mode === "challenge" ? "Challenge" : "Basic"}{task.durationMinutes ? ` · ${formatDuration(task.durationMinutes)}` : ""} · {locked ? target?.scheduled ? `Starts ${task.startDate}` : "Complete on Today" : "Saved draft"}</Text></View>{locked && <Pressable accessibilityRole="button" accessibilityLabel={`Edit focus time for ${task.title}`} onPress={() => { setDurationError(null); setEditingDuration(task); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><SteadyIcon name="timer-outline" size={22} color={c.primary}/></Pressable>}{!locked && mode !== "challenge" && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${task.title}`} disabled={busy || removeTask.isPending || frozen} onPress={() => void remove(task.id)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><SteadyIcon name="close-circle-outline" size={22} color={c.mutedForeground}/></Pressable>}</View></GlassCard>)}
          {staged.map(task => <GlassCard key={task.requestId} padding={16}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}><Text style={{ ...text, color: c.foreground, fontFamily: Fonts.medium }}>{task.title}</Text><Text style={{ ...text, fontSize: 11 }}>Challenge · Not saved yet{task.durationMinutes ? ` · ${formatDuration(task.durationMinutes)}` : ""}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove staged ${task.title}`} disabled={busy || frozen} onPress={() => setStaged(old => old.filter(t => t.requestId !== task.requestId))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><SteadyIcon name="close-circle-outline" size={22} color={c.mutedForeground}/></Pressable></View></GlassCard>)}
          {!tasks.length && !staged.length && <Text style={text}>Add 1–3 small tasks you can sustain daily.</Text>}</View>
          {locked && mode === "challenge" && !challenge?.scheduled && <AddCommitmentTask count={tasks.length}/>}
          <View style={{ flex: 1 }}/>{locked ? <View style={{ gap: 12 }}>{mode === "challenge" && challenge?.scheduled && <SteadyButton title="Start today" loading={busy} disabled={busy || !today.data} onPress={requestStart}/>}<SteadyButton title="Go to Today" variant="outline" disabled={busy} onPress={() => router.replace("/")}/></View> : <><SteadyButton title={`Lock in for ${monthLabel}`} disabled={busy || !ready || removeTask.isPending || basicUnknown || !month || (mode === "challenge" ? !staged.length : !tasks.length)} loading={busy} onPress={() => void lockIn()}/><Text style={{ ...text, textAlign: "center", fontSize: 12 }}>Locked means it cannot be reduced until next month.{mode === "challenge" && tasks.length ? " Existing tasks keep their current mode." : ""}</Text></>}
        </>}
        {error && <Text accessibilityLiveRegion="polite" style={{ ...text, color: c.destructive }}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
    <CommitmentDurationSheet task={editingDuration} submitting={updateTask.isPending} error={durationError} onClose={() => setEditingDuration(null)} onSave={durationMinutes => void saveDuration(durationMinutes)}/>
    <VoiceSheet visible={voiceOpen} todayISO={today.data?.localDate ?? new Date().toISOString().slice(0, 10)} context={mode === "challenge" ? "challenge-setup" : "basic-setup"} onClose={() => setVoiceOpen(false)} onStage={cards => {
      if (guard.current || !ready || frozen || locked) throw new Error("This setup is locked. Return to Today.");
      const entries = stageVoiceTasks(cards, 10 - tasks.length - staged.length);
      setStaged(old => [...old, ...entries]);
    }}/>
  </SafeAreaView>;
}
