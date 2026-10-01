import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { fontDownloadUri, fontFileMatches } from "./font-file-policy";

describe("native font transport", () => {
  it("avoids the preview HTTP-to-HTTPS redirect and preserves the full asset query", () => {
    const uri = "http://steady-tpgwcgt-preview-4300.runable.site/assets/?unstable_path=.%2Fassets%2Fpaper%2Fcaslon.ttf&platform=android&hash=abc";
    expect(fontDownloadUri(uri)).toBe(uri.replace("http:", "https:"));
  });
  it("does not rewrite local Metro, HTTPS, bundled assets or lookalike hosts", () => {
    for (const uri of ["http://192.168.1.2:8081/assets/caslon.ttf", "http://localhost:4300/assets/caslon.ttf", "https://example.com/font.ttf", "file:///fonts/font.ttf", "asset:///font.ttf", "http://notrunable.site/font.ttf", "http://runable.site.example.com/font.ttf"]) {
      expect(fontDownloadUri(uri)).toBe(uri);
    }
  });
  it("rejects the exact HTML redirect response found in the device cache", () => {
    expect(fontFileMatches({ exists: true, size: 167, md5: "0104c301c5e02bd6148b8703d19b3a73" }, { size: 91588, md5: "7d6ef8a932bc3673306502f1c5fa7469" })).toBe(false);
  });
  it("rejects missing, truncated and wrong-content files even at the expected length", () => {
    const expected = { size: 91588, md5: "7d6ef8a932bc3673306502f1c5fa7469" };
    expect(fontFileMatches({ exists: false, ...expected }, expected)).toBe(false);
    expect(fontFileMatches({ exists: true, ...expected, size: 50 }, expected)).toBe(false);
    expect(fontFileMatches({ exists: true, ...expected, md5: "wrong" }, expected)).toBe(false);
    expect(fontFileMatches({ exists: true, ...expected, md5: null }, expected)).toBe(false);
    expect(fontFileMatches({ exists: true, ...expected }, expected)).toBe(true);
  });
  it("pins all five fingerprints to the original static TTF bytes", () => {
    const source = readFileSync(new URL("../constants/font-fingerprints.ts", import.meta.url), "utf8");
    for (const filename of ["caslon.ttf", "DMSans-Regular.ttf", "DMSans-Medium.ttf", "DMSans-SemiBold.ttf", "DMSans-Bold.ttf"]) {
      const bytes = readFileSync(new URL(`../assets/paper/${filename}`, import.meta.url));
      const md5 = createHash("md5").update(bytes).digest("hex");
      expect(source).toContain(`size: ${bytes.length}, md5: "${md5}"`);
      expect(bytes.readUInt32BE(0)).toBe(0x00010000);
    }
  });
});
