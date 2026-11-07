import {withoutMapState,withoutPositions} from './map-state.mjs';
import {bakeryConfig} from '../src/domain/bakery.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {migrateWorld,validateWorld,stepWorld,DT,purchaseUpgrade,navigate} from '../src/domain/world.ts';
import {setPolicy,setFloor,configureWorker,cartLevel,createDispatch} from '../src/domain/dispatch.ts';
import {productionReport,counters} from '../src/domain/telemetry.ts';
import {acceptOrder,orderOffers,orderReady,claimOrder} from '../src/domain/orders.ts';
import {updateCourier,courierTasks} from '../src/domain/logistics.ts';
import {BrowserPlatform} from '../src/platform/BrowserPlatform.ts';
import {availableCash} from '../src/domain/finance.ts';
import {transferItems} from '../src/domain/economy.ts';
const snapshots=JSON.parse(fs.readFileSync(new URL('../verification/operations-checkpoints.json',import.meta.url)));
const world=()=>migrateWorld(structuredClone(snapshots.operations));
const advance=(w,seconds)=>{for(let i=0;i<seconds/DT;i++)stepWorld(w);};
const emptyAssignment=w=>{w.dispatch.claims={};for(const a of w.workers){a.task=null;a.path=[];a.delivering=false;}};
const clearOven=w=>{transferItems(w.ground,w.stations[0].stock,'egg',60);transferItems(w.bakery.ovenEgg,w.ground,'egg',60);};

test('0.2 saves keep all money, cargo, accepted orders and employee progress, with exact backup',()=>{
  const old=structuredClone(snapshots.delivering),before=structuredClone(old),w=migrateWorld(old);
  assert.deepEqual(old,before);const {version,upgrades,dispatch,telemetry,...rest}=w,{version:ov,upgrades:ou,...oldRest}=before;
  assert.deepEqual(withoutMapState(rest),withoutMapState(oldRest));assert.deepEqual(withoutPositions(upgrades.slice(0,44)),withoutPositions(ou));assert.deepEqual(dispatch,createDispatch());assert.equal(telemetry.samples.length,0);validateWorld(w);
  const raw=JSON.stringify({schemaVersion:1,configVersion:ov,world:before}),data=new Map([['farm-and-flow.save.v1',raw]]);
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const platform=new BrowserPlatform(),loaded=platform.load();assert.ok(loaded);assert.equal(data.get('farm-and-flow.save.v1.backup.v3.2-before-dispatch'),raw);
  assert.ok(platform.save(loaded));const restored=platform.load();assert.deepEqual(restored.orders,w.orders);validateWorld(restored);
});

test('three policies select different real tasks; safety floors are honored before orders',()=>{
  const base=world();emptyAssignment(base);for(const key of Object.keys(base.dispatch.floors))setFloor(base,key,0);
  acceptOrder(base,orderOffers(base)[1].id);
  for(const policy of ['balanced','orders','processing']){
    const w=structuredClone(base);setPolicy(w,policy);const a=w.workers.find(a=>a.id==='clerk-car');a.position={x:12.8,z:9.4};
    updateCourier(w,a,'egg',0,()=>{},()=>{});
    assert.ok(a.task);if(policy==='orders')assert.equal(a.task,'order_egg');if(policy==='processing')assert.ok(['pack','oven'].includes(a.task));
  }
  const w=structuredClone(base);setPolicy(w,'orders');setFloor(w,'oven',12);clearOven(w);
  const a=w.workers.find(a=>a.id==='clerk-car');a.position={x:12.8,z:9.4};updateCourier(w,a,'egg',20,()=>{},()=>{});
  assert.equal(a.task,'oven');assert.ok(w.dispatch.claims[a.id].amount>=12);assert.equal(a.bag.items.egg,20);validateWorld(w);
});

test('reservations hold exact destination amounts and cannot overbook a near-full order',()=>{
  const w=world();emptyAssignment(w);for(const key of Object.keys(w.dispatch.floors))setFloor(w,key,0);setPolicy(w,'orders');acceptOrder(w,orderOffers(w)[0].id);
  const needed=w.orders.active.offer.requires.egg;transferItems(w.ground,w.orders.active.stock,'egg',needed-3);
  const workers=w.workers.filter(a=>['car_counter','walk_counter','egg_courier'].includes(a.job));
  for(const a of workers){transferItems(a.bag,w.ground,'egg',a.bag.items.egg);a.position={x:12.8,z:9.4};updateCourier(w,a,'egg',0,()=>{},()=>{});}
  const claims=Object.values(w.dispatch.claims).filter(c=>c.task==='order_egg');assert.equal(claims.reduce((n,c)=>n+c.amount,0),3);validateWorld(w);
});

