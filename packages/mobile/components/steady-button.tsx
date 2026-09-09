import {
  ActivityIndicator,
  Pressable,
  Text,
  type ViewStyle,
} from "react-native";
import { Fonts } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "outline";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function SteadyButton({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: Props) {
  const colors = useColors();
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "outline"
        ? "transparent"
        : "transparent";
  const fg = variant === "primary" ? colors.primaryForeground : colors.foreground;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          style={{
            color: fg,
            fontSize: 16,
            fontFamily: Fonts?.semibold,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
