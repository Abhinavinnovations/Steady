import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import type { VoiceContext } from "@/lib/voice-context";
import { editableCard, type VoiceCard } from "@/lib/voice-draft-state";
import { GlassCard } from "./glass-card";
import { GlassSegmentedControl } from "./glass-segmented-control";
import { DatePicker, RepeatPicker } from "./date-picker";
import { DurationWheel } from "./duration-wheel";
import { CategoryPicker, TimeField } from "./schedule-fields";
export function VoiceDraftCard({ card, index, today, busy, onEdit, onSelect, context }: { context?: VoiceContext; card: VoiceCard; index: number; today: string; busy: boolean; onEdit: (changes: Partial<VoiceCard>) => void; onSelect: () => void }) {
  const c = useColors(); const [expanded, setExpanded] = useState(false); const locked = busy || !editableCard(card);
  const text = { color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 19 };
  return <GlassCard padding={16}>
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`Select task ${index + 1}`} accessibilityState={{ checked: card.selected, disabled: busy || card.status === "saved" }} aria-checked={card.selected} onPress={onSelect} disabled={busy || card.status === "saved"} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name={card.status === "saved" ? "checkmark-done-circle" : card.selected ? "checkbox" : "square-outline"} size={25} color={card.selected || card.status === "saved" ? c.primary : c.mutedForeground} />
        </Pressable>
        <View style={{ flex: 1 }}><Text style={{ ...text, color: c.primary, fontFamily: Fonts.medium }}>{card.status === "saved" ? "SAVED" : card.status === "saving" ? "SAVING…" : card.status === "unknown" ? "NOT YET CONFIRMED" : `${String(index + 1).padStart(2, "0")} / ${card.kind === "todo" ? "TO-DO" : "CONSISTENT"}`}</Text>
          <TextInput accessibilityLabel={`Task ${index + 1} title`} value={card.title} editable={!locked} maxLength={80} onChangeText={title => onEdit({ title })} multiline style={{ color: c.foreground, fontFamily: Fonts.display, fontSize: 26, lineHeight: 32, paddingVertical: 7, minHeight: 44 }} />
        </View>
      </View>
      <Text style={text}>{card.kind === "todo" ? `${card.date ?? today}${card.repeat !== "none" ? ` · ${card.repeat}` : ""}` : context === "challenge-setup" ? "Daily commitment · Challenge · Staged only" : "Daily commitment · Basic"}{card.time ? ` · ${card.time}` : ""}{card.durationMinutes ? ` · ${card.durationMinutes} min` : ""}</Text>
      {card.status !== "saved" && <Pressable accessibilityRole="button" accessibilityLabel={`Edit task ${index + 1} details`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ ...text, color: c.primary, fontFamily: Fonts.medium }}>{expanded ? "Hide details" : "Review details"}</Text><Ionicons name={expanded ? "chevron-up" : "chevron-down"} color={c.primary} size={17}/></Pressable>}
      {expanded && card.status !== "saved" && <View style={{ gap: 14 }}>
        {!context && <GlassSegmentedControl label={`Task ${index + 1} kind`} value={card.kind} options={[{ value: "todo", label: "To-do" }, { value: "consistent", label: "Consistent" }]} disabled={locked} onChange={kind => onEdit({ kind, repeat: kind === "consistent" ? "none" : card.repeat })}/>}
        <Text style={text}>{context === "challenge-setup" ? "Every day this month. Only title and focus time are staged; Lock in saves your Challenge commitment." : card.kind === "consistent" ? "Every day this month. Completion needs a note; monthly commitment rules apply. This does not activate Challenge." : "One-off or repeating. Independent of your consistency streak."}</Text>
        {card.kind === "todo" && <><DatePicker disabled={locked} todayISO={today} value={card.date ?? today} onChange={date => onEdit({ date })}/><RepeatPicker disabled={locked} value={card.repeat} onChange={repeat => onEdit({ repeat })}/></>}
        <Text style={text}>FOCUS DURATION</Text><DurationWheel disabled={locked} value={card.durationMinutes} onChange={durationMinutes => onEdit({ durationMinutes })}/>
        {(!context || context === "todo") && <><TimeField disabled={locked} value={card.time} onChange={time => onEdit({ time })}/><CategoryPicker disabled={locked} value={card.categoryId} onChange={categoryId => onEdit({ categoryId })}/>
        {card.time && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={text}>Remind me</Text><Switch accessibilityLabel={`Task ${index + 1} reminder`} disabled={locked} value={card.reminder} onValueChange={reminder => onEdit({ reminder })} trackColor={{ true: c.primary }}/></View>}</>}
      </View>}
      {card.error && <Text accessibilityLiveRegion="polite" style={{ ...text, color: c.destructive }}>{card.error}</Text>}
      {card.diagnostic && <Text selectable style={{ ...text, fontFamily: Fonts.mono, fontSize: 10 }}>{card.diagnostic}</Text>}
    </View>
  </GlassCard>;
}
