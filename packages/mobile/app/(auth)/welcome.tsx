import { useMemo } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { SteadyButton } from "@/components/steady-button";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";

const QUOTES: { text: string; by: string }[] = [
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", by: "Will Durant" },
  { text: "Small disciplines repeated with consistency lead to great achievements.", by: "John Maxwell" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", by: "James Clear" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
  { text: "It's not what we do once in a while that shapes our lives, but what we do consistently.", by: "Tony Robbins" },
  { text: "The secret of your future is hidden in your daily routine.", by: "Mike Murdock" },
  { text: "Motivation gets you going. Habit keeps you going.", by: "Jim Ryun" },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();

  // Quote of the day — stable for the whole day, rotates daily.
  const quote = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    return QUOTES[dayIndex % QUOTES.length];
  }, []);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <GradientBackdrop />
      <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "space-between" }}>
        <View style={{ paddingTop: 24 }}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: Fonts?.semibold,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Steady
          </Text>
        </View>

        <GlassCard padding={24} radius={24}>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: Fonts?.light,
              fontSize: 26,
              lineHeight: 40,
            }}
          >
            “{quote.text}”
          </Text>
          <Text
            style={{
              marginTop: 20,
              color: colors.mutedForeground,
              fontFamily: Fonts?.medium,
              fontSize: 14,
            }}
          >
            — {quote.by}
          </Text>
        </GlassCard>

        <View style={{ paddingBottom: 24, gap: 12 }}>
          <SteadyButton title="Begin" onPress={() => router.push("/(auth)/sign-in")} />
          <Text
            style={{
              textAlign: "center",
              color: colors.mutedForeground,
              fontFamily: Fonts?.sans,
              fontSize: 12,
            }}
          >
            Consistency, without the guilt.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
