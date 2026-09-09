import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useCategories, useCreateCategory } from "@/queries/todos";

/**
 * Shared schedule inputs for the add/edit sheets:
 * - CategoryPicker  — user-created category chips + inline "new" input
 * - DateChips       — Today / Tomorrow / next days for to-do due dates
 * - TimeField       — optional "HH:mm" picker built from two snap wheels
 */

/* ---------------------------------- time ---------------------------------- */

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const am = h < 12;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${am ? "am" : "pm"}`;
}

const ITEM_H = 42;
const VISIBLE = 3;

/** Minimal snapping wheel (haptic detents, no audio) for hour/minute columns. */
function SnapWheel({
  items,
  index,
  onIndexChange,
  width,
}: {
  items: string[];
  index: number;
  onIndexChange: (idx: number) => void;
  width: number;
}) {
  const colors = useColors();
  const indexRef = useRef(index);
  const listRef = useRef<FlatList<string>>(null);
  // While a programmatic sync is in flight, scroll events are echoes of old
  // positions (mount/initialScrollIndex), not user intent — ignore them until
  // the wheel reaches the target, or re-apply if the list wasn't ready yet.
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    // Keep the wheel in sync when the index is changed from outside.
    if (index !== indexRef.current) {
      indexRef.current = index;
      pendingRef.current = index;
      listRef.current?.scrollToOffset({
        offset: index * ITEM_H,
        animated: false,
      });
      const t = setTimeout(() => {
        if (pendingRef.current !== null) {
          listRef.current?.scrollToOffset({
            offset: pendingRef.current * ITEM_H,
            animated: false,
          });
          pendingRef.current = null;
        }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [index]);

  const tick = useCallback(() => {
    try {
      if (Platform.OS !== "web") void Haptics.selectionAsync();
    } catch {
      // haptics unavailable — fine
    }
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.min(
        items.length - 1,
        Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)),
      );
      if (pendingRef.current !== null) {
        if (idx === pendingRef.current) pendingRef.current = null;
        return;
      }
      if (idx !== indexRef.current) {
        indexRef.current = idx;
        tick();
        onIndexChange(idx);
      }
    },
    [items.length, onIndexChange, tick],
  );

  return (
    <View
      style={{
        width,
        height: ITEM_H * VISIBLE,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_H,
          left: 6,
          right: 6,
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
        data={items}
        keyExtractor={(item, i) => `${i}-${item}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        renderItem={({ item, index: i }) => (
          <View
            style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              style={{
                color:
                  i === indexRef.current ? colors.foreground : colors.mutedForeground,
                fontFamily: Fonts?.semibold,
                fontSize: 15,
                fontVariant: ["tabular-nums"],
              }}
            >
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => {
  const am = h < 12;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${am ? "am" : "pm"}`;
});
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

/** Optional time-of-day field: collapsed chip → hour/minute wheels. */
export function TimeField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (time: string | null) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const [hourIdx, minuteIdx] = useMemo(() => {
    if (!value) {
      const next = new Date();
      next.setHours(next.getHours() + 1);
      return [next.getHours(), 0];
    }
    const [h, m] = value.split(":").map(Number);
    return [h, Math.min(11, Math.round(m / 5))];
  }, [value]);

  function emit(h: number, mIdx: number) {
    onChange(`${String(h).padStart(2, "0")}:${MINUTES[mIdx]}`);
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
        <Text
          style={{
            flex: 1,
            color: colors.mutedForeground,
            fontFamily: Fonts?.semibold,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Time (optional)
        </Text>
        {value ? (
          <Pressable
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
            hitSlop={8}
          >
            <Text
              style={{
                color: colors.destructive,
                fontFamily: Fonts?.medium,
                fontSize: 12,
              }}
            >
              Remove
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!open ? (
        <Pressable
          onPress={() => {
            setOpen(true);
            if (!value) emit(hourIdx, minuteIdx);
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: value ? colors.primary : colors.border,
            backgroundColor: value ? colors.primarySoft : colors.card,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 9,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons
            name={value ? "alarm-outline" : "add"}
            size={15}
            color={value ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={{
              color: value ? colors.primary : colors.mutedForeground,
              fontFamily: Fonts?.semibold,
              fontSize: 13,
            }}
          >
            {value ? formatTime12(value) : "Set a time"}
          </Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <SnapWheel
            items={HOURS}
            index={hourIdx}
            width={110}
            onIndexChange={(i) => emit(i, minuteIdx)}
          />
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: Fonts?.semibold,
              fontSize: 18,
            }}
          >
            :
          </Text>
          <SnapWheel
            items={MINUTES}
            index={minuteIdx}
            width={80}
            onIndexChange={(i) => emit(hourIdx, i)}
          />
          <Pressable onPress={() => setOpen(false)} hitSlop={8}>
            <Text
              style={{
                color: colors.primary,
                fontFamily: Fonts?.semibold,
                fontSize: 13,
              }}
            >
              Done
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ---------------------------------- date ---------------------------------- */

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function chipLabel(iso: string, todayISO: string): string {
  if (iso === todayISO) return "Today";
  if (iso === addDays(todayISO, 1)) return "Tomorrow";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Due-date picker: Today / Tomorrow / the next two weeks as chips. */
export function DateChips({
  value,
  onChange,
  todayISO,
}: {
  value: string;
  onChange: (iso: string) => void;
  todayISO: string;
}) {
  const dates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(todayISO, i)),
    [todayISO],
  );
  const colors = useColors();
  // A previously-set date older than today still needs a chip to show as selected.
  const all = dates.includes(value) ? dates : [value, ...dates];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: Fonts?.semibold,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          When
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {all.map((iso) => {
            const active = iso === value;
            return (
              <Pressable
                key={iso}
                onPress={() => onChange(iso)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : colors.card,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.mutedForeground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 13,
                  }}
                >
                  {chipLabel(iso, todayISO)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* -------------------------------- category -------------------------------- */

/** User-created category chips + inline "new category" input. Never hardcoded. */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (categoryId: number | null) => void;
}) {
  const colors = useColors();
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");

  async function submitNew() {
    const name = newName.trim();
    if (!name) return;
    try {
      const cat = await createCategory.mutateAsync({ name });
      onChange(cat.id);
      setAddingNew(false);
      setNewName("");
    } catch {
      // server enforces the cap / dupes return existing — leave input open
    }
  }

  const list = categories.data ?? [];

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="pricetag-outline" size={13} color={colors.mutedForeground} />
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: Fonts?.semibold,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          Category (optional)
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable
            onPress={() => onChange(null)}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: value === null ? colors.primary : colors.border,
              backgroundColor: value === null ? colors.primarySoft : colors.card,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                color: value === null ? colors.primary : colors.mutedForeground,
                fontFamily: Fonts?.semibold,
                fontSize: 13,
              }}
            >
              None
            </Text>
          </Pressable>
          {list.map((c) => {
            const active = value === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => onChange(active ? null : c.id)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : colors.card,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.mutedForeground,
                    fontFamily: Fonts?.semibold,
                    fontSize: 13,
                  }}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
          {addingNew ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="New category"
                placeholderTextColor={colors.mutedForeground}
                maxLength={30}
                onSubmitEditing={submitNew}
                style={{
                  borderWidth: 1,
                  borderColor: colors.primary,
                  borderRadius: 999,
                  backgroundColor: colors.card,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  minWidth: 130,
                  color: colors.foreground,
                  fontFamily: Fonts?.sans,
                  fontSize: 13,
                }}
              />
              <Pressable onPress={submitNew} hitSlop={8}>
                <Ionicons
                  name="checkmark-circle"
                  size={26}
                  color={
                    newName.trim() && !createCategory.isPending
                      ? colors.primary
                      : colors.mutedForeground
                  }
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  setAddingNew(false);
                  setNewName("");
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle-outline" size={24} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setAddingNew(true)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="add" size={14} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: Fonts?.semibold,
                  fontSize: 13,
                }}
              >
                New
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
