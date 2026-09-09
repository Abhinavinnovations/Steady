import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Soft "shader gradient" backdrop — the liquid-glass base layer.
 * Layered pastel blobs drifting very slowly under every screen.
 * Low saturation on purpose: calm, no pressure on the eyes.
 */

function Blob({
  colors,
  size,
  style,
  duration,
  travel,
}: {
  colors: readonly [string, string];
  size: number;
  style: object;
  duration: number;
  travel: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -travel * 0.6],
  });

  return (
    <Animated.View
      style={[
        { position: "absolute", transform: [{ translateX }, { translateY }] },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    </Animated.View>
  );
}

export function GradientBackdrop() {
  const scheme = useColorScheme() ?? "light";
  const dark = scheme === "dark";

  const base: readonly [string, string, string] = dark
    ? ["#101018", "#12121D", "#101018"]
    : ["#F2F2F7", "#EFEFF7", "#F3F1F4"];

  // Same hues both modes; alpha carries the difference. Never loud.
  const lavender: readonly [string, string] = dark
    ? ["rgba(139,133,214,0.16)", "rgba(139,133,214,0.02)"]
    : ["rgba(185,179,230,0.55)", "rgba(185,179,230,0.05)"];
  const periwinkle: readonly [string, string] = dark
    ? ["rgba(168,195,230,0.12)", "rgba(168,195,230,0.02)"]
    : ["rgba(168,195,230,0.45)", "rgba(168,195,230,0.04)"];
  const peach: readonly [string, string] = dark
    ? ["rgba(230,201,179,0.10)", "rgba(230,201,179,0.02)"]
    : ["rgba(230,201,179,0.40)", "rgba(230,201,179,0.04)"];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={base}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Blob
        colors={lavender}
        size={420}
        style={{ top: -120, left: -100 }}
        duration={9000}
        travel={40}
      />
      <Blob
        colors={periwinkle}
        size={360}
        style={{ top: "34%", right: -140 }}
        duration={12000}
        travel={-34}
      />
      <Blob
        colors={peach}
        size={380}
        style={{ bottom: -140, left: -60 }}
        duration={11000}
        travel={30}
      />
    </View>
  );
}
