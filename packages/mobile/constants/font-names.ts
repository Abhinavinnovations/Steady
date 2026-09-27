import { Platform } from "react-native";
import { fontFamilies } from "../lib/font-families";

// Once per module evaluation, never per render. Loading and all Text styles share it.
export const FontNames = fontFamilies(Platform.OS, Date.now().toString(36));
