import { useEffect, useId, useRef } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

/** Screen-sleep prevention is optional: denial must never break the timer. */
export function useFocusAwake() {
  const id = useId();
  const generation = useRef(0);
  useEffect(() => {
    const tag = `steady-focus-${id}-${++generation.current}`;
    let disposed = false;
    let activated = false;
    const release = () => { void deactivateKeepAwake(tag).catch(() => {}); };
    void activateKeepAwakeAsync(tag).then(() => {
      activated = true;
      if (disposed) release();
    }).catch(() => {
      // Permission, battery policy, or an inactive browser can deny this.
      // Countdown still uses wall-clock time and persists its progress.
    });
    return () => {
      disposed = true;
      if (activated) release();
    };
  }, [id]);
}
