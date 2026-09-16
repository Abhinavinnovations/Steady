import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

export function PaperHeading({ title, subtitle, trailing, wordmark = true }: { title: string; subtitle?: string; trailing?: ReactNode; wordmark?: boolean }) {
  const c = useColors();
  return <View style={{ gap: 12 }}>
    {wordmark && <Text style={{ color: c.mutedForeground, fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 3.4 }}>STEADY</Text>}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: c.foreground, fontFamily: Fonts.display, fontSize: 44, lineHeight: 50, letterSpacing: -0.7 }}>{title}</Text>
      {trailing}
    </View>
    {subtitle && <Text style={{ color: c.mutedForeground, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 21 }}>{subtitle}</Text>}
  </View>;
}
