import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import type { Tabs } from "expo-router";
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNavigationEffects } from "@/hooks/use-navigation-effects";

export function tabMetrics(bottom: number, fontScale: number) {
  const offset = Math.max(bottom, 12);
  const height = 76 + Math.max(0, fontScale - 1) * 54;
  return { offset, height, clearance: offset + height + 28 };
}
export function useTabClearance() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return tabMetrics(bottom, fontScale).clearance;
}

/** Navigator owns selection. Layered Android glass, with optional iOS blur only. */
export function PaperTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const c = useColors(); const dark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { offset, height } = tabMetrics(insets.bottom, fontScale);
  const { reducedMotion, reducedTransparency } = useNavigationEffects();
  const [keyboard, setKeyboard] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const selectedKey = state.routes[state.index].key;
  const selectedLayout = layouts[selectedKey];
  const lensX = useRef(new Animated.Value(0)).current;
  const positioned = useRef(false);
  useEffect(() => {
    if (!selectedLayout) return;
    lensX.stopAnimation();
    if (!positioned.current || reducedMotion) {
      lensX.setValue(selectedLayout.x + 2); positioned.current = true;
      return;
    }
    const animation = Animated.timing(lensX, { toValue: selectedLayout.x + 2, duration: 360, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [lensX, selectedLayout, reducedMotion]);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  const active = dark ? c.primary : "#954F3B";
  return <View pointerEvents="box-none" style={{ position: "absolute", left: Math.max(10, insets.left), right: Math.max(10, insets.right), bottom: offset, alignItems: "center" }}>
    <View style={{ width: "100%", maxWidth: 620, borderRadius: 25, borderWidth: 1, borderColor: dark ? "rgba(231,241,225,0.28)" : "#FFFFFF", backgroundColor: reducedTransparency ? c.cardElevated : dark ? "rgba(34,41,44,0.94)" : "rgba(246,248,241,0.94)", padding: 5, overflow: "hidden", boxShadow: dark ? "0px 8px 28px rgba(0,0,0,0.28)" : "0px 8px 28px rgba(46,57,41,0.16)" }}>
      {!reducedTransparency && <>
        {Platform.OS === "ios" && <BlurView pointerEvents="none" tint={dark ? "dark" : "light"} intensity={28} style={StyleSheet.absoluteFill} />}
        <LinearGradient pointerEvents="none" colors={dark ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0)", "rgba(159,187,148,0.09)"] : ["rgba(255,255,255,0.98)", "rgba(255,255,255,0.24)", "rgba(167,190,151,0.18)"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={{ position: "absolute", top: 1, left: 24, right: 24, height: 1, backgroundColor: dark ? "rgba(255,255,255,0.2)" : "#FFFFFF" }} />
      </>}
      <View accessibilityRole="tablist" accessibilityLabel="Main navigation" style={{ flexDirection: "row", minHeight: height - 12 }}>
        {selectedLayout && <Animated.View testID="navigation-active-lens" pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: selectedLayout.width - 4, transform: [{ translateX: lensX }], borderRadius: 19, overflow: "hidden", borderWidth: 1, borderColor: dark ? "rgba(223,235,211,0.3)" : "rgba(255,255,255,1)", backgroundColor: reducedTransparency ? c.accent : dark ? "rgba(192,211,183,0.13)" : "rgba(223,232,215,0.7)" }}>
          {!reducedTransparency && <LinearGradient colors={dark ? ["rgba(255,255,255,0.12)", "rgba(203,226,189,0.03)", "rgba(255,255,255,0.03)"] : ["rgba(255,255,255,0.98)", "rgba(255,255,255,0.24)", "rgba(183,201,171,0.17)"]} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} />}
        </Animated.View>}
        {state.routes.filter(route => route.name !== "explore").map(route => {
          const options = descriptors[route.key].options;
          const selected = selectedKey === route.key;
          const title = options.title ?? route.name;
          const color = selected ? active : c.mutedForeground;
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel ?? title} accessibilityState={{ selected }} aria-selected={selected}
            onLayout={({ nativeEvent: { layout } }) => setLayouts(old => old[route.key]?.x === layout.x && old[route.key]?.width === layout.width ? old : { ...old, [route.key]: { x: layout.x, width: layout.width } })}
            onFocus={event => {
              const target = event.currentTarget as unknown as { matches?: (selector: string) => boolean };
              if (Platform.OS !== "web" || target.matches?.(":focus-visible")) setFocus(route.key);
            }} onBlur={() => setFocus(null)}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: height - 12, paddingHorizontal: 2, paddingTop: 8, paddingBottom: 12, borderRadius: 19, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 2, borderColor: focus === route.key ? active : "transparent", opacity: pressed ? 0.7 : 1 })}>
            <View aria-hidden importantForAccessibility="no-hide-descendants">{options.tabBarIcon?.({ focused: selected, color, size: 21 })}</View>
            <Text style={{ width: "100%", color, fontFamily: selected ? Fonts.semibold : Fonts.medium, fontSize: 10, lineHeight: 13, textAlign: "center" }}>{title}</Text>
            {selected && <View pointerEvents="none" style={{ position: "absolute", bottom: 4, width: 3, height: 3, borderRadius: 2, backgroundColor: active }} />}
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
}
