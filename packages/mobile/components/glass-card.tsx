import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";
/** Stable content surface. Navigation/controls use GlassSurface instead of expensive list-row blur. */
export function GlassCard({ children, style, padding = 16, radius = 16 }: { children: ReactNode; style?: ViewStyle; intensity?: number; padding?: number; radius?: number }) {
  const colors = useColors();
  return <View style={[{ borderRadius: radius, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding }, style]}>{children}</View>;
}
