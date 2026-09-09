import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";

/**
 * Liquid-glass surface: blur + translucent fill + hairline border.
 * Every card, sheet, and bar in the app sits on this.
 */
export function GlassCard({
  children,
  style,
  intensity = 28,
  padding = 16,
  radius = 20,
}: {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: number;
  padding?: number;
  radius?: number;
}) {
  const colors = useColors();
  const scheme = useColorScheme() ?? "light";

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.glassBorder,
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={scheme === "dark" ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
        // Android blur can be expensive; the translucent fill below still reads as glass.
        experimentalBlurMethod={
          Platform.OS === "android" ? "dimezisBlurView" : undefined
        }
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]}
      />
      {/* Liquid-glass top highlight: light catching the upper edge. */}
      <LinearGradient
        colors={
          scheme === "dark"
            ? ["rgba(255,255,255,0.09)", "rgba(255,255,255,0.0)"]
            : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0.0)"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(28, radius * 1.6),
        }}
        pointerEvents="none"
      />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}
