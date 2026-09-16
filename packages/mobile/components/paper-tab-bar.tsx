import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ComponentProps } from "react";
import type { Tabs } from "expo-router";
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { GlassSurface } from "./glass-surface";

export function tabMetrics(bottom: number, fontScale: number) {
  const offset = Math.max(bottom, 12);
  const height = 64 + Math.max(0, fontScale - 1) * 54;
  return { offset, height, clearance: offset + height + 28 };
}
export function useTabClearance() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return tabMetrics(bottom, fontScale).clearance;
}

/** Navigator-owned state/events; only the rendering changes. Android never uses live blur. */
export function PaperTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const c = useColors(); const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { offset, height } = tabMetrics(insets.bottom, fontScale);
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  return <View pointerEvents="box-none" style={{ position: "absolute", left: Math.max(10, insets.left), right: Math.max(10, insets.right), bottom: offset, alignItems: "center" }}>
    <GlassSurface blur radius={36} style={{ width: "100%", maxWidth: 600, padding: 5, boxShadow: "0px 7px 24px rgba(0,0,0,0.13)" }}>
      <View accessibilityRole="tablist" accessibilityLabel="Main navigation" style={{ flexDirection: "row", minHeight: height - 12 }}>
        {state.routes.filter(route => route.name !== "explore").map(route => {
          const options = descriptors[route.key].options;
          const selected = state.routes[state.index].key === route.key;
          const title = options.title ?? route.name;
          const color = selected ? c.accentForeground : c.mutedForeground;
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel ?? title} accessibilityState={{ selected }} aria-selected={selected}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 2, paddingVertical: 7, borderRadius: 29, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: selected ? c.accent : "transparent", borderWidth: 1, borderColor: selected ? c.glassBorder : "transparent", opacity: pressed ? 0.7 : 1 })}>
            <View aria-hidden importantForAccessibility="no-hide-descendants">{options.tabBarIcon?.({ focused: selected, color, size: 20 })}</View>
            <Text style={{ width: "100%", color, fontFamily: selected ? Fonts.semibold : Fonts.medium, fontSize: 10, lineHeight: 13, textAlign: "center" }}>{title}</Text>
          </Pressable>;
        })}
      </View>
    </GlassSurface>
  </View>;
}
