import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { loadAsync, type FontSource } from "expo-font";
import { appFonts } from "../constants/font-assets";
import { fontFingerprints } from "../constants/font-fingerprints";
import { fontDownloadUri, fontFileMatches } from "./font-file-policy";

let pending: Promise<void> | undefined;

async function verifiedSource(family: string, source: number): Promise<FontSource> {
  const asset = Asset.fromModule(source);
  // Installed builds retain Expo's bundled asset resolution, including asset://.
  if (!/^https?:\/\//i.test(asset.uri)) return source;

  const expected = fontFingerprints[family];
  if (!expected) throw Object.assign(new Error("Unknown font asset"), { code: "FONT_FILE_INVALID" });
  // Do not reuse Expo's cache: older Android downloads stored redirect HTML there.
  const file = new File(Paths.cache, `SteadyFont-${expected.md5}.ttf`);
  const valid = () => fontFileMatches({ exists: file.exists, size: file.size, md5: file.md5 }, expected);
  if (!valid()) {
    await File.downloadFileAsync(fontDownloadUri(asset.uri), file, { idempotent: true });
  }
  if (!valid()) {
    throw Object.assign(new Error("Downloaded font failed integrity verification"), { code: "FONT_FILE_INVALID" });
  }
  return { uri: file.uri };
}

/** Deduplicate Strict Mode/retries and register only verified remote font bytes. */
export function loadAppFonts(): Promise<void> {
  if (!pending) {
    pending = Promise.all(Object.entries(appFonts).map(async ([family, source]) =>
      [family, await verifiedSource(family, source)] as const,
    )).then(entries => loadAsync(Object.fromEntries(entries)))
      .catch(error => { pending = undefined; throw error; });
  }
  return pending;
}
