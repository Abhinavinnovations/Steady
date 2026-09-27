// System-managed layout — extend in place, never rewrite from scratch.
// Keep the provider chain intact: ErrorBoundary → OneDollarStats → SafeArea → QueryClient.
// To switch navigation, replace only the <Slot /> line with <Stack /> or <Tabs />.
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Pressable, Platform } from "react-native";
import { loadAsync, getLoadedFonts } from "expo-font";
import { appFonts, appFontNames } from "../constants/font-assets";
import { Colors } from "../constants/theme";
import { useSegments } from "expo-router";
import { verifyFontReadiness, safeFontError } from "../lib/font-readiness";
import { useColors } from "../hooks/use-colors";
import { AuthGate, ThemedStatusBar } from "../components/app-gate";
import { ThemeModeProvider } from "../lib/theme-context";
import { authClient } from "../lib/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/__ErrorBoundary";
import { OneDollarStatsProvider } from "../lib/__analytics";
import { isWeb, startWebSafeArea } from "../lib/__web-safe-area";
import appJson from "../app.json";

const queryClient = new QueryClient();

const applicationId = appJson.expo.extra.applicationId ?? "";
const hostname = applicationId ? `${applicationId}-mobile` : "localhost";

function FontGate() {
  const themeColors = useColors();
  const segments = useSegments();
  const colors = segments[0] === "timer" ? Colors.dark : themeColors;
  const [fontsReady, setFontsReady] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    // A successful hook/cache result alone cannot verify the native registry.
    void verifyFontReadiness(() => loadAsync(appFonts), getLoadedFonts, appFontNames)
      .then(() => { if (active) setFontsReady(true); })
      .catch(error => { if (active) setFontError(safeFontError(error)); });
    return () => { active = false; };
  }, [attempt]);
  if (fontError) return <View style={{ flex: 1, padding: 24, gap: 16, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
    <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground, fontFamily: Platform.OS === "ios" ? "System" : "sans-serif", textAlign: "center" }}>Steady could not confirm its fonts. Check your connection and retry. Your saved data is unchanged.</Text>
    <Text selectable style={{ color: colors.mutedForeground, fontFamily: "monospace" }}>{fontError}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Retry loading fonts" onPress={() => { setFontError(null); setFontsReady(false); setAttempt(value => value + 1); }} style={{ minHeight: 44, padding: 12 }}><Text style={{ color: colors.primary, fontFamily: Platform.OS === "ios" ? "System" : "sans-serif" }}>Retry</Text></Pressable>
  </View>;
  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}><ActivityIndicator accessibilityLabel="Loading Steady" color={colors.primary} /></View>;
  return <AuthGate />;
}

export default function RootLayout() {
  useEffect(() => {
    if (isWeb) startWebSafeArea();
    void authClient.managedAuth.handleRedirect();
  }, []);

  return (
    <ErrorBoundary>
      {/* Runable analytics provider — do not remove, required for analytics tracking */}
      <OneDollarStatsProvider
        config={{
          hostname,
          collectorUrl: "https://r.lilstts.com/events",
          devmode: true,
        }}
      >
        <SafeAreaProvider>
          <ThemeModeProvider>
            <QueryClientProvider client={queryClient}>
              <ThemedStatusBar />
              <FontGate />
            </QueryClientProvider>
          </ThemeModeProvider>
        </SafeAreaProvider>
      </OneDollarStatsProvider>
    </ErrorBoundary>
  );
}
