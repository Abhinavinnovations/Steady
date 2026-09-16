import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { client } from "./api";
import { getToken } from "./auth";
import { ReminderEngine, type ReminderPlan } from "./reminder-engine";
export { zonedInstant } from "../../web/src/shared/reminder-time";
const isWeb=Platform.OS==="web";
const CHANNEL="steady-reminders";
if(!isWeb)Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
async function configure(){if(Platform.OS==="android")await Notifications.setNotificationChannelAsync(CHANNEL,{name:"Task reminders",importance:Notifications.AndroidImportance.HIGH});}
const engine=new ReminderEngine({
  available:!isWeb,getOwner:getToken,now:Date.now,
  permitted:async()=>{await configure();return (await Notifications.getPermissionsAsync()).granted;},
  list:async()=>(await Notifications.getAllScheduledNotificationsAsync()).map(n=>({identifier:n.identifier,ownerId:typeof n.content.data?.steadyOwnerId==="string"?n.content.data.steadyOwnerId:undefined,signature:typeof n.content.data?.steadySignature==="string"?n.content.data.steadySignature:undefined})),
  cancel:async id=>{await Notifications.cancelScheduledNotificationAsync(id);},
  schedule:async n=>{await Notifications.scheduleNotificationAsync({identifier:n.identifier,content:{title:"Steady — time for your task",body:n.title,data:{steadyOwnerId:n.ownerId,steadySignature:n.signature}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:n.date,channelId:CHANNEL}});},
});
export function reportReminder(ok:boolean){if(!ok&&!isWeb)Alert.alert("Task saved, reminders unavailable","Check notification permission, Android Alarms & reminders access, and your connection. Reopen Steady to refresh. Consistent-task reminders begin after confirming this month.");}
export async function ensureReminderPermission():Promise<boolean>{if(isWeb)return false;try{await configure();return (await Notifications.getPermissionsAsync()).granted||(await Notifications.requestPermissionsAsync()).granted;}catch{return false;}}
export const taskReminderId=(id:number)=>`task-${id}`;
export const todoReminderId=(id:number)=>`todo-${id}`;
function cancellationFailed(){if(!isWeb)Alert.alert("Reminder removal could not be confirmed","The phone did not confirm clearing scheduled reminders. Disable Steady notifications in Android Settings if needed, then reopen Steady to retry reconciliation. In Expo Go, use Expo Go’s notification settings.");}
export const cancelReminder=(identifier:string)=>engine.cancel(identifier).catch(cancellationFailed);
/** On authenticated cold start preserve this user's queued reminders even if offline. */
export const clearSteadyReminders=(keepUserId?:string)=>engine.clear(keepUserId).catch(cancellationFailed);
export const syncReminders=(plan:ReminderPlan,isActive:()=>boolean=()=>true)=>engine.sync(plan,isActive);
/** Permission prompts happen only after an explicit reminder opt-in. */
export async function refreshReminders():Promise<boolean>{
  if(isWeb)return false;
  const active=engine.capture();
  try{if(!await ensureReminderPermission()||!active())return false;const plan=await client.reminders.plan();return active()?await engine.sync(plan,active):false;}catch{return false;}
}
