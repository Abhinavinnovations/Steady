import { Platform } from "react-native";

/**
 * Steady color tokens — calm, dark-first, one violet accent, warm ember streak.
 * See design.md at the repo root.
 */
export const Colors = {
  light: {
    background: "#F2F2F7",
    foreground: "#26262E",
    card: "rgba(255,255,255,0.60)",
    cardForeground: "#26262E",
    cardElevated: "rgba(255,255,255,0.78)",
    glass: "rgba(255,255,255,0.60)",
    glassBorder: "rgba(255,255,255,0.65)",
    primary: "#7A73C9",
    primaryForeground: "#FFFFFF",
    primarySoft: "rgba(122,115,201,0.12)",
    secondary: "rgba(255,255,255,0.55)",
    secondaryForeground: "#26262E",
    muted: "rgba(120,120,135,0.10)",
    mutedForeground: "#73737F",
    accent: "rgba(255,255,255,0.55)",
    accentForeground: "#26262E",
    border: "rgba(120,120,135,0.16)",
    destructive: "#B07079",
    success: "#4F9F7E",
    warning: "#C98F4E",
    streak: "#C98F4E",
  },
  dark: {
    background: "#101018",
    foreground: "#ECECF2",
    card: "rgba(255,255,255,0.07)",
    cardForeground: "#ECECF2",
    cardElevated: "rgba(255,255,255,0.10)",
    glass: "rgba(255,255,255,0.07)",
    glassBorder: "rgba(255,255,255,0.10)",
    primary: "#8B85D6",
    primaryForeground: "#FFFFFF",
    primarySoft: "rgba(139,133,214,0.16)",
    secondary: "rgba(255,255,255,0.08)",
    secondaryForeground: "#ECECF2",
    muted: "rgba(255,255,255,0.08)",
    mutedForeground: "#96969F",
    accent: "rgba(255,255,255,0.08)",
    accentForeground: "#ECECF2",
    border: "rgba(255,255,255,0.10)",
    destructive: "#C08890",
    success: "#6FB99A",
    warning: "#D9A868",
    streak: "#D9A868",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ColorScheme];

/** Poppins is loaded in app/_layout.tsx via @expo-google-fonts/poppins. */
export const Fonts = Platform.select({
  ios: {
    sans: "Poppins_400Regular",
    light: "Poppins_300Light",
    medium: "Poppins_500Medium",
    semibold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
    mono: "ui-monospace",
  },
  default: {
    sans: "Poppins_400Regular",
    light: "Poppins_300Light",
    medium: "Poppins_500Medium",
    semibold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
    mono: "monospace",
  },
  web: {
    sans: "Poppins_400Regular, system-ui, sans-serif",
    light: "Poppins_300Light, system-ui, sans-serif",
    medium: "Poppins_500Medium, system-ui, sans-serif",
    semibold: "Poppins_600SemiBold, system-ui, sans-serif",
    bold: "Poppins_700Bold, system-ui, sans-serif",
    mono: "'SF Mono', 'Roboto Mono', monospace",
  },
});
