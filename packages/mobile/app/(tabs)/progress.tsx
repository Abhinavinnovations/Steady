import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useStats } from "@/queries/steady";
import { useBadges } from "@/queries/leaderboard";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { TAB_BAR_CLEARANCE } from "./_layout";

type Range = "week" | "month" | "year";

const DOT = 12;

const BADGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "first-day": "checkmark-circle",
  "streak-7": "flame",
  "streak-30": "calendar",
  "streak-100": "flash",
  century: "medal",
  "perfect-month": "star",
};

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 14,
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 20 }}>
        {value}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

export default function ProgressScreen() {
  const colors = useColors();
  const [range, setRange] = useState<Range>("week");
  const stats = useStats(range);
  const badges = useBadges();
  const d = stats.data;

  const statusColor = (s: string) =>
    s === "complete"
      ? colors.success
      : s === "missed"
        ? colors.destructive
        : s === "pending"
          ? colors.primary
          : colors.border;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <GradientBackdrop />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={stats.isRefetching}
            onRefresh={() => stats.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 24 }}>
          Progress
        </Text>

        {/* Range toggle */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 16,
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 4,
          }}
        >
          {(["week", "month", "year"] as Range[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 9,
                alignItems: "center",
                backgroundColor: range === r ? colors.primary : "transparent",
              }}
            >
              <Text
                style={{
                  color: range === r ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: Fonts?.medium,
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {r}
              </Text>
            </Pressable>
          ))}
        </View>

        {stats.isLoading || !d ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Stat cards */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <StatCard
                label="Active streak"
                value={`${d.streak}d`}
                icon="flame"
                color={colors.streak}
              />
              <StatCard
                label="Best streak"
                value={`${d.bestStreak}d`}
                icon="trophy-outline"
                color={colors.primary}
              />
              <StatCard
                label="Consistency"
                value={`${d.consistency}%`}
                icon="pulse-outline"
                color={colors.success}
              />
            </View>

            {/* Day grid */}
            <Text
              style={{
                marginTop: 28,
                marginBottom: 12,
                color: colors.mutedForeground,
                fontFamily: Fonts?.semibold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              {range === "week" ? "Last 7 days" : range === "month" ? "This month" : "Last 12 months"}
            </Text>
            <GlassCard padding={16} radius={16}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {d.days.map((day) => (
                  <View
                    key={day.date}
                    style={{
                      width: range === "week" ? 34 : DOT,
                      height: range === "week" ? 34 : DOT,
                      borderRadius: range === "week" ? 10 : 4,
                      backgroundColor:
                        day.status === "rest" ? colors.secondary : statusColor(day.status),
                      opacity: day.status === "rest" ? 0.6 : 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {range === "week" ? (
                      <Text
                        style={{
                          color:
                            day.status === "rest"
                              ? colors.mutedForeground
                              : "#FFFFFF",
                          fontFamily: Fonts?.semibold,
                          fontSize: 12,
                        }}
                      >
                        {Number(day.date.slice(8))}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 14, marginTop: 14 }}>
                {[
                  ["Done", colors.success],
                  ["Missed", colors.destructive],
                  ["Today", colors.primary],
                  ["Rest", colors.secondary],
                ].map(([label, c]) => (
                  <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: c }} />
                    <Text style={{ color: colors.mutedForeground, fontFamily: Fonts?.sans, fontSize: 11 }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>

            {/* Badges */}
            <Text
              style={{
                marginTop: 28,
                marginBottom: 12,
                color: colors.mutedForeground,
                fontFamily: Fonts?.semibold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Badges
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {(badges.data ?? []).map((b) => (
                <View
                  key={b.code}
                  style={{
                    width: "48%",
                    flexGrow: 1,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: b.earned ? colors.primary : colors.border,
                    borderRadius: 16,
                    padding: 14,
                    gap: 6,
                    opacity: b.earned ? 1 : 0.45,
                  }}
                >
                  <Ionicons
                    name={BADGE_ICONS[b.code] ?? "ribbon-outline"}
                    size={18}
                    color={b.earned ? colors.streak : colors.mutedForeground}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: Fonts?.semibold,
                      fontSize: 13,
                    }}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: Fonts?.sans,
                      fontSize: 11,
                      lineHeight: 15,
                    }}
                  >
                    {b.earned && b.earnedAt
                      ? `Earned ${new Date(b.earnedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}`
                      : b.description}
                  </Text>
                </View>
              ))}
            </View>

            {/* Notes journal */}
            <Text
              style={{
                marginTop: 28,
                marginBottom: 12,
                color: colors.mutedForeground,
                fontFamily: Fonts?.semibold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Journal
            </Text>
            {d.notes.length === 0 ? (
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 13,
                  textAlign: "center",
                  paddingVertical: 20,
                }}
              >
                Your completion notes will show up here.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {d.notes.map((n, i) => (
                  <View
                    key={`${n.date}-${i}`}
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      padding: 14,
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row" }}>
                      <Text
                        style={{
                          flex: 1,
                          color: colors.foreground,
                          fontFamily: Fonts?.semibold,
                          fontSize: 13,
                        }}
                      >
                        {n.task}
                      </Text>
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: Fonts?.sans,
                          fontSize: 11,
                        }}
                      >
                        {new Date(`${n.date}T12:00:00`).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 13,
                        lineHeight: 19,
                      }}
                    >
                      {n.note}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
