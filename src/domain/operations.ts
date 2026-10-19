import type {World} from './world.ts';
import type {Vec2} from './contracts.ts';

export const FACILITIES = [
  {id:'car_counter',name:'汽车柜台',seconds:2.5,cost:180,position:{x:13,z:11.7}},
  {id:'walk_counter',name:'步行柜台',seconds:1.2,cost:200,position:{x:18,z:16.5}},
  {id:'pack_table',name:'包装台',seconds:2.4,cost:350,position:{x:28,z:9}},
  {id:'gift_stall',name:'礼盒摊',seconds:2,cost:400,position:{x:31.5,z:16}},
  {id:'mill',name:'磨坊',seconds:2,cost:500,position:{x:44,z:15}},
  {id:'oven',name:'烤炉',seconds:4,cost:650,position:{x:53,z:9.5}},
  {id:'cake_stall',name:'蛋糕摊',seconds:2.5,cost:750,position:{x:52,z:17}}
] as const;
export const operationsUpgrades=FACILITIES.flatMap(f=>[1,2].map(level=>({
  id:`speed_${f.id}_${level}`,label:`${f.name} · ${level===1?'提速':'精工'}`,
  description:`作业速度提升至基础的 ${level===1?'1.5':'2'} 倍，配方和单次售价保持不变`,
  cost:f.cost*(level===1?1:2),requires:[f.id,...(level===2?[`speed_${f.id}_1`]:[])],position:{...f.position}
})));
export function facilityLevel(w:World,id:string):number {return w.upgrades.filter(u=>u.unlocked&&u.id.startsWith(`speed_${id}_`)).length;}
export function cycleSeconds(w:World,id:string):number {const f=FACILITIES.find(f=>f.id===id);if(!f)throw new Error('Unknown facility');return f.seconds/(1+facilityLevel(w,id)*.5);}
export function rescaleClock(w:World,id:string,oldSeconds:number):void {
  const ratio=cycleSeconds(w,id)/oldSeconds;
  const s=w.stations.find(s=>s.id===id);if(s)s.service*=ratio;
  if(id==='pack_table')w.chapter.progress*=ratio;if(id==='gift_stall')w.chapter.retailTime*=ratio;
  if(id==='mill')w.bakery.millTime*=ratio;if(id==='oven')w.bakery.ovenTime*=ratio;if(id==='cake_stall')w.bakery.saleTime*=ratio;
}
export interface FacilityStatus {id:string;name:string;position:Vec2;level:number;state:string;detail:string;total:string;seconds:number;blocked:boolean}
/** Status is derived from authoritative inventories, never stored as UI state. */
export function facilityStatuses(w:World):FacilityStatus[] {
  const c=w.chapter,b=w.bakery;
  return FACILITIES.filter(f=>w.upgrades.some(u=>u.id===f.id&&u.unlocked)).map(f=>{
    let state='',detail='',total='',blocked=false;
    const s=w.stations.find(s=>s.id===f.id);
    if(s){blocked=s.stock.items.egg<s.order.eggsPerPack;state=blocked?'等待鸡蛋配送':'正在接待顾客';detail=`鸡蛋 ${s.stock.items.egg}/${s.stock.capacity} · 每单 ${s.order.eggsPerPack} 枚 / $${s.order.cashPerPack}`;total=`已完成 ${s.serial} 单 · 待收 $${s.pendingCash}`;}
    if(f.id==='pack_table'){blocked=c.output.items.gift>=c.output.capacity||c.input.items.egg<6;state=c.output.items.gift>=c.output.capacity?'成品仓满，等待搬运':c.input.items.egg<6?'缺鸡蛋':'正在包装';detail=`鸡蛋 ${c.input.items.egg}/120 · 礼盒 ${c.output.items.gift}/36 · 6 枚 → 1 盒`;total=`累计包装 ${c.packed} 盒`;}
    if(f.id==='gift_stall'){blocked=!c.stock.items.gift;state=blocked?'等待礼盒配送':'正在出售';detail=`礼盒 ${c.stock.items.gift}/36 · 每盒 $20`;total=`累计售出 ${c.retailSold} 盒 · 待收 $${c.pendingCash}`;}
    if(f.id==='mill'){blocked=b.flour.items.flour>=60||b.millInput.items.wheat<3;state=b.flour.items.flour>=60?'面粉仓满，等待搬运':b.millInput.items.wheat<3?'缺小麦':'正在研磨';detail=`小麦 ${b.millInput.items.wheat}/120 · 面粉 ${b.flour.items.flour}/60 · 3 份 → 1 袋`;total=`累计研磨 ${b.milled} 袋`;}
    if(f.id==='oven'){blocked=b.cakes.items.cake>=36||b.ovenFlour.items.flour<2||b.ovenEgg.items.egg<2;state=b.cakes.items.cake>=36?'蛋糕仓满，等待搬运':b.ovenFlour.items.flour<2&&b.ovenEgg.items.egg<2?'缺面粉和鸡蛋':b.ovenFlour.items.flour<2?'缺面粉':b.ovenEgg.items.egg<2?'缺鸡蛋':'正在烘烤';detail=`面粉 ${b.ovenFlour.items.flour}/60 · 鸡蛋 ${b.ovenEgg.items.egg}/60 · 蛋糕 ${b.cakes.items.cake}/36`;total=`累计烘烤 ${b.baked} 个`;}
    if(f.id==='cake_stall'){blocked=!b.stock.items.cake;state=blocked?'等待蛋糕配送':'正在出售';detail=`蛋糕 ${b.stock.items.cake}/60 · 每个 $40`;total=`累计售出 ${b.sold} 个 · 待收 $${b.pendingCash}`;}
    return {...f,level:facilityLevel(w,f.id),seconds:cycleSeconds(w,f.id),state,detail,total,blocked};
  });
}
