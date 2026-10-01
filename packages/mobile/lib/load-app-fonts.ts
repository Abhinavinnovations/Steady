import { loadAsync } from "expo-font";
import { appFonts } from "../constants/font-assets";

/** Browser keeps its original font loading and family names. */
export function loadAppFonts(): Promise<void> {
  return loadAsync(appFonts);
}
