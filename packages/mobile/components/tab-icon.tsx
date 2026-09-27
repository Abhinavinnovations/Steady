import Svg, { Circle, Path, Rect } from "react-native-svg";

type TabIconName = "today" | "progress" | "ranks" | "calendar" | "profile";

/** Geometric icons, not Text glyphs: independent of Android font-family substitution. */
export function TabIcon({ name, color, size, focused }: {
  name: TabIconName; color: string; size: number; focused: boolean;
}) {
  const fill = focused ? color : "none";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      {name === "today" && <>
        <Circle cx={12} cy={12} r={4} fill={fill} />
        <Path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>}
      {name === "progress" && <>
        <Rect x={3} y={11} width={4} height={10} rx={0.8} fill={fill} />
        <Rect x={10} y={3} width={4} height={18} rx={0.8} fill={fill} />
        <Rect x={17} y={7} width={4} height={14} rx={0.8} fill={fill} />
      </>}
      {name === "ranks" && <>
        <Path d="M2 21V10h6v11m0 0V4h8v17m0 0V14h6v7H2Z" fill={fill} />
      </>}
      {name === "calendar" && <>
        <Rect x={3} y={5} width={18} height={16} rx={2} />
        <Path d="M7 3v4m10-4v4M3 10h18" />
        <Rect x={6} y={13} width={3} height={3} rx={0.4} fill={fill} />
        <Path d="M12 14h.01M17 14h.01M7 18h.01M12 18h.01M17 18h.01" strokeWidth={2.4} />
      </>}
      {name === "profile" && <>
        <Circle cx={12} cy={7} r={4} fill={fill} />
        <Path d="M4 21v-2a8 6 0 0 1 16 0v2H4Z" fill={fill} />
      </>}
    </Svg>
  );
}
