import { useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  Platform,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Watch-style duration picker: a snapping wheel that ticks (sound + haptic)
 * on every detent, like setting a real kitchen timer.
 * First option is "No timer" — time is optional.
 */

export const DURATION_STEPS: (number | null)[] = [
  null,
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120, 150, 180, 240, 300, 360, 480,
];

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

const ITEM_H = 42;
const VISIBLE = 3;
const tickSource = require("../assets/sounds/tick.mp3");

export function DurationWheel({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
}) {
  const colors = useColors();
  const scheme = useColorScheme();
  const listRef = useRef<FlatList<number | null>>(null);
  const indexRef = useRef(Math.max(0, DURATION_STEPS.indexOf(value)));
  const player = useAudioPlayer(tickSource);

  useEffect(() => {
    // Keep the wheel in sync when the value is reset from outside.
    const idx = Math.max(0, DURATION_STEPS.indexOf(value));
    if (idx !== indexRef.current) {
      indexRef.current = idx;
      listRef.current?.scrollToOffset({
        offset: idx * ITEM_H,
        animated: false,
      });
    }
  }, [value]);

  const tick = useCallback(() => {
    try {
      if (Platform.OS !== "web") void Haptics.selectionAsync();
    } catch {
      // haptics unavailable — fine
    }
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // audio unavailable (e.g. web autoplay policy) — the haptic carries it
    }
  }, [player]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.min(
        DURATION_STEPS.length - 1,
        Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)),
      );
      if (idx !== indexRef.current) {
        indexRef.current = idx;
        tick();
        onChange(DURATION_STEPS[idx] ?? null);
      }
    },
    [onChange, tick],
  );

  const fadeColor = scheme === "dark" ? "rgba(16,16,24," : "rgba(242,242,247,";

  return (
    <View
      style={{
        height: ITEM_H * VISIBLE,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      {/* Center detent band */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_H,
          left: 8,
          right: 8,
          height: ITEM_H,
          borderRadius: 10,
          backgroundColor: colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.primary,
          zIndex: 1,
        }}
      />
      <FlatList
        ref={listRef}
        data={DURATION_STEPS}
        keyExtractor={(item) => String(item ?? "none")}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        initialScrollIndex={indexRef.current}
        getItemLayout={(_, index) => ({
          length: ITEM_H,
          offset: ITEM_H * index,
          index,
        })}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        renderItem={({ item }) => (
          <View
            style={{
              height: ITEM_H,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color:
                  item === value ? colors.foreground : colors.mutedForeground,
                fontFamily: item === value ? Fonts?.semibold : Fonts?.sans,
                fontSize: 15,
              }}
            >
              {item === null ? "No timer" : formatDuration(item)}
            </Text>
          </View>
        )}
      />
      {/* Top/bottom fades */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${fadeColor}0.9)`, `${fadeColor}0)`]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * 0.9, zIndex: 2 }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${fadeColor}0)`, `${fadeColor}0.9)`]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H * 0.9, zIndex: 2 }}
      />
    </View>
  );
}
