import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useToday } from "@/queries/steady";
import { useTodos, useToggleTodo } from "@/queries/todos";
import { cancelReminder, todoReminderId } from "@/lib/reminders";

/**
 * Full-screen focus timer: a task-matched backdrop, a big countdown from the
 * task's assigned duration, pause / resume / stop.
 *
 * Works for both kinds of work:
 * - Consistent tasks (`/timer/<id>`): natural finish goes back to Today with
 *   the note sheet open — the streak still demands its one line.
 * - To-dos (`/timer/<id>?type=todo`): natural finish just checks the to-do
 *   off. Casual list, no note required.
 *
 * Progress persists per item per local day: stop a 60-min task at 40:00 left
 * and reopening it later the same day resumes from 40:00. A new day (or a
 * natural finish) resets to the full duration.
 */

const IMAGES: Record<string, ReturnType<typeof require>> = {
  gym: require("../../assets/timer/gym.jpg"),
  run: require("../../assets/timer/run.jpg"),
  read: require("../../assets/timer/read.jpg"),
  meditate: require("../../assets/timer/meditate.jpg"),
  work: require("../../assets/timer/work.jpg"),
  default: require("../../assets/timer/default.jpg"),
};

const KEYWORDS: [RegExp, keyof typeof IMAGES][] = [
  [/gym|lift|weight|push.?up|pull.?up|squat|workout|train|exercise/i, "gym"],
  [/run|jog|walk|steps|sprint|cardio|cycle|bike/i, "run"],
  [/read|book|page|chapter|study|learn/i, "read"],
  [/medit|breath|yoga|journal|gratitude|pray|stretch|mindful/i, "meditate"],
  [/code|work|write|writ|build|practice|project|draw|design/i, "work"],
];

function imageForTitle(title: string) {
  for (const [re, key] of KEYWORDS) {
    if (re.test(title)) return IMAGES[key];
  }
  return IMAGES.default;
}

