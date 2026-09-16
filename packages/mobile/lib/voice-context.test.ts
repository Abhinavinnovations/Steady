import { expect, test } from "bun:test";
import { contextualCard, stageVoiceTasks } from "./voice-context";
import type { VoiceCard } from "./voice-draft-state";
const card: VoiceCard = {localId:"0bd0633b-50c1-4ccd-acdf-f8f2f9f91481",title:"  Read 20 pages  ",kind:"todo",date:"2026-09-17",repeat:"weekly",time:"18:00",durationMinutes:120,reminder:true,categoryName:"Mind",categoryId:2,selected:true,status:"editable"};
test("to-do context forces to-do without losing reviewed scheduling", () => {
  expect(contextualCard({...card,kind:"consistent"},"todo")).toEqual({...card,kind:"todo"});
});
test("setup is daily with only supported title/duration fields", () => {
  for (const context of ["basic-setup","challenge-setup"] as const) {
    const next = contextualCard(card,context);
    expect(next).toMatchObject({kind:"consistent",date:null,repeat:"none",time:null,reminder:false,categoryId:null,categoryName:null,durationMinutes:120});
    expect(stageVoiceTasks([next],10)).toEqual([{requestId:card.localId,title:"Read 20 pages",durationMinutes:120}]);
  }
});
test("review selection, stable stage identity, maximum and title validation", () => {
  const reviewed = [card,{...card,localId:"other",selected:false}];
  expect(stageVoiceTasks(reviewed,1)).toHaveLength(1);
  expect(stageVoiceTasks(reviewed,1)[0].requestId).toBe(stageVoiceTasks(reviewed,1)[0].requestId);
  expect(() => stageVoiceTasks(reviewed,0)).toThrow("Room for 0");
  expect(() => stageVoiceTasks([{...card,selected:false}],10)).toThrow("Select");
  expect(() => stageVoiceTasks([{...card,title:" "}],10)).toThrow("Review");
  expect(contextualCard(card)).toBe(card);
});
