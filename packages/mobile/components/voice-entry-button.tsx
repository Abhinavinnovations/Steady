import { Pressable } from "react-native";
import { SteadyIcon } from "@/components/steady-icon";
import { useColors } from "@/hooks/use-colors";

export function VoiceEntryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const c = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Record or type multiple entries, then review before saving" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}><SteadyIcon name="mic-outline" size={19} color={c.primary} /></Pressable>;
}
