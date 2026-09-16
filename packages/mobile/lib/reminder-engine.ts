import { zonedInstant } from "../../web/src/shared/reminder-time";
export type ReminderPlan = { userId: string; timezone: string; entries: {identifier:string;title:string;day:string;time:string}[] };
export type ScheduledReminder = { identifier: string; ownerId?: string; signature?: string };
export type ReminderEntry = ReminderPlan["entries"][number] & {date:Date;signature:string;ownerId:string};
export const ownedReminder = (id: string) => /^(task|todo)-\d+(?::\d{4}-\d{2}-\d{2})?$/.test(id);
export interface ReminderPort {
  available: boolean;
  getOwner: () => string;
  now: () => number;
  permitted: () => Promise<boolean>;
  list: () => Promise<ScheduledReminder[]>;
  cancel: (id:string) => Promise<void>;
  schedule: (entry:ReminderEntry) => Promise<void>;
}
export function selectReminders(plan:ReminderPlan, scheduled:ScheduledReminder[], now:number):ReminderEntry[] {
  const capacity=Math.max(0,60-scheduled.filter(n=>!ownedReminder(n.identifier)).length);
  const counts=new Map<string,number>();const seen=new Set<string>();
  return plan.entries.map(n=>({...n,date:zonedInstant(n.day,n.time,plan.timezone)}))
    .filter(n=>ownedReminder(n.identifier)&&n.date.getTime()>now)
    .sort((a,b)=>a.date.getTime()-b.date.getTime())
    .filter(n=>{if(seen.has(n.identifier))return false;seen.add(n.identifier);const id=n.identifier.split(":")[0];const count=counts.get(id)??0;counts.set(id,count+1);return count<12;})
    .slice(0,capacity).map(n=>({...n,ownerId:plan.userId,signature:JSON.stringify([plan.userId,n.date.getTime(),n.title])}));
}
/** Serialized, latest-plan-wins reconciliation. Ports make OS races testable without claiming hardware coverage. */
export class ReminderEngine {
  private queue:Promise<unknown>=Promise.resolve();
  private generation=0;
  private revision=0;
  constructor(private port:ReminderPort) {}
  private serial<T>(work:()=>Promise<T>):Promise<T> {const next=this.queue.then(work,work);this.queue=next.catch(()=>{});return next;}
  capture() { const owner=this.port.getOwner(); const generation=this.generation;return ()=>!!owner&&owner===this.port.getOwner()&&generation===this.generation; }
  cancel(identifier:string) {return this.serial(async()=>{if(!this.port.available)return;for(const n of await this.port.list())if(ownedReminder(n.identifier)&&(n.identifier===identifier||n.identifier.startsWith(`${identifier}:`)))await this.port.cancel(n.identifier);});}
  clear(keepUserId?:string) {
    this.generation++;
    return this.serial(async()=>{if(!this.port.available)return;for(const n of await this.port.list())if(ownedReminder(n.identifier)&&(!keepUserId||n.ownerId!==keepUserId))await this.port.cancel(n.identifier);});
  }
  sync(plan:ReminderPlan, active:()=>boolean=()=>true):Promise<boolean> {
    // Capture before queuing, not when the queue reaches this entry.
    const owner=this.port.getOwner();const generation=this.generation;const revision=++this.revision;
    const current=()=>!!owner&&owner===this.port.getOwner()&&generation===this.generation&&revision===this.revision&&active();
    return this.serial(async()=>{
      if(!this.port.available||!current())return false;
      try {
        if(!await this.port.permitted()||!current())return false;
        const scheduled=await this.port.list();if(!current())return false;
        const wanted=selectReminders(plan,scheduled,this.port.now());const byId=new Map(wanted.map(n=>[n.identifier,n]));
        const unchanged=new Set<string>();
        for(const n of scheduled){
          if(!current())return false;
          if(!ownedReminder(n.identifier))continue;
          if(byId.get(n.identifier)?.signature===n.signature&&n.ownerId===plan.userId){unchanged.add(n.identifier);continue;}
          await this.port.cancel(n.identifier);
        }
        for(const n of wanted){
          if(!current())return false;
          if(unchanged.has(n.identifier))continue;
          await this.port.schedule(n);
          // Logout/cancel during an OS scheduling await must not leave a late notification behind.
          if(!current()){await this.port.cancel(n.identifier);return false;}
        }
        return current();
      }catch{return false;}
    });
  }
}
