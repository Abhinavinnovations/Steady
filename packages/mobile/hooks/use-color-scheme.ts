import { useThemeMode } from "@/lib/theme-context";

/**
 * Resolved color scheme ("light" | "dark") after the user's theme
 * override (Profile → Appearance) is applied. Falls back to the
 * system scheme when the override is "system".
 */
export function useColorScheme(): "light" | "dark" {
  return useThemeMode().scheme;
}
