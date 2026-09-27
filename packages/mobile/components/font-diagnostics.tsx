import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { getLoadedFonts } from "expo-font";
import Svg, { Path } from "react-native-svg";
import { appFontNames } from "@/constants/font-assets";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { PaperModal } from "./paper-modal";
import { fontReferences } from "./font-reference-paths";
import { SteadyIcon } from "./steady-icon";

/** Local-only diagnostics. Never reads or sends account, task or session information. */
export function FontDiagnostics({ errorCode }: { errorCode?: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [registered, setRegistered] = useState<string[]>([]);
  const [registryError, setRegistryError] = useState(false);
  const system = Platform.OS === "ios" ? "System" : Platform.OS === "web" ? "system-ui" : "sans-serif";
  const body = { fontFamily: system, fontSize: 13, lineHeight: 20, color: c.foreground };
  function refresh() {
    try { setRegistered(getLoadedFonts()); setRegistryError(false); }
    catch { setRegistered([]); setRegistryError(true); }
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Display diagnostics" onPress={() => { refresh(); setOpen(true); }} style={{ minHeight: 44, paddingVertical: 12, justifyContent: "center" }}>
      <Text style={{ ...body, color: c.primary }}>Display diagnostics</Text>
    </Pressable>
    <PaperModal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ paddingHorizontal: 24, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text accessibilityRole="header" style={{ ...body, fontSize: 20, flex: 1 }}>Display diagnostics</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close display diagnostics" onPress={() => setOpen(false)} style={{ minWidth: 52, minHeight: 44, justifyContent: "center" }}><Text style={{ ...body, color: c.primary }}>Done</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 18, width: "100%", maxWidth: 700, alignSelf: "center" }}>
          <Text selectable style={body}>STEADY DISPLAY / 2026-09-27-r2{"\n"}{Platform.OS} {String(Platform.Version)} · Expo Go {Constants.expoVersion ?? "not detected"}{"\n"}SDK {Constants.expoConfig?.sdkVersion ?? "54"} · {Constants.executionEnvironment}{"\n"}JS window: {typeof window === "undefined" ? "absent" : "present"}</Text>
          {errorCode && <Text selectable accessibilityLiveRegion="polite" style={{ ...body, color: c.destructive }}>Startup: {errorCode}</Text>}
          <Text style={body}>This check stays on your device. The outline references below bypass fonts entirely. Compare their letter shapes with the live text. A registered font is not proof that Android is displaying it correctly.</Text>
          <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 16, gap: 4 }}>
            <Text style={body}>Font registry: {registryError ? "unavailable" : `${appFontNames.filter(n => registered.includes(n)).length}/${appFontNames.length} registered`}</Text>
            {appFontNames.map(name => <Text selectable key={name} style={body}>{name}: {registryError ? "unknown" : registered.includes(name) ? "registered" : "MISSING"}</Text>)}
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh font diagnostics" onPress={refresh} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...body, color: c.primary }}>Refresh status</Text></Pressable>
          </View>
          {(["display", "sans"] as const).map(key => {
            const ref = fontReferences[key];
            const size = key === "display" ? 38 : 24;
            return <View key={key} style={{ gap: 8, borderBottomWidth: 1, borderColor: c.border, paddingBottom: 18 }}>
              <Text style={body}>{key === "display" ? "Libre Caslon Display" : "DM Sans Regular"}</Text>
              <Text style={{ ...body, color: c.mutedForeground }}>Expected letter shapes (SVG)</Text>
              <Svg accessible accessibilityRole="image" accessibilityLabel={`Expected ${key} font: ${ref.text}`} width={ref.width / ref.em * size} height={ref.height / ref.em * size} viewBox={`0 0 ${ref.width} ${ref.height}`}><Path d={ref.path} fill={c.foreground}/></Svg>
              <Text style={{ ...body, color: c.mutedForeground }}>Actual app text</Text>
              <Text accessibilityLabel={`Actual ${key} font: ${ref.text}`} style={{ color: c.foreground, fontFamily: key === "display" ? Fonts.display : Fonts.sans, fontSize: size, fontWeight: "normal", fontStyle: "normal" }}>{ref.text}</Text>
            </View>;
          })}
          <View style={{ gap: 8 }}>
            <Text style={body}>DM Sans weights (actual text)</Text>
            {(["medium", "semibold", "bold"] as const).map(weight => <Text key={weight} style={{ color: c.foreground, fontFamily: Fonts[weight], fontSize: 18 }}>{weight}: Small steps. 0123</Text>)}
          </View>
          <Text style={body}>Icons below are SVG, independent of the font registry.</Text>
          <View accessible accessibilityRole="image" accessibilityLabel="SVG flame, leaf, people, checkmark and checkbox samples" style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}>{(["flame", "leaf-outline", "people-outline", "checkmark-circle", "checkbox-outline"] as const).map(name => <SteadyIcon key={name} name={name} size={28} color={c.primary}/>)}</View>
          <Text style={body}>If the live text differs from the reference, send screenshots of this sheet, including the registry and comparisons. Do not clear Expo Go storage or reinstall to test this update.</Text>
        </ScrollView>
      </SafeAreaView>
    </PaperModal>
  </>;
}
