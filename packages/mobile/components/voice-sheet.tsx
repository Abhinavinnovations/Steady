import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { PaperModal as Modal } from "@/components/paper-modal";
import { SteadyButton } from "./steady-button";
import { GlassSurface } from "./glass-surface";
import { GradientBackdrop } from "./gradient-backdrop";
import { VoiceDraftCard } from "./voice-draft-card";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { useVoiceBatch } from "@/hooks/use-voice-batch";
import { useAssistantParseMany } from "@/queries/assistant";
import { useProfile } from "@/queries/steady";
import { useCategories } from "@/queries/todos";
import { authClient } from "@/lib/auth";
import { contextualCard, type VoiceContext } from "@/lib/voice-context";
import type { VoiceCard } from "@/lib/voice-draft-state";
import { validCard, withDeadline } from "@/lib/voice-draft-state";
import { voiceDiagnostic } from "@/lib/voice-diagnostics";
import type { AssistantInput } from "../../web/src/shared/assistant-draft";

type VoiceProps = { visible: boolean; todayISO: string; onClose: () => void; context?: VoiceContext; onStage?: (cards: VoiceCard[]) => void };
export function VoiceSheet({ visible, todayISO, onClose, context, onStage }: VoiceProps) {
  const { data: session } = authClient.useSession();
  return visible && session?.user.id ? <VoiceSession key={`${session.user.id}:${context ?? "all"}`} owner={session.user.id} todayISO={todayISO} onClose={onClose} context={context} onStage={onStage}/> : null;
}
function VoiceSession({ owner, todayISO, onClose, context, onStage }: Omit<VoiceProps, "visible"> & { owner: string }) {
  const c = useColors(); const insets = useSafeAreaInsets(); const profile = useProfile(); const categories = useCategories();
  const batch = useVoiceBatch(owner, todayISO, context === "challenge-setup"); const parser = useAssistantParseMany();
  const [typed, setTyped] = useState(""); const [parsing, setParsing] = useState(false); const parseGuard = useRef(false); const stageGuard = useRef(false);
  const [error, setError] = useState<string | null>(null); const [replaceConfirm, setReplaceConfirm] = useState(false);
  const alive = useRef(true); const token = useRef(0); const lastInput = useRef<AssistantInput | null>(null);
  useEffect(() => { const life = alive; const sessionToken = token; life.current = true; return () => { life.current = false; sessionToken.current++; lastInput.current = null; }; }, []);
  async function runParse(input: AssistantInput) {
    if (parseGuard.current || batch.submitted || batch.loading) return;
    const current = ++token.current; parseGuard.current = true; lastInput.current = input; setParsing(true); setError(null); setReplaceConfirm(false);
    voiceDiagnostic("parse", "batch");
    try {
      const result = await withDeadline(parser.mutateAsync(input), 55_000);
      if (!alive.current || current !== token.current) return;
      setTyped(result.transcript);
      batch.replace(result.drafts.map(draft => contextualCard({ ...draft, localId: randomUUID(), selected: true, status: "editable", categoryId: categories.data?.find(x => x.name.toLowerCase() === draft.categoryName?.toLowerCase())?.id ?? null }, context)));
      lastInput.current = null;
    } catch (e) { if (alive.current && current === token.current) setError(e instanceof Error ? e.message : "Could not read your tasks. Retry or type below."); }
    finally { parseGuard.current = false; if (alive.current && current === token.current) setParsing(false); }
  }
  const capture = useVoiceCapture(runParse, setError);
  const recording = capture.phase === "listening" || capture.phase === "paused";
  const processing = parsing || capture.phase === "starting" || capture.phase === "reading" || capture.settling;
  const review = batch.cards.length > 0;
  const selected = batch.cards.filter(card => card.selected && card.status !== "saved");
  const saved = batch.cards.filter(card => card.status === "saved").length;
  const unknown = batch.cards.some(card => card.status === "unknown");
  const allSaved = review && saved === batch.cards.length;
  const input = { color: c.foreground, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 23, backgroundColor: c.card, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 16, padding: 15 };
  const small = { color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 20 };
  function close() {
    if (batch.busy && Platform.OS !== "web") Alert.alert("Close this batch?", "An in-flight save may still finish. Reopen voice capture to check its status; remaining cards will not be submitted.", [{ text: "Stay", style: "cancel" }, { text: "Close", onPress: onClose }]);
    else onClose();
  }
  return <Modal accessibilityLabel="Voice task entry" visible animationType="slide" onRequestClose={close}><SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: c.background }}>
    <GradientBackdrop/>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 22, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View><Text style={{ color: c.primary, fontFamily: Fonts.semibold, fontSize: 11, letterSpacing: 2 }}>STEADY / VOICE</Text><Text style={small}>Speak. Review. Add.</Text></View>
        <GlassSurface radius={24}><Pressable accessibilityRole="button" accessibilityLabel="Close voice capture" onPress={close} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={22} color={c.foreground}/></Pressable></GlassSurface>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingBottom: 24, gap: 20, width: "100%", maxWidth: 640, alignSelf: "center" }}>
        <Text accessibilityLiveRegion="polite" style={{ color: c.foreground, fontFamily: Fonts.display, fontSize: 42, lineHeight: 48, letterSpacing: -0.8 }}>{batch.loading ? "Checking earlier saves…" : parsing ? "Turning words into a plan…" : review ? allSaved ? "A little more headspace." : "Make it yours." : capture.phase === "paused" ? "Take your time." : recording ? "Go ahead. I’m listening." : "Make room in your mind."}</Text>
        {batch.loading ? <ActivityIndicator color={c.primary}/> : review ? <View style={{ gap: 14 }}>
          {!!typed && <View style={{ gap: 8 }}><Text style={small}>WHAT YOU SAID</Text><TextInput accessibilityLabel="Transcript" value={typed} onChangeText={setTyped} multiline maxLength={2000} editable={!batch.submitted && !batch.busy && !parsing} style={input}/>
            {!batch.submitted && <SteadyButton title="Reinterpret edited words" variant="ghost" disabled={parsing || typed.trim().length < 2} onPress={() => setReplaceConfirm(true)}/>}
            {replaceConfirm && <View style={{ gap: 8 }}><Text style={small}>This replaces all review cards, including your edits. Nothing has been saved.</Text><SteadyButton title="Replace review cards" disabled={parsing} onPress={() => void runParse({ transcript: typed.trim() })}/><SteadyButton title="Keep these cards" variant="ghost" onPress={() => setReplaceConfirm(false)}/></View>}
          </View>}
          <Text style={small}>{batch.submitted ? "Previously submitted cards keep their original task type and exact save details for safe recovery. Close this batch and reopen voice entry to start new contextual drafts after resolving pending saves." : context === "challenge-setup" ? "Daily Challenge commitments · title and focus time only. Selected entries are staged, not saved, until Lock in." : context === "basic-setup" ? "Daily Basic commitments · title and focus time only. Add selected saves drafts; Lock in confirms your month." : context === "todo" ? "To-dos only · independent of your consistency streak." : ""}</Text>
          <Text accessibilityLiveRegion="polite" style={small}>{batch.cards.length} task{batch.cards.length === 1 ? "" : "s"} · {selected.length} selected{saved ? ` · ${saved} saved` : ""}</Text>
          {batch.cards.map((card, index) => <VoiceDraftCard key={card.localId} card={card} index={index} today={todayISO} busy={batch.busy || parsing} context={card.payload ? undefined : context} onEdit={changes => batch.edit(card.localId, changes)} onSelect={() => batch.select(card.localId)}/>)}
          {unknown && <SteadyButton title="Check saved status" variant="outline" disabled={batch.busy} onPress={() => void batch.reconcile()}/>}
          {!batch.submitted && <SteadyButton title="Start again" variant="ghost" disabled={batch.busy || parsing} onPress={() => { batch.replace([]); setTyped(""); setError(null); }}/ >}
        </View> : <View style={{ flex: 1, gap: 20 }}>
          <Text style={{ ...small, fontSize: 15, lineHeight: 25 }}>“Buy groceries tomorrow. Read for twenty minutes every evening. Call Mum on Sunday.”</Text>
          {capture.live && <Text style={small}>Live recognition uses your phone’s speech service, which may send audio online while you speak. Steady receives the recognized text only after Finish (automatically at 60 seconds or the text limit).</Text>}
          <View style={{ alignItems: "center", paddingVertical: 25, gap: 20 }}>
            <GlassSurface radius={88} style={{ padding: 22 }}><Pressable accessibilityRole="button" accessibilityLabel={recording ? "Finish recording" : "Start recording"} disabled={processing} onPress={() => { setError(null); voiceDiagnostic(recording ? "finish" : "capture", "batch"); void (recording ? capture.finish() : capture.start()); }} style={{ width: 116, height: 116, borderRadius: 58, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>{processing ? <ActivityIndicator color={c.primaryForeground} size="large"/> : <Ionicons name={recording ? "stop" : "mic"} size={42} color={c.primaryForeground}/>}</Pressable></GlassSurface>
            {recording && <><Text style={{ color: c.foreground, fontFamily: Fonts.mono, fontSize: 21 }}>{capture.seconds} / 60 sec</Text>
              <View accessibilityLabel={capture.meteringAvailable ? "Microphone level history" : "Microphone recording; level unavailable"} style={{ height: 48, width: "100%", flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center" }}>{capture.levels.map((level, i) => <View key={i} style={{ width: 3, height: 48 * level, backgroundColor: c.primary, borderRadius: 2 }}/>)}</View>
              <View style={{ flexDirection: "row", gap: 12 }}><SteadyButton title={capture.phase === "paused" ? "Resume" : "Pause"} disabled={processing} variant="outline" onPress={() => void capture.pause()}/><SteadyButton title="Finish" disabled={processing} onPress={() => void capture.finish()}/></View></>}
            <Text style={{ ...small, textAlign: "center" }}>{processing ? capture.phase === "starting" ? "Waiting for microphone permission or the speech service…" : "Finishing your words. You can close to cancel." : capture.live ? "Live words · English (US). Finish to review your tasks." : recording ? "Your transcript appears after Finish." : "Tap to record up to 20 tasks in 60 seconds."}</Text>
            {capture.live && <View style={{ width: "100%", padding: 16, gap: 8, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ ...small, fontFamily: Fonts.semibold, letterSpacing: 1 }}>WORDS AS YOU SPEAK</Text>
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <Text selectable accessibilityLabel="Live transcript" style={{ color: c.foreground, fontFamily: Fonts.sans, fontSize: 17, lineHeight: 28 }}>
                  {capture.text}{capture.text && capture.interim ? " " : ""}<Text style={{ color: c.mutedForeground }}>{capture.interim || (!capture.text ? recording ? "Listening for your words…" : "Your words will appear here." : "")}</Text>
                </Text>
              </ScrollView>
              <Text style={small}>Provisional words can change. You can edit the transcript after Finish.</Text>
            </View>}
            {!capture.live && !capture.liveAvailable && <Text style={{ ...small, textAlign: "center" }}>This preview transcribes after Finish. Live words require an installed build.</Text>}
            {capture.liveAvailable && !processing && (!recording || capture.phase === "paused") && <SteadyButton
              title={capture.live ? capture.text || capture.interim ? "Discard words and use recording" : "Use recording instead" : "Use live words"}
              variant="ghost"
              onPress={() => {
                if (!capture.live) { setError(null); capture.useLive(); }
                else if (capture.text || capture.interim) Alert.alert("Discard this dictation?", "Only the words in this capture will be cleared. Recording sends audio to Steady after Finish.", [{ text: "Keep words", style: "cancel" }, { text: "Use recording", onPress: () => { setError(null); void capture.useRecording(); } }]);
                else { setError(null); void capture.useRecording(); }
              }}/>}
          </View>
          {!recording && <View style={{ gap: 12 }}><Text style={small}>OR TYPE YOUR REQUEST</Text><TextInput accessibilityLabel="Task request" value={typed} onChangeText={setTyped} multiline maxLength={2000} placeholder="What’s on your mind?" placeholderTextColor={c.mutedForeground} editable={!processing} style={[input, { minHeight: 90 }]}/><SteadyButton title="Review tasks" disabled={processing || typed.trim().length < 2} onPress={() => void runParse({ transcript: typed.trim() })}/></View>}
        </View>}
        {(error || capture.error || batch.error) && <View accessibilityLiveRegion="polite" style={{ padding: 15, gap: 10, borderWidth: 1, borderColor: c.destructive, borderRadius: 16 }}><Text selectable style={{ ...small, color: c.destructive }}>{error || capture.error || batch.error}</Text>{lastInput.current && !parsing && !batch.submitted && <SteadyButton title="Retry last recording or request" variant="outline" onPress={() => void runParse(lastInput.current!)}/>} {capture.denied && Platform.OS !== "web" && <SteadyButton title="Open Settings" variant="outline" onPress={() => void Linking.openSettings()}/>}</View>}
        {batch.notice && <Text accessibilityLiveRegion="polite" style={small}>{batch.notice}</Text>}
        <Text style={{ ...small, fontSize: 11 }}>{capture.live ? "Your phone’s speech service may process audio online while listening. Only text goes to Steady after Finish." : "Audio goes to Steady’s AI service only after Finish."} Nothing is added until you confirm. {profile.data?.timezone ? `Schedule: ${profile.data.timezone}.` : ""}</Text>
      </ScrollView>
      {review && <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: c.card, borderTopWidth: 1, borderColor: c.border, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14) }}>
        <SteadyButton title={allSaved ? "Done" : batch.busy ? "Saving selected tasks…" : context === "challenge-setup" ? `Stage selected commitments (${selected.length})` : `Add selected tasks (${selected.length})`} disabled={!allSaved && (batch.busy || parsing || !selected.length || selected.some(card => !validCard(card, todayISO)))} onPress={allSaved ? onClose : () => {
          if (context === "challenge-setup") {
            if (stageGuard.current) return;
            stageGuard.current = true;
            try { if (!onStage) throw new Error("Setup is not ready. Close and try again."); onStage(selected); onClose(); }
            catch (e) { stageGuard.current = false; setError(e instanceof Error ? e.message : "Could not stage commitments."); }
          } else void batch.save();
        }}/>
        {saved > 0 && !allSaved && <Text style={{ ...small, textAlign: "center", marginTop: 5 }}>{saved} saved. Only unsaved selected cards will be submitted.</Text>}
      </View>}
    </KeyboardAvoidingView>
  </SafeAreaView></Modal>;
}
