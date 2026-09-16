import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useThemeMode } from "@/lib/theme-context";
import { GlassSegmentedControl } from "@/components/glass-segmented-control";
import { authClient, clearToken } from "@/lib/auth";
import { PartnerSection } from "@/components/partner-section";
import { useCurrentTasks, useProfile } from "@/queries/steady";
import { usePartner } from "@/queries/partners";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { useTabClearance } from "@/components/paper-tab-bar";
import { PaperHeading } from "@/components/paper-heading";

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.mutedForeground} />
      <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 14 }}>
        {label}
      </Text>
      <Text style={{ maxWidth: "55%", textAlign: "right", color: colors.foreground, fontFamily: Fonts?.medium, fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const tabClearance = useTabClearance();
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useProfile();
  const current = useCurrentTasks();
  const partner = usePartner();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

  async function signOut() {
    await authClient.signOut();
    await clearToken();
    qc.clear();
    router.replace("/(auth)/welcome");
  }

  const p = profile.data;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <GradientBackdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, paddingBottom: tabClearance, width: "100%", maxWidth: 700, alignSelf: "center" }}
      >
        <PaperHeading title="Profile" />

        {profile.isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : p ? (
          <>
            {/* Identity card */}
            <GlassCard style={{ marginTop: 28, borderWidth: 0, backgroundColor: "transparent" }} padding={0} radius={0}>
              <View style={{ alignItems: "flex-start", gap: 6 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: colors.primary, fontFamily: Fonts?.semibold, fontSize: 24 }}>
                  {(p.displayName || "?").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontFamily: Fonts.display, fontSize: 36 }}>
                {p.displayName}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 13 }}>
                {p.email}
              </Text>
              <View
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: colors.primarySoft,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                }}
              >
                <Ionicons
                  name={p.mode === "challenge" ? "people" : "leaf"}
                  size={13}
                  color={colors.primary}
                />
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: Fonts?.semibold,
                    fontSize: 12,
                    textTransform: "capitalize",
                  }}
                >
                  {p.mode} mode
                </Text>
              </View>
              </View>
            </GlassCard>

            {/* Details */}
            <GlassCard style={{ marginTop: 24, borderWidth: 0, borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: "transparent" }} padding={0} radius={0}>
              <View>
                <Row icon="globe-outline" label="Timezone" value={p.timezone} />
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Row
                  icon="list-outline"
                  label="Tasks this month"
                  value={`${current.data?.tasks.length ?? "—"}`}
                />
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Row
                  icon="lock-closed-outline"
                  label="Month locked"
                  value={current.data ? (current.data.confirmed ? "Yes" : "Not yet") : "—"}
                />
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <Row
                  icon={
                    partner.data?.emailVerified
                      ? "shield-checkmark-outline"
                      : "shield-outline"
                  }
                  label="Email verified"
                  value={
                    partner.data ? (partner.data.emailVerified ? "Yes" : "Not yet") : "—"
                  }
                />
              </View>
            </GlassCard>

            {/* Appearance */}
            <Text
              style={{
                marginTop: 24,
                marginBottom: 10,
                color: colors.foreground,
                fontFamily: Fonts.display,
                fontSize: 27,
                lineHeight: 33,
              }}
            >
              Appearance
            </Text>
            <GlassSegmentedControl label="Appearance" value={themeMode} onChange={setThemeMode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Auto" }]}/>

            {/* Accountability contact — needed for challenge tasks */}
            <Text
              style={{
                marginTop: 24,
                marginBottom: 10,
                color: colors.foreground,
                fontFamily: Fonts.display,
                fontSize: 27,
                lineHeight: 33,
              }}
            >
              Accountability contact
            </Text>
            <PartnerSection />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={signOut}
              style={({ pressed }) => ({
                marginTop: 24,
                minHeight: 52,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontFamily: Fonts?.medium, fontSize: 15 }}>
                Sign out
              </Text>
            </Pressable>
          </>
        ) : (
          <Text
            style={{
              marginTop: 40,
              textAlign: "center",
              color: colors.mutedForeground,
              fontFamily: Fonts?.sans,
            }}
          >
            Finish onboarding to see your profile.
          </Text>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
