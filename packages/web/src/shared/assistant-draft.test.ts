import { describe, expect, test } from "bun:test";
import { assistantInput, batchSchema, draftSchema, extractJson, normalizeDraft } from "./assistant-draft";
const draft={kind:"todo" as const,title:"Buy milk"};
describe("assistant output validation",()=>{
 test("single and mixed lists accept 1–20 entries only",()=>{expect(batchSchema.parse({drafts:[draft]}).drafts).toHaveLength(1);expect(batchSchema.parse({drafts:Array.from({length:20},()=>draft)}).drafts).toHaveLength(20);expect(()=>batchSchema.parse({drafts:[]})).toThrow();expect(()=>batchSchema.parse({drafts:Array.from({length:21},()=>draft)})).toThrow();});
 test("malformed JSON never becomes a draft",()=>{expect(()=>extractJson("Not JSON")).toThrow();expect(()=>extractJson('{bad}')).toThrow();expect(extractJson('```json\n{"drafts":[]}\n```')).toEqual({drafts:[]});});
 test("invalid date/time/duration/title rejected",()=>{for(const extra of [{date:"2026-02-30"},{time:"25:00"},{durationMinutes:4},{durationMinutes:481},{title:"x"},{title:"x".repeat(81)}])expect(()=>draftSchema.parse({...draft,...extra})).toThrow();});
 test("known category case resolves; unknown category stays null",()=>{expect(normalizeDraft(draftSchema.parse({...draft,categoryName:"work"}),"2026-09-11",["Work"]).categoryName).toBe("Work");expect(normalizeDraft(draftSchema.parse({...draft,categoryName:"Other"}),"2026-09-11",["Work"]).categoryName).toBeNull();});
 test("consistent normalization removes todo recurrence/date",()=>{const d=normalizeDraft(draftSchema.parse({...draft,kind:"consistent",repeat:"daily",date:"2026-09-12"}),"2026-09-11",[]);expect(d.repeat).toBe("none");expect(d.date).toBeNull();});
 test("missing optional values use explicit null/defaults",()=>{expect(normalizeDraft(draftSchema.parse(draft),"2026-09-11",[])).toEqual({...draft,repeat:"none",date:"2026-09-11",time:null,durationMinutes:null,reminder:false,categoryName:null});});
 test("M4A aliases accepted and input size constrained",()=>{for(const mimeType of ["audio/mp4","audio/m4a","audio/x-m4a"])expect(assistantInput.parse({audioBase64:"a",mimeType}).mimeType).toBe(mimeType);expect(()=>assistantInput.parse({transcript:"x".repeat(2001)})).toThrow();});
});
