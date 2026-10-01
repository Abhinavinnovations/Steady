import { FontNames } from "./font-names";
import type { FontFingerprint } from "../lib/font-file-policy";

/** Original, unmodified assets/paper TTFs. Update with assets, never with downloads. */
export const fontFingerprints: Record<string, FontFingerprint> = {
  [FontNames.sans]: { size: 78256, md5: "339b87251efe91e09ff40c8ffd467368" },
  [FontNames.medium]: { size: 78124, md5: "1f93ed85269bbf79fcc7e3d01cf16251" },
  [FontNames.semibold]: { size: 78404, md5: "b5c63580cca52410bb47abf7a1f34d1d" },
  [FontNames.bold]: { size: 78356, md5: "01e473479233ffb7a2bc8bbcffd962ba" },
  [FontNames.display]: { size: 91588, md5: "7d6ef8a932bc3673306502f1c5fa7469" },
};
