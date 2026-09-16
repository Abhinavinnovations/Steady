import { describe, expect, test } from "bun:test";
import { definitiveRejection, editableCard, freezePayload, recoverCard, validCard, withDeadline, type VoiceCard } from "./voice-draft-state";
const today = "2026-09-11";
const card: VoiceCard = { localId: "one", kind: "todo", title: "  Read a book  ", repeat: "weekdays", durationMinutes: 20, date: null, time: "18:37", reminder: true, categoryName: null, categoryId: 7, selected: true, status: "editable" };
describe("voice retry state", () => {
  test("freezes trimmed todo fields and date with explicit ID", () => { expect(freezePayload(card,"id",today)).toEqual({requestId:"id",title:"Read a book",dueDate:today,repeat:"weekdays",durationMinutes:20,scheduledTime:"18:37",reminderEnabled:true,categoryId:7}); });
  test("consistent payload is Basic with no todo recurrence/date", () => { const p=freezePayload({...card,kind:"consistent"},"id",today); expect(p.mode).toBe("basic"); expect(p.dueDate).toBeUndefined(); expect(p.repeat).toBeUndefined(); });
  test("absent schedule suppresses reminder and optional fields", () => {const p=freezePayload({...card,time:null,durationMinutes:null,categoryId:null},"id",today);expect(p.reminderEnabled).toBe(false);expect(p.scheduledTime).toBeUndefined();expect(p.durationMinutes).toBeUndefined();expect(p.categoryId).toBeUndefined();});
  test("recovery keeps exact payload and request ID, locks edits", () => {const payload=freezePayload(card,"id",today);const recovered=recoverCard({kind:"todo",localId:"one",payload});expect(recovered.payload).toBe(payload);expect(recovered.status).toBe("unknown");expect(recovered.selected).toBe(true);expect(editableCard(recovered)).toBe(false);});
  test("only definitive rejection unlocks; conflict/transport stay uncertain", () => {expect(definitiveRejection("BAD_REQUEST")).toBe(true);expect(definitiveRejection("FORBIDDEN")).toBe(true);for(const code of ["CONFLICT","TIMEOUT","INTERNAL_SERVER_ERROR",undefined])expect(definitiveRejection(code)).toBe(false);});
  test("card validation rejects empty title and impossible calendar date", () => {expect(validCard(card,today)).toBe(true);expect(validCard({...card,title:" "},today)).toBe(false);expect(validCard({...card,date:"2026-02-30"},today)).toBe(false);});
  test("deadline rejects without pretending to cancel original write", async () => {let complete!:(x:number)=>void;const write=new Promise<number>(resolve=>complete=resolve);await expect(withDeadline(write,2)).rejects.toMatchObject({code:"TIMEOUT"});complete(42);expect(await write).toBe(42);});
  test("fast response and explicit server rejection retain their values", async () => {expect(await withDeadline(Promise.resolve(4),100)).toBe(4);await expect(withDeadline(Promise.reject(new Error("Rejected")),100)).rejects.toThrow("Rejected");});
});
