import { FontNames } from "./font-names";

/** One registry for startup, native Text styles and on-device diagnostics. */
export const appFonts = {
  [FontNames.sans]: require("../assets/paper/DMSans-Regular.ttf"),
  [FontNames.medium]: require("../assets/paper/DMSans-Medium.ttf"),
  [FontNames.semibold]: require("../assets/paper/DMSans-SemiBold.ttf"),
  [FontNames.bold]: require("../assets/paper/DMSans-Bold.ttf"),
  [FontNames.display]: require("../assets/paper/caslon.ttf"),
};
export const appFontNames = Object.keys(appFonts);
