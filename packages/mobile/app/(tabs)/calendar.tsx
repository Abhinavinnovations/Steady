import { useMemo, useState } from "react";
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
import { useCalendarMonth } from "@/queries/calendar";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { TAB_BAR_CLEARANCE } from "./_layout";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function deviceMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function firstWeekday(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).getDay();
}

function dateKey(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function prettyDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${names[dt.getDay()]}, ${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

function formatTime(t: string): string {
  const [h, min] = t.split(":").map(Number);
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(min).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

const STATUS_NOTES: Record<string, string> = {
  complete: "Every task done — a full day.",
  missed: "At least one task was missed.",
  rest: "Rest day — nothing was due.",
  pending: "Still in play.",
};

export default function CalendarScreen() {
  const colors = useColors();
  const [month, setMonth] = useState(deviceMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const cal = useCalendarMonth(month);
  const d = cal.data;

  const today = d?.today ?? dateKey(deviceMonth(), new Date().getDate());
  const selectedDay = selected ?? (today.startsWith(month) ? today : null);

  const todoDates = useMemo(() => {
    const s = new Set<string>();
    for (const t of d?.todos ?? []) s.add(t.dueDate);
    return s;
  }, [d?.todos]);

  const statusColor = (status: string | undefined): string | null => {
    if (status === "complete") return colors.success;
    if (status === "missed") return colors.destructive;
    if (status === "rest") return colors.mutedForeground;
    return null;
  };

  const total = daysInMonth(month);
  const lead = firstWeekday(month);
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayTodos = (d?.todos ?? []).filter((t) => t.dueDate === selectedDay);
  const dayTasks =
    selectedDay && d
      ? d.tasks.filter((t) => t.startDate <= selectedDay)
      : [];
  const selectedStatus = selectedDay ? d?.days?.[selectedDay] : undefined;

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
            refreshing={cal.isRefetching}
            onRefresh={() => cal.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 24 }}>
          Calendar
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
          Everything scheduled, in one place. Tap a day to see what&apos;s on it.
        </Text>

        {/* Month nav */}
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            onPress={() => {
              setMonth((m) => shiftMonth(m, -1));
              setSelected(null);
            }}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
          </Pressable>
          <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 16 }}>
            {monthLabel(month)}
          </Text>
          <Pressable
            onPress={() => {
              setMonth((m) => shiftMonth(m, 1));
              setSelected(null);
            }}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Grid */}
        <GlassCard style={{ marginTop: 12, padding: 12 }}>
          <View style={{ flexDirection: "row" }}>
            {WEEKDAYS.map((w, i) => (
              <View key={`${w}-${i}`} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.medium,
                    fontSize: 11,
                  }}
                >
                  {w}
                </Text>
              </View>
            ))}
          </View>
          {cal.isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={{ flexDirection: "row" }}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (day === null)
                    return <View key={col} style={{ flex: 1, aspectRatio: 1 }} />;
                  const date = dateKey(month, day);
                  const isToday = date === today;
                  const isSelected = date === selectedDay;
                  const past = date <= today;
                  const fill = past ? statusColor(d?.days?.[date]) : null;
                  return (
                    <Pressable
                      key={col}
                      onPress={() => setSelected(date)}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        margin: 2,
                        borderRadius: 10,
                        backgroundColor: fill ? `${fill}26` : "transparent",
                        borderWidth: isSelected ? 1.5 : isToday ? 1 : 0,
                        borderColor: isSelected
                          ? colors.primary
                          : isToday
                            ? colors.mutedForeground
                            : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: fill ?? colors.foreground,
                          fontFamily: isToday ? Fonts?.semibold : Fonts?.sans,
                          fontSize: 13,
                        }}
                      >
                        {day}
                      </Text>
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          marginTop: 2,
                          backgroundColor: todoDates.has(date)
                            ? colors.primary
                            : "transparent",
                        }}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
          {/* Legend */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 10,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {[
              { c: colors.success, label: "Full day" },
              { c: colors.destructive, label: "Missed" },
              { c: colors.mutedForeground, label: "Rest" },
              { c: colors.primary, label: "To-do due", dot: true },
            ].map((l) => (
              <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View
                  style={{
                    width: l.dot ? 5 : 10,
                    height: l.dot ? 5 : 10,
                    borderRadius: l.dot ? 3 : 3,
                    backgroundColor: l.dot ? l.c : `${l.c}66`,
                  }}
                />
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 11,
                  }}
                >
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Day detail */}
        {selectedDay && (
          <GlassCard style={{ marginTop: 16, padding: 16 }}>
            <Text style={{ color: colors.foreground, fontFamily: Fonts?.semibold, fontSize: 16 }}>
              {prettyDay(selectedDay)}
            </Text>
            {selectedDay <= today && selectedStatus && (
              <Text
                style={{
                  marginTop: 4,
                  color: statusColor(selectedStatus) ?? colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 12,
                }}
              >
                {STATUS_NOTES[selectedStatus] ?? selectedStatus}
              </Text>
            )}

            {/* To-dos due */}
            <Text
              style={{
                marginTop: 14,
                color: colors.mutedForeground,
                fontFamily: Fonts?.medium,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              To-dos
            </Text>
            {dayTodos.length === 0 ? (
              <Text
                style={{
                  marginTop: 8,
                  color: colors.mutedForeground,
                  fontFamily: Fonts?.sans,
                  fontSize: 13,
                }}
              >
                Nothing due this day.
              </Text>
            ) : (
              dayTodos.map((t) => (
                <View
                  key={t.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  <Ionicons
                    name={t.completed ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={t.completed ? colors.success : colors.mutedForeground}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: t.completed ? colors.mutedForeground : colors.foreground,
                      fontFamily: Fonts?.sans,
                      fontSize: 14,
                      textDecorationLine: t.completed ? "line-through" : "none",
                    }}
                  >
                    {t.title}
                  </Text>
                  {t.scheduledTime && (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: Fonts?.medium,
                        fontSize: 12,
                      }}
                    >
                      {formatTime(t.scheduledTime)}
                    </Text>
                  )}
                </View>
              ))
            )}

            {/* Consistent tasks */}
            {dayTasks.length > 0 && (
              <>
                <Text
                  style={{
                    marginTop: 18,
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.medium,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                  }}
                >
                  Every day
                </Text>
                {dayTasks.map((t) => (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    <Ionicons name="repeat" size={16} color={colors.primary} />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.foreground,
                        fontFamily: Fonts?.sans,
                        fontSize: 14,
                      }}
                    >
                      {t.title}
                    </Text>
                    {t.mode === "challenge" && (
                      <View
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor: `${colors.warning}26`,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.warning,
                            fontFamily: Fonts?.medium,
                            fontSize: 10,
                          }}
                        >
                          Challenge
                        </Text>
                      </View>
                    )}
                    {t.scheduledTime && (
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: Fonts?.medium,
                          fontSize: 12,
                        }}
                      >
                        {formatTime(t.scheduledTime)}
                      </Text>
                    )}
                  </View>
                ))}
                <Text
                  style={{
                    marginTop: 10,
                    color: colors.mutedForeground,
                    fontFamily: Fonts?.sans,
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                >
                  Consistent tasks repeat every day of the month.
                </Text>
              </>
            )}
          </GlassCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
