import { useEffect, useState } from "react";
import { useThemeMode } from "@/lib/theme-context";

/**
 * Web variant: identical to native, but returns "light" until hydration
 * to support static rendering without a flash of mismatched markup.
 */
export function useColorScheme(): "light" | "dark" {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const { scheme } = useThemeMode();

  if (hasHydrated) return scheme;
  return "light";
}
