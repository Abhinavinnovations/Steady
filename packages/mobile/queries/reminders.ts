import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/api";
import { syncReminders } from "@/lib/reminders";

export function ReminderSync() {
  const qc = useQueryClient();
  const plan = useQuery(orpc.reminders.plan.queryOptions({enabled:Platform.OS !== "web", retry:false, refetchInterval:300_000}));
  useEffect(() => { let active = true; if (plan.data) void syncReminders(plan.data, () => active); return () => { active = false; }; }, [plan.data, plan.dataUpdatedAt]);
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({queryKey:orpc.reminders.key()}); };
    const sub = AppState.addEventListener("change", state => { if (state === "active") { refresh(); void qc.invalidateQueries({queryKey:orpc.today.key()}); void qc.invalidateQueries({queryKey:orpc.todos.key()}); } });
    const unsubscribe = qc.getMutationCache().subscribe(event => {
      if (event.type === "updated" && event.action.type === "success") refresh();
    });
    return () => { sub.remove(); unsubscribe(); };
  }, [qc]);
  return null;
}
