import type {World,Actor} from './world.ts';
import type {Item} from './contracts.ts';

export const POLICIES={balanced:'均衡经营',orders:'订单优先',processing:'加工优先'} as const;
export const AREAS={all:'跨区机动',farm:'鸡蛋农场',market:'乡间集市',bakery:'烘焙工坊',orders:'订单交货'} as const;
export const FLOOR_NAMES={car_counter:'汽车柜台 · 鸡蛋',walk_counter:'步行柜台 · 鸡蛋',pack:'包装台 · 鸡蛋',oven:'烤炉 · 鸡蛋',flour:'烤炉 · 面粉',gift:'礼盒摊 · 礼盒',cake:'蛋糕摊 · 蛋糕'} as const;
export const FLOOR_LIMITS={car_counter:48,walk_counter:48,pack:60,oven:30,flour:30,gift:18,cake:24};
export const TASK_AREA:Record<string,keyof typeof AREAS>={car_counter:'farm',walk_counter:'farm',pack:'market',oven:'bakery',flour:'bakery',gift:'market',truck:'market',cake:'bakery',order_egg:'orders',order_gift:'orders',order_cake:'orders'};
export const TASK_TITLES:Record<string,string>={car_counter:'汽车柜台补蛋',walk_counter:'步行柜台补蛋',pack:'包装台送蛋',oven:'烤炉送蛋',flour:'烤炉送面粉',gift:'礼盒摊补货',truck:'批发装车',cake:'蛋糕摊补货',order_egg:'订单送蛋',order_gift:'订单送礼盒',order_cake:'订单送蛋糕'};
export interface Assignment {area:keyof typeof AREAS;focus:string}
export interface Claim {task:string;item:Item;amount:number}
export interface DispatchState {policy:keyof typeof POLICIES;floors:Record<keyof typeof FLOOR_NAMES,number>;assignments:Record<string,Assignment>;claims:Record<string,Claim>}
export function createDispatch():DispatchState{return {policy:'balanced',floors:{car_counter:6,walk_counter:4,pack:6,oven:2,flour:2,gift:1,cake:1},assignments:{},claims:{}};}
export function supportedTasks(a:Actor):string[]{
  if(['car_counter','walk_counter','egg_courier'].includes(a.job))return ['car_counter','walk_counter','pack','oven','order_egg'];
  if(a.job==='packer')return ['pack','gift','truck','order_egg','order_gift','car_counter','walk_counter','oven'];
  if(a.job==='baker')return ['oven','flour'];
  if(a.job==='gift_courier')return ['gift','truck','order_gift'];
  if(a.job==='cake_courier')return ['cake','order_cake'];
  return [];
}
export function assignment(w:World,a:Actor):Assignment{return w.dispatch.assignments[a.id]??{area:'all',focus:'auto'};}
export function allowedTask(w:World,a:Actor,id:string):boolean {const s=assignment(w,a);return supportedTasks(a).includes(id)&&(s.area==='all'||TASK_AREA[id]===s.area)&&(s.focus==='auto'||s.focus===id);}
export function configureWorker(w:World,id:string,area:Assignment['area'],focus='auto'):boolean {
  const a=w.workers.find(a=>a.id===id);if(!a||!(area in AREAS)||!supportedTasks(a).length||!(focus==='auto'||supportedTasks(a).includes(focus))||(focus!=='auto'&&area!=='all'&&TASK_AREA[focus]!==area))return false;
  w.dispatch.assignments[id]={area,focus};
  if(!Object.values(a.bag.items).some(Boolean)){delete w.dispatch.claims[id];a.task=null;a.path=[];a.delivering=false;}
  return true;
}
export function setPolicy(w:World,policy:DispatchState['policy']):boolean {
  if(!(policy in POLICIES))return false;w.dispatch.policy=policy;
  for(const a of w.workers)if(!Object.values(a.bag.items).some(Boolean)){delete w.dispatch.claims[a.id];a.task=null;a.path=[];}
  return true;
}
export function setFloor(w:World,id:keyof typeof FLOOR_NAMES,value:number):boolean {
  if(!(id in FLOOR_NAMES)||!Number.isSafeInteger(value)||value<0||value>FLOOR_LIMITS[id])return false;
  w.dispatch.floors[id]=value;return true;
}
const CART_STAFF=[['harvest-0','harvest_team'],['harvest-1','harvest_team'],['harvest-2','harvest_team'],['clerk-car','car_clerk'],['clerk-walk','walk_clerk'],['packer','packer'],['egg_courier','egg_courier'],['gift_courier','gift_courier'],['wheat_farmer','wheat_farmer'],['baker','baker'],['cake_courier','cake_courier']];
export const cartUpgrades=CART_STAFF.flatMap(([id,hire])=>[1,2].map(level=>({id:`cart_${id}_${level}`,label:`${id} · ${level===1?'运输推车':'加固推车'}`,cost:level===1?180:400,requires:[hire,...(level===2?[`cart_${id}_1`]:[])],position:{x:24,z:13}})));
export function cartLevel(w:World,a:Actor):number {return [1,2].filter(n=>w.upgrades.some(u=>u.id===`cart_${a.id}_${n}`&&u.unlocked)).length;}
export function cartFactor(w:World,a:Actor):number{return 1+cartLevel(w,a);}
export function validateDispatch(w:World):void {
  const d=w.dispatch;if(!d||!Object.hasOwn(POLICIES,d.policy)||!d.floors||!d.assignments||!d.claims)throw new Error('invalid dispatch');
  if(Object.keys(d.floors).length!==Object.keys(FLOOR_NAMES).length)throw new Error('invalid floors');
  for(const [id,max]of Object.entries(FLOOR_LIMITS)){const v=d.floors[id as keyof typeof FLOOR_NAMES];if(!Number.isSafeInteger(v)||v<0||v>max)throw new Error('invalid floor');}
  for(const [id,s]of Object.entries(d.assignments)){const a=w.workers.find(a=>a.id===id);if(!a||!Object.hasOwn(AREAS,s.area)||!supportedTasks(a).length||!(s.focus==='auto'||supportedTasks(a).includes(s.focus))||(s.focus!=='auto'&&s.area!=='all'&&TASK_AREA[s.focus]!==s.area))throw new Error('invalid assignment');}
  const taskItems:Record<string,Item>={car_counter:'egg',walk_counter:'egg',pack:'egg',oven:'egg',flour:'flour',gift:'gift',truck:'gift',cake:'cake',order_egg:'egg',order_gift:'gift',order_cake:'cake'};
  for(const [id,c]of Object.entries(d.claims)){const a=w.workers.find(a=>a.id===id);if(!a||a.task!==c.task||!supportedTasks(a).includes(c.task)||taskItems[c.task]!==c.item||!Number.isSafeInteger(c.amount)||c.amount<1||c.amount>a.bag.capacity)throw new Error('invalid reservation');}
}
