import Svg, { Path, type SvgProps } from "react-native-svg";
import { iconPaths, type SteadyIconName } from "./steady-icon-paths";

type Props = Omit<SvgProps, "width" | "height" | "color"> & {
  name: SteadyIconName;
  size?: number;
  color?: string;
};

/** Original Ionicons silhouettes, rendered as geometry instead of font glyphs. */
export function SteadyIcon({ name, size = 24, color = "currentColor", style, ...props }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill={color}
      accessible={false} aria-hidden={true} focusable={false}
      style={[{ flexShrink: 0 }, style]} {...props}>
      <Path d={iconPaths[name]} />
    </Svg>
  );
}
SteadyIcon.glyphMap = iconPaths;
