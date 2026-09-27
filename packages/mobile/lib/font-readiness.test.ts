import { describe, expect, it } from "bun:test";
import { verifyFontReadiness, safeFontError } from "./font-readiness";

describe("font startup verification", () => {
  it("does not release startup before the load promise completes", async () => {
    let resolve!: () => void;
    let ready = false;
    let registryRead = false;
    const pending = new Promise<void>(r => { resolve = r; });
    const check = verifyFontReadiness(() => pending, () => { registryRead = true; return ["Caslon"]; }, ["Caslon"]).then(() => { ready = true; });
    await Promise.resolve();
    expect(ready).toBe(false);
    expect(registryRead).toBe(false);
    resolve(); await check;
    expect(ready).toBe(true);
  });
  it("checks all aliases, not just a cached loaded flag", async () => {
    await expect(verifyFontReadiness(async () => {}, () => ["Caslon"], ["Caslon", "DM"])).rejects.toMatchObject({ code: "FONT_REGISTRY_MISSING" });
  });
  it("requires exact family case", async () => {
    await expect(verifyFontReadiness(async () => {}, () => ["caslon"], ["Caslon"])).rejects.toMatchObject({ code: "FONT_REGISTRY_MISSING" });
  });
  it("surfaces loader errors and allows a later successful retry", async () => {
    await expect(verifyFontReadiness(async () => { throw { code: "ERR_DOWNLOAD" }; }, () => [], ["Caslon"])).rejects.toMatchObject({ code: "ERR_DOWNLOAD" });
    await expect(verifyFontReadiness(async () => {}, () => ["Caslon"], ["Caslon"])).resolves.toBeUndefined();
  });
  it("bounds loading without marking missing fonts ready", async () => {
    await expect(verifyFontReadiness(() => new Promise(() => {}), () => [], ["Caslon"], 5)).rejects.toMatchObject({ code: "FONT_LOAD_TIMEOUT" });
  });
  it("handles synchronous load and registry errors", async () => {
    await expect(verifyFontReadiness(() => { throw new Error("load"); }, () => [], [])).rejects.toThrow("load");
    await expect(verifyFontReadiness(async () => {}, () => { throw new Error("registry"); }, [])).rejects.toThrow("registry");
  });
  it("diagnostic errors cannot disclose URLs or arbitrary messages", () => {
    expect(safeFontError({ code: "ERR_DOWNLOAD" })).toBe("ERR_DOWNLOAD");
    expect(safeFontError(new Error("https://private.example/token"))).toBe("FONT_LOAD_FAILED");
    expect(safeFontError({ code: "https://private.example/token" })).toBe("FONT_LOAD_FAILED");
    expect(safeFontError(null)).toBe("FONT_LOAD_FAILED");
  });
});
