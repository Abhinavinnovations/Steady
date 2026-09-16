import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { GlassMaterials, GlassSurface } from "./glass-surface";
export function GlassSegmentedControl<T extends string>({ value, options, onChange, label, disabled = false, style }: {
  value: T; options: readonly { value: T; label: string; accessibilityLabel?: string }[];
  onChange: (value: T) => void; label: string; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors(); const m = GlassMaterials[useColorScheme() ?? "dark"];
  const [width, setWidth] = useState(0); const [reduce, setReduce] = useState(true);
  const x = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, options.findIndex(o => o.value === value));
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduce); const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce); return () => sub.remove(); }, []);
  useEffect(() => {
    const target = width / options.length * index;
    if (reduce) { x.setValue(target); return; }
    const animation = Animated.timing(x, { toValue: target, duration: 180, useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [index, width, options.length, x, reduce]);
  return <GlassSurface style={style} radius={20}>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ margin: 4 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {!!width && <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: width / options.length, transform: [{ translateX: x }], borderRadius: 16, borderWidth: 1, borderColor: m.capsuleEdge, backgroundColor: m.capsule, overflow: "hidden", boxShadow: "0px 2px 5px rgba(0,0,0,0.12)" }}>
        <LinearGradient colors={[m.shine, "rgba(255,255,255,0)"]} style={{ flex: 1 }} />
      </Animated.View>}
      <View style={{ flexDirection: "row" }}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.accessibilityLabel ?? option.label} accessibilityState={{ checked: option.value === value, disabled }} aria-checked={option.value === value} disabled={disabled} onPress={() => onChange(option.value)} style={({ pressed }) => ({ flex: 1, minHeight: 46, paddingHorizontal: 6, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: 16, opacity: disabled ? 0.6 : pressed ? 0.8 : 1 })}>
        <Text style={{ color: value === option.value ? c.foreground : c.mutedForeground, fontFamily: value === option.value ? Fonts.semibold : Fonts.medium, fontSize: 12, textAlign: "center" }}>{option.label}</Text>
        {option.value === value && <View style={{ width: 12, height: 2, borderRadius: 2, backgroundColor: c.primary, marginTop: 3 }} />}
      </Pressable>)}</View>
    </View>
  </GlassSurface>;
}
