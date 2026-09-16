// System-managed layout — extend in place, never rewrite from scratch.
// Keep the provider chain intact: ErrorBoundary → OneDollarStats → SafeArea → QueryClient.
// To switch navigation, replace only the <Slot /> line with <Stack /> or <Tabs />.
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useFonts } from "expo-font";
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
  const colors = useColors();
  const [fontsLoaded, fontError] = useFonts({
    DMSansRegular: require("../assets/paper/DMSans-Regular.ttf"),
    DMSansMedium: require("../assets/paper/DMSans-Medium.ttf"),
    DMSansSemiBold: require("../assets/paper/DMSans-SemiBold.ttf"),
    DMSansBold: require("../assets/paper/DMSans-Bold.ttf"),
    LibreCaslonDisplay: require("../assets/paper/caslon.ttf"),
  });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}><ActivityIndicator accessibilityLabel="Loading Steady" color={colors.primary} /></View>;
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
