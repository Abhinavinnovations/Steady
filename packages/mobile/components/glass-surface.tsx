import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";

export const GlassMaterials = {
  dark: { fill: "rgba(34,41,44,0.94)", edge: "rgba(240,239,225,0.23)", shine: "rgba(255,253,240,0.09)", capsule: "rgba(189,210,181,0.15)", capsuleEdge: "rgba(214,232,207,0.28)" },
  light: { fill: "rgba(250,249,245,0.94)", edge: "rgba(255,255,255,1)", shine: "rgba(255,255,255,0.94)", capsule: "rgba(232,237,226,0.96)", capsuleEdge: "rgba(160,175,149,0.35)" },
};
/** Android-safe layered material. Live blur is opt-in and iOS-only, not a native Liquid Glass API. */
export function GlassSurface({ children, style, radius = 22, blur = false }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; blur?: boolean }) {
  const scheme = useColorScheme() ?? "dark"; const c = useColors(); const m = GlassMaterials[scheme];
  const [opaque, setOpaque] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
      const query = window.matchMedia("(prefers-reduced-transparency: reduce)");
      const update = () => setOpaque(query.matches);
      update(); query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    if (Platform.OS !== "ios") return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setOpaque).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setOpaque);
    return () => sub.remove();
  }, []);
  return <View style={[{ borderRadius: radius, overflow: "hidden", borderWidth: 1, borderColor: m.edge, backgroundColor: opaque ? c.cardElevated : m.fill }, style]}>
    {blur && !opaque && Platform.OS === "ios" && <BlurView pointerEvents="none" tint={scheme} intensity={28} style={StyleSheet.absoluteFill} />}
    {!opaque && <LinearGradient pointerEvents="none" colors={[m.shine, "rgba(255,255,255,0)", scheme === "dark" ? "rgba(0,0,0,0.12)" : "rgba(135,158,143,0.06)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />}
    {children}
  </View>;
}
