import { Platform } from "react-native";

/** White Paper semantic palette. Dark preserves the mineral base. */
export const Colors = {
  light: {
    background: "#FAF9F5", foreground: "#262620",
    card: "#FFFDF9", cardForeground: "#262620", cardElevated: "#FAF9F5",
    glass: "#F8F8F2", glassBorder: "#FFFFFF",
    primary: "#A4482D", primaryForeground: "#FFFFFF", primarySoft: "#F6E9E2",
    secondary: "#EFEEE6", secondaryForeground: "#262620",
    muted: "#EFEEE6", mutedForeground: "#64645B",
    accent: "#E8EDE2", accentForeground: "#50634B",
    border: "#DDDCD2", inputBorder: "#929286",
    destructive: "#A0373C", success: "#50634B", successForeground: "#FFFFFF",
    warning: "#87652D", streak: "#87652D",
  },
  dark: {
    background: "#101316", foreground: "#F4F1E9",
    card: "#1B2023", cardForeground: "#F4F1E9", cardElevated: "#22292C",
    glass: "#252D2F", glassBorder: "#515B5B",
    primary: "#F0AE91", primaryForeground: "#342016", primarySoft: "#3B2D27",
    secondary: "#282F32", secondaryForeground: "#F4F1E9",
    muted: "#282F32", mutedForeground: "#B7BDB6",
    accent: "#2C3D34", accentForeground: "#BDD2B5",
    border: "#384144", inputBorder: "#7D8B89",
    destructive: "#F2A3AB", success: "#BDD2B5", successForeground: "#18261C",
    warning: "#E2C28C", streak: "#E2C28C",
  },
} as const;
export type ColorScheme = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ColorScheme];

const native = {
  sans: "DMSansRegular", light: "DMSansRegular", medium: "DMSansMedium",
  semibold: "DMSansSemiBold", bold: "DMSansBold", display: "LibreCaslonDisplay",
};
/** Static font files loaded by expo-font, with browser fallback stacks. */
export const Fonts = Platform.select({
  ios: { ...native, mono: "Menlo" },
  default: { ...native, mono: "monospace" },
  web: {
    sans: "DMSansRegular, system-ui, sans-serif", light: "DMSansRegular, system-ui, sans-serif",
    medium: "DMSansMedium, system-ui, sans-serif", semibold: "DMSansSemiBold, system-ui, sans-serif",
    bold: "DMSansBold, system-ui, sans-serif", display: "LibreCaslonDisplay, Georgia, serif",
    mono: "'SF Mono', 'Roboto Mono', monospace",
  },
});
