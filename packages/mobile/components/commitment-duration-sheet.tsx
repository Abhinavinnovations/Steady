import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PaperModal } from "./paper-modal";
import { DurationWheel } from "./duration-wheel";
import { SteadyButton } from "./steady-button";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

type Commitment = { id: number; title: string; durationMinutes: number | null };
export function CommitmentDurationSheet({ task, submitting, error, onClose, onSave }: {
  task: Commitment | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (duration: number | null) => void;
}) {
  const c = useColors();
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => { setDuration(task?.durationMinutes ?? null); }, [task?.id, task?.durationMinutes]);
  return <PaperModal visible={!!task} transparent animationType="slide" accessibilityLabel="Committed focus time" onRequestClose={() => { if (!submitting) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
      <Pressable accessibilityLabel="Close committed focus time" accessibilityRole="button" disabled={submitting} onPress={onClose} style={{ flex: 1 }}/>
      <SafeAreaView edges={["bottom", "left", "right"]} style={{ maxHeight: "85%", backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: "100%", maxWidth: 640, alignSelf: "center" }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
          <Text accessibilityRole="header" style={{ fontFamily: Fonts.display, fontWeight: "normal", fontStyle: "normal", includeFontPadding: false, color: c.foreground, fontSize: 32, lineHeight: 38 }}>{task?.title}</Text>
          <Text style={{ fontFamily: Fonts.sans, color: c.mutedForeground, fontSize: 14, lineHeight: 21 }}>You can increase focus time, but cannot reduce it or delete this commitment. Its start date stays unchanged.</Text>
          <DurationWheel key={task?.id} value={duration} minimum={task?.durationMinutes ?? null} disabled={submitting} onChange={setDuration}/>
          {error && <Text accessibilityLiveRegion="polite" style={{ fontFamily: Fonts.sans, color: c.destructive }}>{error}</Text>}
          <SteadyButton title="Save focus time" loading={submitting} disabled={submitting || (duration ?? 0) < (task?.durationMinutes ?? 0) || duration === task?.durationMinutes} onPress={() => onSave(duration)}/>
          <SteadyButton title="Cancel" variant="ghost" disabled={submitting} onPress={onClose}/>
        </ScrollView>
      </SafeAreaView>
    </View>
  </PaperModal>;
}
