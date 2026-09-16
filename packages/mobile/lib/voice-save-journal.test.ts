import { beforeEach, describe, expect, mock, test } from "bun:test";
const storage=new Map<string,string>();let fail=false;
mock.module("@react-native-async-storage/async-storage",()=>({default:{getAllKeys:async()=>[...storage.keys()],multiRemove:async(keys:string[])=>{keys.forEach(k=>storage.delete(k));},getItem:async(k:string)=>storage.get(k)??null,setItem:async(k:string,v:string)=>{if(fail)throw Error("Storage unavailable");storage.set(k,v);},removeItem:async(k:string)=>{storage.delete(k);}}}));
const {setVoiceOwner,writeVoiceJournal,readVoiceJournal,voiceOwnerActive}=await import("./voice-save-journal");
const prefix="steady.voice-pending.v1:";
const row={kind:"todo" as const,localId:"one",payload:{requestId:"e3c856cc-cab2-43f5-a883-361223f62156",title:"Explicitly submitted",reminderEnabled:false}};
beforeEach(async()=>{fail=false;setVoiceOwner(null);await readVoiceJournal("none");storage.clear();});
describe("voice save journal, mock local storage",()=>{
 test("only supplied pending receipts roundtrip, no audio/transcript",async()=>{setVoiceOwner("a");await writeVoiceJournal("a",[row]);expect(await readVoiceJournal("a")).toEqual([row]);expect(storage.get(prefix+"a")).not.toContain("audioBase64");expect(storage.get(prefix+"a")).not.toContain("transcript");});
 test("signout removes owned journal but preserves unrelated settings",async()=>{setVoiceOwner("a");await writeVoiceJournal("a",[row]);storage.set("theme","dark");setVoiceOwner(null);await readVoiceJournal("a");expect(storage.has(prefix+"a")).toBe(false);expect(storage.get("theme")).toBe("dark");});
 test("account switch rejects queued old writes and never exposes old rows",async()=>{setVoiceOwner("a");const pending=writeVoiceJournal("a",[row]);setVoiceOwner("b");await expect(pending).rejects.toThrow("Account changed");expect(await readVoiceJournal("a")).toEqual([]);expect(await readVoiceJournal("b")).toEqual([]);expect(voiceOwnerActive("a")).toBe(false);});
 test("rapid transitions cannot obsolete-clean current owner journal",async()=>{storage.set(prefix+"b",JSON.stringify([row]));setVoiceOwner("a");setVoiceOwner(null);setVoiceOwner("b");expect(await readVoiceJournal("b")).toEqual([row]);});
 test("resolved pending entries remove journal",async()=>{setVoiceOwner("a");await writeVoiceJournal("a",[row]);await writeVoiceJournal("a",[]);expect(storage.has(prefix+"a")).toBe(false);});
 test("storage failure rejects protection but does not poison queue",async()=>{setVoiceOwner("a");fail=true;await expect(writeVoiceJournal("a",[row])).rejects.toThrow();fail=false;await writeVoiceJournal("a",[row]);expect(await readVoiceJournal("a")).toEqual([row]);});
 test("corrupt recovery fails closed",async()=>{setVoiceOwner("a");await readVoiceJournal("a");storage.set(prefix+"a",JSON.stringify([{kind:"bad"}]));await expect(readVoiceJournal("a")).rejects.toThrow("recovery is unavailable");});
});
