import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/** Default to quiet/opaque until the platform preference is known. */
export function useNavigationEffects() {
  const [reducedMotion, setMotion] = useState(true);
  const [reducedTransparency, setTransparency] = useState(true);
  useEffect(() => {
    let active = true;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const transparency = window.matchMedia("(prefers-reduced-transparency: reduce)");
      const sync = () => { setMotion(motion.matches); setTransparency(transparency.matches); };
      sync(); motion.addEventListener("change", sync); transparency.addEventListener("change", sync);
      return () => { motion.removeEventListener("change", sync); transparency.removeEventListener("change", sync); };
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setMotion);
    if (Platform.OS !== "ios") { setTransparency(false); return () => { active = false; motion.remove(); }; }
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setTransparency(value); }).catch(() => {});
    const transparency = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setTransparency);
    return () => { active = false; motion.remove(); transparency.remove(); };
  }, []);
  return { reducedMotion, reducedTransparency };
}
