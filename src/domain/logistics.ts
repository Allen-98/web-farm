import {farmCapacity} from './capacity.ts';
import {ORDER_POINT,orderRemaining,type TradeItem} from './orders.ts';
import { chapterConfig, has } from './chapter2.ts';
import { bakeryConfig, harvestWheat } from './bakery.ts';
import { transferItems } from './economy.ts';
import {inventoryUsed} from './economy.ts';
import {allowedTask,cartFactor} from './dispatch.ts';
import type {Claim} from './dispatch.ts';
import type { World, Actor } from './world.ts';
import type { Item, Vec2, Inventory } from './contracts.ts';
type Fx=(item:Item|'cash',n:number,from:Vec2,to:Vec2)=>void;
export interface Task {id:string;item:Item;source:Inventory;store:Inventory;from:Vec2;to:Vec2;fill:number;priority:number}
const near=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z)<.95;
export const JOB_NAMES:Record<string,string>={harvest:'收割工',haul:'饲料运输',car_counter:'店员·跨区供货',walk_counter:'店员·跨区供货',packer:'包装工',egg_courier:'运蛋员',gift_courier:'礼盒配送',wheat_farmer:'麦农',baker:'烘焙师',cake_courier:'蛋糕配送',cashier:'收款员'};
export const TASK_NAMES:Record<string,string>={car_counter:'汽车柜台补蛋',walk_counter:'步行柜台补蛋',pack:'包装台送蛋',oven:'烤炉送蛋',gift:'礼盒摊补货',truck:'批发装车',flour:'烤炉送面粉',cake:'蛋糕摊补货',deposit:'去 ATM 存款',harvest:'收割小麦',mill:'磨坊送小麦'};
/** Multi-material jobs compare eligible work before choosing which cargo to collect. */
export function rankCourierKinds(w:World,a:Actor,kinds:Item[]):Item[]{
  const score=(kind:Item)=>{const tasks=courierTasks(w,a,kind).filter(t=>allowedTask(w,a,t.id)&&t.source.items[kind]>0&&t.store.items[kind]<Math.max(t.fill,w.dispatch.floors[t.id as keyof typeof w.dispatch.floors]??0));
    return Math.min(Infinity,...tasks.map(t=>{const incoming=w.workers.filter(o=>o!==a&&o.task===t.id).reduce((n,o)=>n+(w.dispatch.claims[o.id]?.amount??o.bag.items[kind]),0),stock=t.store.items[kind]+incoming;
      if(stock>=(Math.max(t.fill,w.dispatch.floors[t.id as keyof typeof w.dispatch.floors]??0)))return Infinity;
      if(stock<(w.dispatch.floors[t.id as keyof typeof w.dispatch.floors]??0))return -10;
      const order=t.id.startsWith('order_'),process=['pack','oven','flour'].includes(t.id);
      return w.dispatch.policy==='orders'?(order?.05:1):w.dispatch.policy==='processing'?(process?.1:order?1.5:1):order?.6:t.priority;
    }));};
  return [...kinds].sort((a,b)=>score(a)-score(b));
}
export function courierTasks(w:World,a:Actor,kind:Item):Task[]{
  const order:Task[]=[];
  if(['egg','gift','cake'].includes(kind)&&w.orders.active&&orderRemaining(w,kind as TradeItem)>0){
    const source=kind==='egg'?w.ground:kind==='gift'?w.chapter.output:w.bakery.cakes;
    const from=kind==='egg'?{x:12.8,z:9.4}:kind==='gift'?chapterConfig.points.output:bakeryConfig.points.cakeOutput;
    order.push({id:`order_${kind}`,item:kind,source,store:w.orders.active.stock,from,to:ORDER_POINT,fill:w.orders.active.offer.requires[kind as TradeItem],priority:.12});
  }
  if(kind==='egg'){
    const tasks:Task[]=w.stations.filter(s=>s.enabled).map(s=>({id:s.id,item:'egg',source:w.ground,store:s.stock,from:{x:12.8,z:9.4},to:s.id==='car_counter'?{x:13,z:11.7}:{x:18,z:16.5},fill:has(w,'pack_table')?18:48,priority:s.stock.items.egg<4?.35:1.3}));
    if(has(w,'pack_table'))tasks.push({id:'pack',item:'egg',source:w.ground,store:w.chapter.input,from:{x:12.8,z:9.4},to:chapterConfig.points.input,fill:30,priority:1});
    if(has(w,'oven'))tasks.push({id:'oven',item:'egg',source:w.ground,store:w.bakery.ovenEgg,from:{x:12.8,z:9.4},to:bakeryConfig.points.eggInput,fill:16,priority:.8});
    const factor=farmCapacity(w).coopLevel+1;
    for(const task of tasks)task.fill=Math.min(task.store.capacity,task.fill*factor);
    return [...order,...tasks];
  }
  if(kind==='gift'){
    const tasks:Task[]=[];
    if(has(w,'gift_stall'))tasks.push({id:'gift',item:'gift',source:w.chapter.output,store:w.chapter.stock,from:chapterConfig.points.output,to:chapterConfig.points.supply,fill:6,priority:1});
    if(has(w,'wholesale')&&!w.chapter.truck.cooldown){
      // A view onto the authoritative truck counter, updated after each transfer.
      tasks.push({id:'truck',item:'gift',source:w.chapter.output,store:{capacity:12,items:{corn:0,egg:0,gift:w.chapter.truck.loaded,wheat:0,flour:0,cake:0}},from:chapterConfig.points.output,to:chapterConfig.points.loading,fill:12,priority:a.deliveries%3===0?2:.25});
    }
    return [...order,...tasks];
  }
  if(kind==='flour')return has(w,'oven')?[{id:'flour',item:'flour',source:w.bakery.flour,store:w.bakery.ovenFlour,from:bakeryConfig.points.flourOutput,to:bakeryConfig.points.flourInput,fill:24,priority:1}]:[];
  if(kind==='cake')return [...order,...(has(w,'cake_stall')?[{id:'cake',item:'cake' as const,source:w.bakery.cakes,store:w.bakery.stock,from:bakeryConfig.points.cakeOutput,to:bakeryConfig.points.cakeSupply,fill:12,priority:1}]:[])];
  return [];
}
export function updateCourier(w:World,a:Actor,kind:Item,n:number,go:(p:Vec2)=>void,fx:Fx):void {
  const tasks=courierTasks(w,a,kind),d=w.dispatch;
  for(const t of tasks)if(t.id in d.floors)t.fill=Math.min(t.store.capacity,Math.max(t.fill,d.floors[t.id as keyof typeof d.floors]));
  const reserved=(t:Task)=>w.workers.filter(o=>o!==a&&o.task===t.id).reduce((sum,o)=>sum+(d.claims[o.id]?.amount??o.bag.items[kind]),0);
  const freeSource=(t:Task)=>Math.max(0,t.source.items[kind]-w.workers.filter(o=>o!==a&&!o.delivering&&d.claims[o.id]?.item===kind).reduce((sum,o)=>sum+Math.max(0,d.claims[o.id].amount-o.bag.items[kind]),0));
  const floor=(t:Task)=>d.floors[t.id as keyof typeof d.floors]??0;
  const deficit=(t:Task)=>Math.max(0,floor(t)-t.store.items[kind]-reserved(t));
  const canPick=(t:Task)=>Math.max(0,freeSource(t)-(deficit(t)>0?0:tasks.filter(o=>o.source===t.source&&o.id!==t.id).reduce((sum,o)=>sum+deficit(o),0)));
  const score=(t:Task)=>{
    if(deficit(t)>0)return -10+t.store.items[kind]/Math.max(1,floor(t));
    const order=t.id.startsWith('order_'),process=['pack','oven','flour'].includes(t.id);
    const priority=d.policy==='orders'?(order?.05:1):d.policy==='processing'?(process?.1:order?1.5:1):(order?.6:t.priority);
    return priority*(1+(t.store.items[kind]+reserved(t))/t.fill);
  };
  let task=tasks.find(t=>t.id===a.task),claim:Claim|undefined=d.claims[a.id];
  // Loaded workers finish their committed trip, even after a policy or assignment change.
  if(!a.bag.items[kind]&&(!task||!claim||!allowedTask(w,a,task.id)||task.store.items[kind]+reserved(task)>=task.fill||canPick(task)===0)){
    delete d.claims[a.id];a.task=null;task=undefined;claim=undefined;
  }
  if(a.bag.items[kind]&&(!task||task.store.items[kind]>=task.fill)){
    // Manual deliveries, completed orders or full targets can invalidate an in-flight trip.
    // Return the real cargo to its source; never discard it or teleport it elsewhere.
    delete d.claims[a.id];a.task=null;a.delivering=true;
    const source=kind==='egg'?w.ground:kind==='gift'?w.chapter.output:kind==='flour'?w.bakery.flour:w.bakery.cakes;
    const at=kind==='egg'?{x:12.8,z:9.4}:kind==='gift'?chapterConfig.points.output:kind==='flour'?bakeryConfig.points.flourOutput:bakeryConfig.points.cakeOutput;
    go(at);if(near(a.position,at)&&n){const moved=transferItems(a.bag,source,kind,n);a.credit-=moved;fx(kind,moved,a.position,at);if(!a.bag.items[kind])a.delivering=false;}return;
  }
  if(!task){
    task=tasks.filter(t=>allowedTask(w,a,t.id)&&t.store.items[kind]+reserved(t)<t.fill&&canPick(t)>0).sort((x,y)=>score(x)-score(y)||x.id.localeCompare(y.id))[0];
    if(task){const batch=(kind==='egg'?farmCapacity(w).eggBatch:kind==='flour'?12:6)*cartFactor(w,a);
      const otherFloors=tasks.filter(t=>t.source===task!.source&&t.id!==task!.id).reduce((sum,t)=>sum+deficit(t),0);
      const budget=Math.max(deficit(task),freeSource(task)-otherFloors);
      const amount=Math.min(batch,a.bag.capacity-inventoryUsed(a.bag),task.fill-task.store.items[kind]-reserved(task),canPick(task),budget);
      if(amount>0){claim=d.claims[a.id]={task:task.id,item:kind,amount};a.task=task.id;a.delivering=false;}else task=undefined;
    }
  }
  if(!task){a.moving=false;a.path=[];return;}
  const target=Math.min(claim?.amount??a.bag.items[kind],task.fill-task.store.items[kind]-reserved(task));
  if(a.bag.items[kind]>=target||(a.bag.items[kind]>0&&canPick(task)===0))a.delivering=true;
  if(a.delivering&&claim&&a.bag.items[kind]>0)claim.amount=a.bag.items[kind];
  if(a.delivering&&a.bag.items[kind]){
    go(task.to);
    if(near(a.position,task.to)&&n){const moved=transferItems(a.bag,task.store,kind,Math.min(n,task.fill-task.store.items[kind]));a.credit-=moved;fx(kind,moved,a.position,task.to);
      if(claim)claim.amount=Math.max(a.bag.items[kind],claim.amount-moved);
      if(task.id==='truck')w.chapter.truck.loaded=task.store.items.gift;
      if(task.id==='pack')w.logistics.eggToPack+=moved;if(task.id==='oven'){w.logistics.eggToOven+=moved;if(['car_counter','walk_counter'].includes(a.job))w.logistics.originalToOven+=moved;}if(kind==='flour')w.logistics.flour+=moved;if(kind==='cake')w.logistics.cake+=moved;
      if(!a.bag.items[kind]){delete d.claims[a.id];a.task=null;a.delivering=false;a.deliveries++;}
    }
  }else{
    go(task.from);
    if(near(a.position,task.from)&&n){const moved=transferItems(task.source,a.bag,kind,Math.min(n,canPick(task),Math.max(0,target-a.bag.items[kind])));a.credit-=moved;fx(kind,moved,task.from,a.position);}
  }
}
export function updateWheatFarmer(w:World,a:Actor,dt:number,n:number,go:(p:Vec2)=>void,fx:Fx):void {
  if(a.bag.items.wheat>=16*cartFactor(w,a))a.delivering=true;if(!a.bag.items.wheat)a.delivering=false;
  const b=w.bakery;
  if(a.delivering){a.task='mill';go(bakeryConfig.points.millInput);if(near(a.position,bakeryConfig.points.millInput)&&n){const moved=transferItems(a.bag,b.millInput,'wheat',n);a.credit-=moved;fx('wheat',moved,a.position,bakeryConfig.points.millInput);}return;}
  const crop=b.crops.filter(c=>c.readyAt<=w.time).sort((x,y)=>Math.hypot(x.position.x-a.position.x,x.position.z-a.position.z)-Math.hypot(y.position.x-a.position.x,y.position.z-a.position.z))[0];
  a.task='harvest';if(crop){go(crop.position);if(near(a.position,crop.position)&&!a.cooldown){if(harvestWheat(w,crop,a))fx('wheat',1,crop.position,a.position);a.cooldown=.3;}}
  else if(a.bag.items.wheat)a.delivering=true;
}
