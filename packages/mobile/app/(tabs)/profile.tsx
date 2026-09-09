import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
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
import { useThemeMode, type ThemeMode } from "@/lib/theme-context";
import { authClient, clearToken } from "@/lib/auth";
import { AccountabilitySetup } from "@/components/accountability-setup";
import { useCurrentTasks, useProfile } from "@/queries/steady";
import { usePartner } from "@/queries/partners";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { TAB_BAR_CLEARANCE } from "./_layout";

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
      <Text style={{ color: colors.foreground, fontFamily: Fonts?.medium, fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
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
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: TAB_BAR_CLEARANCE }}
      >
        <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 24 }}>
          Profile
        </Text>

        {profile.isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : p ? (
          <>
            {/* Identity card */}
            <GlassCard style={{ marginTop: 20 }} padding={20} radius={20}>
              <View style={{ alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: colors.primary, fontFamily: Fonts?.semibold, fontSize: 24 }}>
                  {(p.displayName || "?").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 18 }}>
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
            <GlassCard style={{ marginTop: 16 }} padding={0} radius={16}>
              <View style={{ paddingHorizontal: 16 }}>
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
                  value={current.data?.confirmed ? "Yes" : "Not yet"}
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
                color: colors.mutedForeground,
                fontFamily: Fonts?.semibold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Appearance
            </Text>
            <GlassCard padding={6} radius={16}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(
                  [
                    { key: "light", label: "Light", icon: "sunny-outline" },
                    { key: "dark", label: "Dark", icon: "moon-outline" },
                    { key: "system", label: "Auto", icon: "contrast-outline" },
                  ] as { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[]
                ).map((opt) => {
                  const active = themeMode === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setThemeMode(opt.key)}
                      style={({ pressed }) => ({
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        paddingVertical: 10,
                        borderRadius: 11,
                        backgroundColor: active ? colors.primarySoft : "transparent",
                        borderWidth: 1,
                        borderColor: active ? colors.primary : "transparent",
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={15}
                        color={active ? colors.primary : colors.mutedForeground}
                      />
                      <Text
                        style={{
                          color: active ? colors.primary : colors.mutedForeground,
                          fontFamily: active ? Fonts?.semibold : Fonts?.medium,
                          fontSize: 13,
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>

            {/* Accountability contact (challenge mode) */}
            {p.mode === "challenge" ? (
              <>
                <Text
                  style={{
                    marginTop: 24,
                    marginBottom: 10,
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                  }}
                >
                  Accountability contact
                </Text>
                <GlassCard padding={16} radius={16}>
                  <AccountabilitySetup showRemove />
                </GlassCard>
              </>
            ) : null}

            <Pressable
              onPress={signOut}
              style={({ pressed }) => ({
                marginTop: 24,
                height: 52,
                borderRadius: 14,
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
    </SafeAreaView>
  );
}
