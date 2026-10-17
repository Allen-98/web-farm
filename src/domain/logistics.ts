import {farmCapacity} from './capacity.ts';
import { chapterConfig, has } from './chapter2.ts';
import { bakeryConfig, harvestWheat } from './bakery.ts';
import { transferItems } from './economy.ts';
import type { World, Actor } from './world.ts';
import type { Item, Vec2, Inventory } from './contracts.ts';
type Fx=(item:Item|'cash',n:number,from:Vec2,to:Vec2)=>void;
interface Task {id:string;item:Item;source:Inventory;store:Inventory;from:Vec2;to:Vec2;fill:number;priority:number}
const near=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z)<.95;
export const JOB_NAMES:Record<string,string>={harvest:'收割工',haul:'饲料运输',car_counter:'店员·跨区供货',walk_counter:'店员·跨区供货',packer:'包装工',egg_courier:'运蛋员',gift_courier:'礼盒配送',wheat_farmer:'麦农',baker:'烘焙师',cake_courier:'蛋糕配送',cashier:'收款员'};
export const TASK_NAMES:Record<string,string>={car_counter:'汽车柜台补蛋',walk_counter:'步行柜台补蛋',pack:'包装台送蛋',oven:'烤炉送蛋',gift:'礼盒摊补货',truck:'批发装车',flour:'烤炉送面粉',cake:'蛋糕摊补货',deposit:'去 ATM 存款',harvest:'收割小麦',mill:'磨坊送小麦'};
export function courierTasks(w:World,a:Actor,kind:Item):Task[]{
  if(kind==='egg'){
    const tasks:Task[]=w.stations.filter(s=>s.enabled).map(s=>({id:s.id,item:'egg',source:w.ground,store:s.stock,from:{x:12.8,z:9.4},to:s.id==='car_counter'?{x:13,z:11.7}:{x:18,z:16.5},fill:has(w,'pack_table')?18:48,priority:s.stock.items.egg<4?.35:1.3}));
    if(has(w,'pack_table'))tasks.push({id:'pack',item:'egg',source:w.ground,store:w.chapter.input,from:{x:12.8,z:9.4},to:chapterConfig.points.input,fill:30,priority:1});
    if(has(w,'oven'))tasks.push({id:'oven',item:'egg',source:w.ground,store:w.bakery.ovenEgg,from:{x:12.8,z:9.4},to:bakeryConfig.points.eggInput,fill:16,priority:.8});
    const factor=farmCapacity(w).coopLevel+1;
    for(const task of tasks)task.fill=Math.min(task.store.capacity,task.fill*factor);
    return a.job==='baker'?tasks.filter(t=>t.id==='oven'):tasks;
  }
  if(kind==='gift'){
    const tasks:Task[]=[];
    if(has(w,'gift_stall'))tasks.push({id:'gift',item:'gift',source:w.chapter.output,store:w.chapter.stock,from:chapterConfig.points.output,to:chapterConfig.points.supply,fill:6,priority:1});
    if(has(w,'wholesale')&&!w.chapter.truck.cooldown){
      // A view onto the authoritative truck counter, updated after each transfer.
      tasks.push({id:'truck',item:'gift',source:w.chapter.output,store:{capacity:12,items:{corn:0,egg:0,gift:w.chapter.truck.loaded,wheat:0,flour:0,cake:0}},from:chapterConfig.points.output,to:chapterConfig.points.loading,fill:12,priority:a.deliveries%3===0?2:.25});
    }
    return tasks;
  }
  if(kind==='flour')return has(w,'oven')?[{id:'flour',item:'flour',source:w.bakery.flour,store:w.bakery.ovenFlour,from:bakeryConfig.points.flourOutput,to:bakeryConfig.points.flourInput,fill:24,priority:1}]:[];
  if(kind==='cake')return has(w,'cake_stall')?[{id:'cake',item:'cake',source:w.bakery.cakes,store:w.bakery.stock,from:bakeryConfig.points.cakeOutput,to:bakeryConfig.points.cakeSupply,fill:12,priority:1}]:[];
  return [];
}
export function updateCourier(w:World,a:Actor,kind:Item,n:number,go:(p:Vec2)=>void,fx:Fx):void {
  const tasks=courierTasks(w,a,kind);
  const eggBatch=farmCapacity(w).eggBatch;
  const reserved=(t:Task)=>w.workers.filter(o=>o!==a&&o.task===t.id).reduce((sum,o)=>sum+Math.max(o.bag.items[kind],kind==='egg'?eggBatch:4),0);
  let task=tasks.find(t=>t.id===a.task);
  if(!task||task.store.items[kind]>=task.fill){
    task=tasks.filter(t=>t.store.items[kind]+reserved(t)<t.fill&&(a.bag.items[kind]>0||t.source.items[kind]>0)).sort((x,y)=>(x.store.items[kind]+reserved(x))/x.fill*x.priority+x.priority-(y.store.items[kind]+reserved(y))/y.fill*y.priority-y.priority)[0];
    a.task=task?.id??null;a.delivering=!!a.bag.items[kind];
  }
  if(!task){a.moving=false;return;}
  const batch=Math.min(kind==='egg'?eggBatch:kind==='flour'?12:6,task.fill-task.store.items[kind]);
  if(a.bag.items[kind]>=batch||(a.bag.items[kind]>0&&!task.source.items[kind]))a.delivering=true;
  if(a.delivering&&a.bag.items[kind]){
    go(task.to);
    if(near(a.position,task.to)&&n){const moved=transferItems(a.bag,task.store,kind,Math.min(n,task.fill-task.store.items[kind]));a.credit-=moved;fx(kind,moved,a.position,task.to);
      if(task.id==='truck')w.chapter.truck.loaded=task.store.items.gift;
      if(task.id==='pack')w.logistics.eggToPack+=moved;if(task.id==='oven'){w.logistics.eggToOven+=moved;if(['car_counter','walk_counter'].includes(a.job))w.logistics.originalToOven+=moved;}if(kind==='flour')w.logistics.flour+=moved;if(kind==='cake')w.logistics.cake+=moved;
      if(!a.bag.items[kind]){a.task=null;a.delivering=false;a.deliveries++;}
    }
  }else{
    go(task.from);
    if(near(a.position,task.from)&&n){const moved=transferItems(task.source,a.bag,kind,Math.min(n,Math.max(0,batch-a.bag.items[kind])));a.credit-=moved;fx(kind,moved,task.from,a.position);}
  }
}
export function updateWheatFarmer(w:World,a:Actor,dt:number,n:number,go:(p:Vec2)=>void,fx:Fx):void {
  if(a.bag.items.wheat>=16)a.delivering=true;if(!a.bag.items.wheat)a.delivering=false;
  const b=w.bakery;
  if(a.delivering){a.task='mill';go(bakeryConfig.points.millInput);if(near(a.position,bakeryConfig.points.millInput)&&n){const moved=transferItems(a.bag,b.millInput,'wheat',n);a.credit-=moved;fx('wheat',moved,a.position,bakeryConfig.points.millInput);}return;}
  const crop=b.crops.filter(c=>c.readyAt<=w.time).sort((x,y)=>Math.hypot(x.position.x-a.position.x,x.position.z-a.position.z)-Math.hypot(y.position.x-a.position.x,y.position.z-a.position.z))[0];
  a.task='harvest';if(crop){go(crop.position);if(near(a.position,crop.position)&&!a.cooldown){if(harvestWheat(w,crop,a))fx('wheat',1,crop.position,a.position);a.cooldown=.3;}}
  else if(a.bag.items.wheat)a.delivering=true;
}
