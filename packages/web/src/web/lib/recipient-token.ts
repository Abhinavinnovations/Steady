import { useSyncExternalStore } from "react";

// In-memory only. Bootstrap scrubs initial URLs and same-tab email reopens
// before analytics can observe the fragment. Never persist capabilities.
const scope = window as Window & { steadyRecipientToken?: string };
function take() {
  const value = scope.steadyRecipientToken || "";
  delete scope.steadyRecipientToken;
  return value;
}
let token = take();
const listeners = new Set<() => void>();
window.addEventListener("steady-recipient-link", () => {
  token = take();
  for (const fn of listeners) fn();
});
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function useRecipientToken() { return useSyncExternalStore(subscribe, () => token); }
