import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useProfile } from "@/queries/steady";
import { useUpdateTodo, useToggleTodo, useRemoveTodo } from "@/queries/todos";
import { AddTodoSheet, type TodoSheetValues } from "@/components/add-todo-sheet";
import { TaskRow } from "@/components/task-row";
import { repeatLabels } from "@/lib/recurrence";
import { cancelReminder, todoReminderId, refreshReminders, reportReminder } from "@/lib/reminders";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useCalendarMonth } from "@/queries/calendar";
import { GradientBackdrop } from "@/components/gradient-backdrop";
import { GlassCard } from "@/components/glass-card";
import { useTabClearance } from "@/components/paper-tab-bar";
import { PaperHeading } from "@/components/paper-heading";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  const tabClearance = useTabClearance();
  const profile = useProfile();
  const router = useRouter();
  const profileToday = new Intl.DateTimeFormat("en-CA", {timeZone:profile.data?.timezone ?? "UTC",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const [chosenMonth, setMonth] = useState<string | null>(null);
  const month = chosenMonth ?? profileToday.slice(0,7);
  const [selected, setSelected] = useState<string | null>(null);
  const cal = useCalendarMonth(month);
  const d = cal.data;
  type Todo = NonNullable<typeof d>["todos"][number];
  const [editing, setEditing] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateTodo();
  const toggle = useToggleTodo();
  const remove = useRemoveTodo();
  async function save(values: TodoSheetValues) {
    if (!editing) return;
    setError(null);
    try { await update.mutateAsync({id:editing.id,...values}); if (values.reminderEnabled && values.scheduledTime) reportReminder(await refreshReminders()); else await cancelReminder(todoReminderId(editing.id)); setEditing(null); } catch (e:any) { setError(e.message ?? "Could not save. Try again."); }
  }
  function deleteTodo(t: Todo) {
    const run=()=>remove.mutate({id:t.id},{onSuccess:()=>void cancelReminder(todoReminderId(t.id)),onError:e=>setError(e.message)});
    if(Platform.OS==="web") {if(window.confirm("Delete this to-do and all its repeat history?"))run();}
    else Alert.alert("Delete to-do?","The whole schedule and its history will be removed.",[{text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive",onPress:run}]);
  }

  const today = d?.today ?? profileToday;
  const selectedDay = selected ?? (today.startsWith(month) ? today : null);

  const todoDates = useMemo(() => {
    const s = new Set<string>();
    for (const t of d?.todos ?? []) s.add(t.dueDate);
    return s;
  }, [d?.todos]);

  const statusColor = (status: string | undefined): string | null => {
    if (status === "complete") return colors.success;
    if (status === "missed") return colors.warning;
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
        contentContainerStyle={{ padding: 24, paddingBottom: tabClearance, width: "100%", maxWidth: 700, alignSelf: "center" }}
        refreshControl={
          <RefreshControl
            refreshing={cal.isRefetching}
            onRefresh={() => cal.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <PaperHeading title="Calendar" />
        <Text
          style={{
            marginTop: 6,
            color: colors.mutedForeground,
            fontFamily: Fonts?.sans,
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          Everything scheduled, in one place. {profile.data?.timezone}.
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
            accessibilityRole="button" accessibilityLabel="Previous month"
            onPress={() => {
              setMonth(shiftMonth(month, -1));
              setSelected(null);
            }}
            hitSlop={8}
            style={{
              width: 44,
              height: 44,
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
          <Text style={{ flex: 1, textAlign: "center", color: colors.foreground, fontFamily: Fonts.display, fontSize: 26 }}>
            {monthLabel(month)}
          </Text>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Next month"
            onPress={() => {
              setMonth(shiftMonth(month, 1));
              setSelected(null);
            }}
            hitSlop={8}
            style={{
              width: 44,
              height: 44,
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

        {cal.isError && <Pressable accessibilityRole="button" onPress={()=>void cal.refetch()} style={{paddingVertical:16}}><Text style={{color:colors.destructive,fontFamily:Fonts.sans}}>Could not load this month. Tap to retry.</Text></Pressable>}
        {error && !editing && <Text accessibilityLiveRegion="polite" style={{color:colors.destructive,fontFamily:Fonts.sans,marginTop:16}}>{error}</Text>}
        {/* Grid */}
        <GlassCard style={{ marginTop: 12, marginHorizontal: -18, padding: 0, backgroundColor: "transparent", borderWidth: 0 }}>
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
                    return <View key={col} style={{ flex: 1, minHeight: 48 }} />;
                  const date = dateKey(month, day);
                  const isToday = date === today;
                  const isSelected = date === selectedDay;
                  const past = date <= today;
                  const fill = past ? statusColor(d?.days?.[date]) : null;
                  return (
                    <Pressable
                      key={col}
                      accessibilityRole="button" accessibilityLabel={`${date}${todoDates.has(date) ? ", to-dos scheduled" : ""}`} accessibilityState={{selected:isSelected}} aria-pressed={isSelected}
                      onPress={() => setSelected(date)}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        paddingVertical: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        marginVertical: 2,
                        borderRadius: 24,
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
              { c: colors.warning, label: "Missed" },
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
          <GlassCard style={{ marginTop: 24, padding: 0, borderWidth: 0, backgroundColor: "transparent" }}>
            <Text style={{ color: colors.foreground, fontFamily: Fonts.display, fontSize: 28 }}>
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
              dayTodos.map(t => <View key={`${t.id}:${t.occurrenceDate}`} style={{marginTop:10}}><TaskRow title={t.title} focusIdentity={t.durationMinutes ? {kind:"todo",id:t.id,day:t.occurrenceDate,durationMinutes:t.durationMinutes} : undefined} done={toggle.isPending && toggle.variables?.id===t.id && toggle.variables.occurrenceDate===t.occurrenceDate ? toggle.variables.done : t.completed} flagged={t.flagged}
                subtitle={[t.scheduledTime?formatTime(t.scheduledTime):null,t.repeat!=="none"?repeatLabels[t.repeat]:null].filter(Boolean).join(" · ")}
                onPress={()=>{setError(null);setEditing(t);}}
                onCheck={()=>{if(t.occurrenceDate>today){setError("Future occurrences cannot be completed yet.");return;}toggle.mutate({id:t.id,done:!t.completed,occurrenceDate:t.occurrenceDate},{onSuccess:()=>{if(!t.completed)void cancelReminder(`${todoReminderId(t.id)}:${t.occurrenceDate}`);},onError:e=>setError(e.message)});}}
                onSchedule={()=>{setError(null);setEditing(t);}}
                onFlag={()=>update.mutate({id:t.id,flagged:!t.flagged},{onError:e=>setError(e.message)})}
                onDelete={()=>deleteTodo(t)}/></View>)
            )}

            {selectedDay === today && dayTasks.length > 0 && <Pressable accessibilityRole="button" onPress={()=>router.push("/(tabs)")} style={{minHeight:44,justifyContent:"center",marginTop:12}}><Text style={{color:colors.primary,fontFamily:Fonts.medium}}>Complete consistent tasks with a note in Today</Text></Pressable>}
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
                  Consistent tasks repeat every day of the month. To-dos never affect these day colors.
                </Text>
              </>
            )}
          </GlassCard>
        )}
      </ScrollView>
      <AddTodoSheet visible={!!editing} submitting={update.isPending} error={error} todayISO={today} editing={editing?{...editing,dueDate:editing.anchorDate}:null} onSubmit={save} onClose={()=>{if(!update.isPending){setEditing(null);setError(null);}}}/>
    </SafeAreaView>
  );
}
