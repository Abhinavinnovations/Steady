import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

/** Static decorative texture: no interaction, no animation or expensive blur. */
export function PaperBackdrop() {
  const colors = useColors();
  const dark = useColorScheme() === "dark";
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 350, overflow: "hidden" }}>
      <Image source={require("../assets/paper/reference-paper.webp")} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: dark ? 0.045 : 0.45 }]} />
      <LinearGradient colors={dark ? ["#10131600", "#10131666", "#101316"] : ["#FAF9F500", "#FAF9F590", "#FAF9F5"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </View>
  </View>;
}