test('scopes and specializations govern new trips while already-loaded cargo finishes safely',()=>{
  const w=world();emptyAssignment(w);const a=w.workers.find(a=>a.id==='clerk-car');
  assert.ok(configureWorker(w,a.id,'bakery','oven'));assert.equal(configureWorker(w,a.id,'market','oven'),false);
  clearOven(w);a.position={x:12.8,z:9.4};updateCourier(w,a,'egg',100,()=>{},()=>{});assert.equal(a.task,'oven');assert.ok(a.bag.items.egg>0);
  const cargo=a.bag.items.egg;assert.ok(configureWorker(w,a.id,'farm','car_counter'));setPolicy(w,'orders');assert.equal(a.task,'oven');
  a.position={...bakeryConfig.points.eggInput};updateCourier(w,a,'egg',100,()=>{},()=>{});assert.equal(a.bag.items.egg,0);assert.equal(w.bakery.ovenEgg.items.egg,cargo);assert.equal(a.task,null);validateWorld(w);
});

test('invalidated delivery returns cargo to its source without losses',()=>{
  const w=world();emptyAssignment(w);const a=w.workers.find(a=>a.id==='clerk-car');
  acceptOrder(w,orderOffers(w)[0].id);for(const key of Object.keys(w.dispatch.floors))setFloor(w,key,0);setPolicy(w,'orders');
  a.position={x:12.8,z:9.4};updateCourier(w,a,'egg',100,()=>{},()=>{});assert.equal(a.task,'order_egg');const held=a.bag.items.egg;assert.ok(held);
  transferItems(w.ground,w.orders.active.stock,'egg',w.orders.active.offer.requires.egg);assert.ok(claimOrder(w));const before=w.ground.items.egg;
  updateCourier(w,a,'egg',100,()=>{},()=>{});assert.equal(a.bag.items.egg,0);assert.equal(w.ground.items.egg,before+held);assert.equal(w.dispatch.claims[a.id],undefined);validateWorld(w);
});

test('cart tiers debit once, enlarge true capacity and reservations, and retain existing goods',()=>{
  const w=world(),a=w.workers.find(a=>a.job==='egg_courier'),cash=availableCash(w),capacity=a.bag.capacity,goods=structuredClone(a.bag.items);
  assert.equal(purchaseUpgrade(w,`cart_${a.id}_2`),false);assert.ok(purchaseUpgrade(w,`cart_${a.id}_1`));assert.equal(availableCash(w),cash-180);assert.equal(a.bag.capacity,capacity*2);assert.deepEqual(a.bag.items,goods);assert.equal(cartLevel(w,a),1);
  assert.equal(purchaseUpgrade(w,`cart_${a.id}_1`),false);assert.ok(purchaseUpgrade(w,`cart_${a.id}_2`));assert.equal(a.bag.capacity,capacity*3);assert.equal(availableCash(w),cash-580);validateWorld(w);
  const saved=migrateWorld(JSON.parse(JSON.stringify(w)));advance(w,10);advance(saved,10);assert.deepEqual(w,saved);validateWorld(w);
});

test('a cart actually doubles a flour pickup batch and increases movement during delivery',()=>{
  const base=world();emptyAssignment(base);const a=base.workers.find(a=>a.job==='baker');
  transferItems(base.bakery.ovenFlour,base.player.bag,'flour',60);transferItems(a.bag,base.player.bag,'flour',60);assert.equal(a.bag.items.flour,0);
  configureWorker(base,a.id,'bakery','flour');setFloor(base,'flour',0);a.position={...bakeryConfig.points.flourOutput};a.credit=0;
  const fast=structuredClone(base),b=fast.workers.find(b=>b.id===a.id);assert.ok(purchaseUpgrade(fast,`cart_${b.id}_1`));
  updateCourier(base,a,'flour',100,()=>{},()=>{});updateCourier(fast,b,'flour',100,()=>{},()=>{});
  assert.equal(a.bag.items.flour,12);assert.equal(b.bag.items.flour,24);
  const start={...a.position};advance(base,.5);advance(fast,.5);
  const traveled=p=>Math.hypot(p.x-start.x,p.z-start.z);assert.ok(traveled(b.position)>traveled(a.position)*1.05);validateWorld(base);validateWorld(fast);
});

