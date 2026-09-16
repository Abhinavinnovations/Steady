import { useEffect, useState, type ComponentProps } from "react";
import { AccessibilityInfo, Modal, Platform } from "react-native";

/** Keep the platform modal's focus/back behavior; omit movement when requested. */
export function PaperModal(props: ComponentProps<typeof Modal>) {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReduceMotion(query.matches);
      update();
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);
  return <Modal {...props} animationType={reduceMotion ? "none" : props.animationType} />;
}
