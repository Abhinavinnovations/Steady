import { describe, expect, it } from "bun:test";
import { fontFamilies } from "./font-families";
import { verifyFontReadiness } from "./font-readiness";

describe("launch-scoped font registration", () => {
  it("preserves the preview's five exact font names", () => {
    expect(fontFamilies("web", "a")).toEqual({ sans: "DMSansRegular", medium: "DMSansMedium", semibold: "DMSansSemiBold", bold: "DMSansBold", display: "LibreCaslonDisplay" });
    expect(fontFamilies("web", "a")).toEqual(fontFamilies("web", "b"));
  });
  it("uses a distinct namespace on a new native JS launch", () => {
    for (const platform of ["android", "ios"]) {
      const old = Object.values(fontFamilies(platform, "old"));
      const next = Object.values(fontFamilies(platform, "new"));
      expect(new Set(next).size).toBe(5);
      expect(next.every(name => name.startsWith("Steady_") && !old.includes(name))).toBe(true);
    }
  });
  it("cannot accept a stale native registry as readiness for the new launch", async () => {
    const old = Object.values(fontFamilies("android", "old"));
    const next = Object.values(fontFamilies("android", "new"));
    await expect(verifyFontReadiness(async () => {}, () => old, next)).rejects.toMatchObject({ code: "FONT_REGISTRY_MISSING" });
    const registered = new Set(old);
    let loads = 0;
    await verifyFontReadiness(async () => {
      for (const name of next) if (!registered.has(name)) { loads++; registered.add(name); }
    }, () => [...registered], next);
    expect(loads).toBe(5);
  });
});
