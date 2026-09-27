import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ReminderSync } from "@/queries/reminders";
import { clearSteadyReminders } from "@/lib/reminders";
import { setVoiceOwner } from "@/lib/voice-save-journal";
import { Slot, useRouter, useSegments } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { authClient } from "@/lib/auth";
import { useThemeMode } from "@/lib/theme-context";
import { useColors } from "@/hooks/use-colors";
import { Colors } from "@/constants/theme";

export function ThemedStatusBar() {
  const { scheme } = useThemeMode();
  const segments = useSegments();
  return <StatusBar style={segments[0] === "timer" || scheme === "dark" ? "light" : "dark"} />;
}
export function AuthGate() {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();
  const themeColors = useColors();
  const colors = segments[0] === "timer" ? Colors.dark : themeColors;
  const qc = useQueryClient();
  const [readyUser, setReadyUser] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (isPending) return;
    const id = session?.user.id ?? null;
    if (readyUser !== id) { setVoiceOwner(id); qc.clear(); void clearSteadyReminders(readyUser === undefined && id ? id : undefined); setReadyUser(id); }
  }, [session?.user.id, isPending, qc, readyUser]);
  useEffect(() => {
    if (isPending) return;
    const inAuth = segments[0] === "(auth)";
    if (!session && !inAuth && segments[0] !== "auth") router.replace("/(auth)/welcome");
    if (session && inAuth) router.replace("/");
  }, [session, isPending, segments, router]);
  if (isPending || readyUser !== (session?.user.id ?? null)) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;
  return <>{session && <ReminderSync key={session.user.id} />}<Slot /></>;
}
