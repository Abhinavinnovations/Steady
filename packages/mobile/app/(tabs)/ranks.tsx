import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useProfile, useUpdateProfile } from "@/queries/steady";
import {
  useLeaderboard,
  type LeaderboardBucket,
  type LeaderboardMode,
  type LeaderboardRange,
} from "@/queries/leaderboard";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { TAB_BAR_CLEARANCE } from "./_layout";

const RANGES: LeaderboardRange[] = ["week", "month", "year"];
const BUCKETS: { value: LeaderboardBucket; label: string }[] = [
  { value: 1, label: "1 task" },
  { value: 2, label: "2 tasks" },
  { value: 3, label: "3+ tasks" },
];

export default function RanksScreen() {
  const colors = useColors();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();

  const myMode = (profile.data?.mode ?? "basic") as LeaderboardMode;
  const [mode, setMode] = useState<LeaderboardMode | null>(null);
  const [range, setRange] = useState<LeaderboardRange>("week");
  const [bucket, setBucket] = useState<LeaderboardBucket | null>(null);

  const activeMode = mode ?? myMode;
  const board = useLeaderboard({
    mode: activeMode,
    range,
    ...(bucket ? { bucket } : {}),
  });
  const d = board.data;
  const activeBucket = bucket ?? d?.bucket ?? 1;
  const optedOut = profile.data?.leaderboardOptOut ?? false;

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
            refreshing={board.isRefetching}
            onRefresh={() => board.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 24 }}>
          Ranks
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.mutedForeground,
            fontFamily: Fonts?.sans,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          Boards are split by mode and task count, so it&apos;s fair. Score is
          full days — every task done.
        </Text>

        {/* Mode toggle */}
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
          {(["basic", "challenge"] as LeaderboardMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 9,
                alignItems: "center",
                backgroundColor: activeMode === m ? colors.primary : "transparent",
              }}
            >
              <Text
                style={{
                  color:
                    activeMode === m ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: Fonts?.medium,
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Range toggle */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 10,
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 4,
          }}
        >
          {RANGES.map((r) => (
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

        {/* Bucket chips */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {BUCKETS.map((b) => {
            const active = activeBucket === b.value;
            return (
              <Pressable
                key={b.value}
                onPress={() => setBucket(b.value)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : colors.card,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.mutedForeground,
                    fontFamily: Fonts?.medium,
                    fontSize: 12,
                  }}
                >
                  {b.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Board */}
        <View style={{ marginTop: 20 }}>
          {board.isLoading ? (
            <View style={{ paddingVertical: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !d || d.entries.length === 0 ? (
            <GlassCard padding={24} radius={16}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 19,
                }}
              >
                Nobody on this board yet. Keep showing up — the board fills in
                as people commit.
              </Text>
            </GlassCard>
          ) : (
            <GlassCard padding={8} radius={16}>
              {d.entries.map((e, i) => (
                <View
                  key={`${e.rank}-${e.displayName}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: e.isMe ? colors.primarySoft : "transparent",
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      width: 28,
                      color: e.rank <= 3 ? colors.primary : colors.mutedForeground,
                      fontFamily: Fonts?.semibold,
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {e.rank}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: e.isMe ? Fonts?.semibold : Fonts?.medium,
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {e.displayName}
                      {e.isMe ? "  (you)" : ""}
                    </Text>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.sans,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {e.taskCount} {e.taskCount === 1 ? "task" : "tasks"} this month
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: Fonts?.semibold,
                        fontSize: 15,
                      }}
                    >
                      {e.score}
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: Fonts?.sans,
                          fontSize: 11,
                        }}
                      >
                        {"  full days"}
                      </Text>
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="flame" size={11} color={colors.streak} />
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: Fonts?.sans,
                          fontSize: 11,
                        }}
                      >
                        {e.streak}d
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </GlassCard>
          )}
          {d?.optedOut ? (
            <Text
              style={{
                marginTop: 10,
                color: colors.mutedForeground,
                fontFamily: Fonts?.sans,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              You&apos;re hidden from all boards right now.
            </Text>
          ) : null}
        </View>

        {/* Privacy */}
        <View style={{ marginTop: 24 }}>
          <GlassCard padding={16} radius={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Fonts?.medium,
                    fontSize: 14,
                  }}
                >
                  Appear on leaderboards
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  Boards only ever show your name and numbers — never your
                  tasks or notes.
                </Text>
              </View>
              <Switch
                value={!optedOut}
                disabled={updateProfile.isPending}
                onValueChange={(value) =>
                  updateProfile.mutate({ leaderboardOptOut: !value })
                }
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
