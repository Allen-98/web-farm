import type {World} from './world.ts';
import {facilityStatuses} from './operations.ts';
export interface Activity {work:number;missing:number;full:number;cycles:number}
export interface Meter {corn:number;egg:number;wheat:number;flour:number;gift:number;cake:number;eggUsed:number;revenue:number}
export interface Sample {second:number;duration:number;flow:Meter;facilities:Record<string,Activity>}
export interface TelemetryState {samples:Sample[];pendingRevenue:number}
export const emptyMeter=():Meter=>({corn:0,egg:0,wheat:0,flour:0,gift:0,cake:0,eggUsed:0,revenue:0});
export const createTelemetry=():TelemetryState=>({samples:[],pendingRevenue:0});
export function counters(w:World):Meter{return {corn:w.stats.harvested,egg:w.stats.produced,wheat:w.bakery.harvested,flour:w.bakery.milled,gift:w.chapter.packed,cake:w.bakery.baked,eggUsed:w.stats.eggsSold+w.chapter.packed*6+w.bakery.baked*2+w.orders.delivered.egg+(w.orders.active?.stock.items.egg??0),revenue:w.stats.earned};}
export function measureStart(w:World){return {counts:counters(w),retail:[w.chapter.retailSold,w.bakery.sold],states:facilityStatuses(w)};}
export function recordTelemetry(w:World,dt:number,before:ReturnType<typeof measureStart>):void {
  const samples=w.telemetry.samples,second=Math.floor((w.tick-1)*dt);
  if(samples.at(-1)?.second!==second){samples.push({second,duration:0,flow:emptyMeter(),facilities:{}});if(samples.length>60)samples.shift();}
  const s=samples.at(-1)!,after=counters(w);s.duration+=dt;
  for(const key of Object.keys(after)as (keyof Meter)[])s.flow[key]+=after[key]-before.counts[key];
  s.flow.revenue+=w.telemetry.pendingRevenue;w.telemetry.pendingRevenue=0;
  for(const f of before.states){
    const a=s.facilities[f.id]??={work:0,missing:0,full:0,cycles:0};
    if(!f.blocked)a.work+=dt;else if(f.state.includes('仓满'))a.full+=dt;else a.missing+=dt;
    if(f.id==='car_counter'||f.id==='walk_counter'){if(w.stations.find(s=>s.id===f.id)!.lastSale===w.time)a.cycles++;}
    else {const key=f.id==='pack_table'?'gift':f.id==='mill'?'flour':f.id==='oven'?'cake':null;if(key)a.cycles+=after[key]-before.counts[key];else if(f.id==='gift_stall')a.cycles+=w.chapter.retailSold-before.retail[0];else if(f.id==='cake_stall')a.cycles+=w.bakery.sold-before.retail[1];}
  }
}
export function productionReport(w:World){
  const flow=emptyMeter(),facilities:Record<string,Activity>={};let duration=0;
  for(const s of w.telemetry.samples){duration+=s.duration;for(const key of Object.keys(flow)as(keyof Meter)[])flow[key]+=s.flow[key];for(const [id,v]of Object.entries(s.facilities)){const a=facilities[id]??={work:0,missing:0,full:0,cycles:0};for(const k of ['work','missing','full','cycles']as const)a[k]+=v[k];}}
  flow.revenue+=w.telemetry.pendingRevenue;
  const rows=facilityStatuses(w).map(f=>{const a=facilities[f.id]??{work:0,missing:0,full:0,cycles:0},observed=a.work+a.missing+a.full;let advice='运行平稳，可按订单需求安排生产';
    if(observed<10)advice='样本积累中，经营满 10 秒后判断瓶颈';
    else if(a.full>observed*.2)advice='成品积压：增加配送运力或优先补给下游销售';
    else if(a.missing>observed*.2){
      if(f.id==='mill')advice='小麦不足：检查麦农是否到岗，或给麦农升级推车';
      else if(f.id==='oven')advice=w.bakery.ovenFlour.items.flour<2?(w.bakery.flour.items.flour>=2?'磨坊有面粉：检查烘焙师分工，并升级跨区运力':'面粉生产不足：检查磨坊供料与加工速度'):(w.ground.items.egg>=2?'鸡舍有鸡蛋：提高烤炉保底库存，检查运蛋员分工':'鸡蛋不足：扩建鸡舍，并检查玉米与饲料供应');
      else if(['car_counter','walk_counter','pack_table'].includes(f.id))advice=w.ground.items.egg>=6?'鸡舍有库存：检查配送分工、任务预留与推车运力':'鸡蛋生产不足：检查饲料，再扩建玉米田和鸡舍';
      else if(f.id==='gift_stall')advice=w.chapter.output.items.gift?'包装台有礼盒：检查礼盒配送分工和推车运力':'礼盒产量不足：检查包装台供蛋与加工速度';
      else advice=w.bakery.cakes.items.cake?'烤炉有蛋糕：检查蛋糕配送分工和推车运力':'蛋糕产量不足：检查烤炉的鸡蛋与面粉供应';
    }
    return {...f,...a,observed,utilization:observed?a.work/observed:0,perMinute:observed?a.cycles*60/observed:0,advice};
  });return {duration,flow,rows};
}
export function validateTelemetry(w:World):void {
  const samples=w.telemetry?.samples;if(!Array.isArray(samples)||samples.length>60||!Number.isSafeInteger(w.telemetry.pendingRevenue)||w.telemetry.pendingRevenue<0||w.telemetry.pendingRevenue>w.orders.revenue)throw new Error('invalid telemetry');let last=-1;
  for(const s of samples){if(!Number.isSafeInteger(s.second)||s.second<=last||s.second>w.time||!Number.isFinite(s.duration)||s.duration<=0||s.duration>1.001||!s.flow||Object.keys(s.flow).length!==8||!s.facilities)throw new Error('invalid telemetry sample');last=s.second;
    for(const k of Object.keys(emptyMeter())as(keyof Meter)[])if(!Number.isSafeInteger(s.flow[k])||s.flow[k]<0)throw new Error('invalid telemetry flow');
    for(const [id,a]of Object.entries(s.facilities)){if(!['car_counter','walk_counter','pack_table','gift_stall','mill','oven','cake_stall'].includes(id)||!Number.isSafeInteger(a.cycles)||a.cycles<0||[a.work,a.missing,a.full].some(n=>!Number.isFinite(n)||n<0)||a.work+a.missing+a.full>s.duration+.001)throw new Error('invalid telemetry activity');}
  }
}