test('order reward claimed while paused is counted immediately and exactly once in the report',()=>{
  const w=migrateWorld(structuredClone(snapshots.settlement));advance(w,.1);const before=productionReport(w).flow.revenue,stats=w.stats.earned,reward=claimOrder(w);
  assert.ok(reward);assert.equal(productionReport(w).flow.revenue,before+reward);assert.equal(w.stats.earned,stats+reward);assert.equal(claimOrder(w),0);validateWorld(w);
  const restored=migrateWorld(JSON.parse(JSON.stringify(w)));advance(restored,.1);assert.equal(restored.telemetry.pendingRevenue,0);assert.ok(productionReport(restored).flow.revenue>=before+reward);validateWorld(restored);
});

test('60-second report measures actual production, consumption, sales and blockage without adding goods',()=>{
  const w=world();navigate(w,{x:40,z:17.5});const before=counters(w);advance(w,20);const after=counters(w),r=productionReport(w);
  assert.ok(Math.abs(r.duration-20)<1e-8);for(const key of Object.keys(before))assert.equal(r.flow[key],after[key]-before[key]);
  for(const f of r.rows){assert.ok(f.utilization>=0&&f.utilization<=1);assert.ok(Math.abs(f.work+f.missing+f.full-20)<1e-7);assert.ok(f.advice);}
  advance(w,70);assert.ok(w.telemetry.samples.length<=60);assert.ok(productionReport(w).duration<=60.001);validateWorld(w);
  const report=structuredClone(productionReport(w));validateWorld(w);assert.deepEqual(productionReport(w),report);
});

test('bottleneck advice distinguishes missing source production from missing delivery',()=>{
  const w=world(),sample={second:Math.floor(w.time),duration:1,flow:{corn:0,egg:0,wheat:0,flour:0,gift:0,cake:0,eggUsed:0,revenue:0},facilities:{oven:{work:0,missing:1,full:0,cycles:0}}};
  w.telemetry.samples=Array.from({length:20},(_,i)=>({...structuredClone(sample),second:Math.floor(w.time)-19+i}));
  transferItems(w.bakery.ovenFlour,w.bakery.flour,'flour',60);assert.match(productionReport(w).rows.find(r=>r.id==='oven').advice,/磨坊有面粉/);
  transferItems(w.bakery.flour,w.player.bag,'flour',60);assert.match(productionReport(w).rows.find(r=>r.id==='oven').advice,/面粉生产不足/);
});

test('malformed settings, over-sized reservations and invalid telemetry cannot overwrite a save',()=>{
  const w=world();assert.equal(setFloor(w,'oven',-1),false);assert.equal(setFloor(w,'oven',999),false);assert.equal(setFloor(w,'oven',2.1),false);
  w.dispatch.policy='broken';assert.throws(()=>validateWorld(w),/dispatch/);
  const a=world();a.dispatch.claims.unknown={task:'oven',item:'egg',amount:999};assert.throws(()=>validateWorld(a),/reservation/);
  const b=world();advance(b,1);b.telemetry.samples[0].flow.egg=-1;assert.throws(()=>validateWorld(b),/telemetry/);
});

test('real scheduled workers sustain all chapters and settle an order after upgrading carts',()=>{
  const w=world();navigate(w,{x:40,z:17.5});setPolicy(w,'orders');
  for(const a of w.workers.filter(a=>['egg_courier','gift_courier','baker','cake_courier'].includes(a.job)))purchaseUpgrade(w,`cart_${a.id}_1`);
  const egg=w.workers.find(a=>a.job==='egg_courier');configureWorker(w,egg.id,'bakery','oven');
  acceptOrder(w,orderOffers(w)[1].id);const sold=w.bakery.sold,packed=w.chapter.packed;
  for(let i=0;i<600/DT&&!orderReady(w);i++){stepWorld(w);if(i%900===0)validateWorld(w);}
  assert.ok(orderReady(w));assert.ok(claimOrder(w));advance(w,120);assert.ok(w.bakery.sold>sold);assert.ok(w.chapter.packed>packed);assert.ok(productionReport(w).flow.revenue>0);validateWorld(w);
});