function fmt(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Remaining-seconds storage key, scoped to one item on one local day.
 * To-dos get a `t` marker so ids never collide with consistent tasks.
 */
const KEY_PREFIX = "steady.timer.";
function storageKey(kind: "task" | "todo", id: number, localDay: string) {
  return `${KEY_PREFIX}${kind === "todo" ? "t" : ""}${id}.${localDay}`;
}

export default function TimerScreen() {
  useKeepAwake();
  const colors = useColors();
  const router = useRouter();
  const { taskId, type } = useLocalSearchParams<{
    taskId: string;
    type?: string;
  }>();
  const isTodo = type === "todo";
  const today = useToday();
  const todos = useTodos();
  const toggleTodo = useToggleTodo();

  const item = useMemo(() => {
    if (isTodo) {
      const t = todos.data?.todos.find((x) => String(x.id) === String(taskId));
      if (!t || t.completedAt) return undefined;
      return { id: t.id, title: t.title, durationMinutes: t.durationMinutes };
    }
    const t = today.data?.tasks.find((x) => String(x.id) === String(taskId));
    if (!t) return undefined;
    return { id: t.id, title: t.title, durationMinutes: t.durationMinutes };
  }, [isTodo, todos.data, today.data, taskId]);

  const sourceReady = isTodo ? todos.isSuccess : today.isSuccess;
  const localDay =
    (isTodo ? todos.data?.today : today.data?.localDate) ?? null;
  const keyMarker = isTodo ? "t" : "";
  const storeKey =
    item && localDay ? storageKey(isTodo ? "todo" : "task", item.id, localDay) : null;

  const totalSeconds = (item?.durationMinutes ?? 0) * 60;
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const endRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const latestRef = useRef<number | null>(null);
  const lastSaveRef = useRef(0);

  /** Save (or clear) the remaining seconds for today. Fire-and-forget. */
  const persist = useCallback(
    (left: number | null) => {
      if (!storeKey || left === null) return;
      if (left > 0 && left < totalSeconds) {
        void AsyncStorage.setItem(storeKey, String(left)).catch(() => {});
      } else {
        void AsyncStorage.removeItem(storeKey).catch(() => {});
      }
    },
    [storeKey, totalSeconds],
  );

  // Arm the countdown once the item is known — resuming today's saved
  // progress when there is any.
  useEffect(() => {
    if (!item || !storeKey || remaining !== null || totalSeconds <= 0) return;
    let cancelled = false;
    void (async () => {
      let start = totalSeconds;
      try {
        const raw = await AsyncStorage.getItem(storeKey);
        const saved = raw === null ? Number.NaN : Number(raw);
        if (Number.isFinite(saved) && saved > 0 && saved < totalSeconds) {
          start = Math.round(saved);
        }
        // Drop stale keys from earlier days for this item.
        const all = await AsyncStorage.getAllKeys();
        const stale = all.filter(
          (k) =>
            k.startsWith(`${KEY_PREFIX}${keyMarker}${item.id}.`) && k !== storeKey,
        );
        if (stale.length > 0) await AsyncStorage.multiRemove(stale);
      } catch {
        // Storage unavailable — just start fresh.
      }
      if (cancelled) return;
      latestRef.current = start;
      setRemaining(start);
      endRef.current = Date.now() + start * 1000;
      if (start < totalSeconds) setResumedFrom(start);
    })();
    return () => {
      cancelled = true;
    };
  }, [item, storeKey, remaining, totalSeconds, keyMarker]);

  // Tick.
  const armed = remaining !== null;
  useEffect(() => {
    if (!armed || paused) return;
    const id = setInterval(() => {
      if (endRef.current === null) return;
      const left = Math.round((endRef.current - Date.now()) / 1000);
      const next = left > 0 ? left : 0;
      latestRef.current = next;
      setRemaining(next);
      // Checkpoint every few seconds so a killed app still resumes closely.
      const now = Date.now();
      if (next > 0 && now - lastSaveRef.current > 5000) {
        lastSaveRef.current = now;
        persist(next);
      }
    }, 250);
    return () => clearInterval(id);
  }, [armed, paused, persist]);

  // Persist whatever is left when the screen unmounts (back gesture, etc.).
  useEffect(() => {
    return () => {
      if (!finishedRef.current) persist(latestRef.current);
    };
  }, [persist]);

  // Natural finish → clear saved progress, then:
  // consistent task = back to Today with the note sheet;
  // to-do = check it off and go back. No note, no ceremony.
  useEffect(() => {
    if (remaining === 0 && !finishedRef.current) {
      finishedRef.current = true;
      if (storeKey) void AsyncStorage.removeItem(storeKey).catch(() => {});
      try {
        if (Platform.OS !== "web")
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
      } catch {
        // fine
      }
      if (isTodo && item) {
        void cancelReminder(todoReminderId(item.id));
        toggleTodo.mutate({ id: item.id, done: true });
        router.replace("/(tabs)");
      } else {
        router.replace({
          pathname: "/(tabs)",
          params: { note: String(taskId) },
        });
      }
    }
  }, [remaining, router, taskId, storeKey, isTodo, item, toggleTodo]);

  function togglePause() {
    if (remaining === null) return;
    if (paused) {
      endRef.current = Date.now() + remaining * 1000;
      setPaused(false);
    } else {
      setPaused(true);
      persist(remaining);
    }
  }

  function stop() {
    persist(latestRef.current);
    router.back();
  }

  // Item missing (already completed elsewhere / bad id / no duration) — bail out.
  useEffect(() => {
    if (finishedRef.current) return;
    if (sourceReady && (!item || !item.durationMinutes)) {
      router.replace("/(tabs)");
    }
  }, [sourceReady, item, router]);

  if (!item || totalSeconds === 0) {
    return <View style={{ flex: 1, backgroundColor: "#101018" }} />;
  }

  const elapsedRatio =
    remaining === null ? 0 : 1 - remaining / Math.max(1, totalSeconds);

  return (
    <ImageBackground
      source={imageForTitle(item.title)}
      resizeMode="cover"
      style={{ flex: 1, backgroundColor: "#101018" }}
    >
      {/* Scrim for legibility */}
      <View
        style={{
          ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
          backgroundColor: "rgba(10,10,16,0.45)",
        }}
      />
      <SafeAreaView style={{ flex: 1, padding: 24 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.72)",
                fontFamily: Fonts?.medium,
                fontSize: 13,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              {isTodo ? "To-do" : "Focus"}
            </Text>
            <Text
              style={{
                marginTop: 4,
                color: "#FFFFFF",
                fontFamily: Fonts?.semibold,
                fontSize: 22,
              }}
            >
              {item.title}
            </Text>
          </View>
        </View>

        {/* Countdown */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              color: "#FFFFFF",
              fontFamily: Fonts?.mono,
              fontSize: 72,
              fontVariant: ["tabular-nums"],
              letterSpacing: 2,
            }}
          >
            {fmt(remaining ?? totalSeconds)}
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: "rgba(255,255,255,0.65)",
              fontFamily: Fonts?.sans,
              fontSize: 14,
            }}
          >
            {paused ? "Paused" : `of ${fmt(totalSeconds)}`}
          </Text>
          {/* Thin progress line */}
          <View
            style={{
              marginTop: 22,
              width: 220,
              height: 3,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.22)",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.min(100, elapsedRatio * 100)}%`,
                height: "100%",
                backgroundColor: "#FFFFFF",
              }}
            />
          </View>
          {resumedFrom !== null && (
            <Text
              style={{
                marginTop: 14,
                color: "rgba(255,255,255,0.55)",
                fontFamily: Fonts?.sans,
                fontSize: 13,
              }}
            >
              Resumed — {fmt(totalSeconds - resumedFrom)} already done today
            </Text>
          )}
        </View>

        {/* Controls */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            paddingBottom: 18,
          }}
        >
          <Pressable
            onPress={stop}
            style={({ pressed }) => ({
              width: 60,
              height: 60,
              borderRadius: 30,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.14)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="stop" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={togglePause}
            style={({ pressed }) => ({
              width: 84,
              height: 84,
              borderRadius: 42,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons
              name={paused ? "play" : "pause"}
              size={34}
              color="#FFFFFF"
              style={paused ? { marginLeft: 4 } : undefined}
            />
          </Pressable>
          {/* Spacer to keep the pause button centered */}
          <View style={{ width: 60, height: 60 }} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
