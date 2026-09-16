import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { focusKey, focusLabel, type FocusIdentity } from "@/lib/focus-progress";
import { readFocus, subscribeFocus } from "@/lib/focus-storage";

export function useFocusBalance(item?: FocusIdentity) {
  const key = item ? focusKey(item) : null;
  const total = (item?.durationMinutes ?? 0) * 60;
  const [saved, setSaved] = useState<{ key: string; total: number; seconds: number | null } | null>(null);
  const load = useCallback(() => {
    let active = true;
    if (key && total > 0) void readFocus(key, total).then(seconds => {
      if (active) setSaved({ key, total, seconds });
    }).catch(() => { if (active) setSaved({ key, total, seconds: null }); });
    return () => { active = false; };
  }, [key, total]);
  useFocusEffect(load);
  useEffect(() => {
    let cancel = () => {};
    const unsubscribe = subscribeFocus(changed => { if (changed === key) { cancel(); cancel = load(); } });
    return () => { cancel(); unsubscribe(); };
  }, [key, load]);
  if (!item || total <= 0) return null;
  if (saved?.key !== key || saved.total !== total) return "Checking focus balance…";
  if (saved.seconds === null) return "Focus balance unavailable";
  return focusLabel(saved.seconds, item.durationMinutes);
}
