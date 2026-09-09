import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Theme override: light / dark / system, persisted across launches.
 * `useColorScheme()` (hooks/use-color-scheme) resolves through this context,
 * so every screen and component follows the user's choice automatically.
 */

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "steady.themeMode";

type ThemeModeValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Resolved scheme after applying the override. */
  scheme: "light" | "dark";
};

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const system = useRNColorScheme() ?? "light";
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === "light" || value === "dark" || value === "system") {
        setModeState(value);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeModeValue>(
    () => ({
      mode,
      setMode,
      scheme: mode === "system" ? system : mode,
    }),
    [mode, setMode, system],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

/** Safe outside the provider too (falls back to the system scheme). */
export function useThemeMode(): ThemeModeValue {
  const system = useRNColorScheme() ?? "light";
  const ctx = useContext(ThemeModeContext);
  if (ctx) return ctx;
  return { mode: "system", setMode: () => {}, scheme: system };
}
