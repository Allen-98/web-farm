import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {migrateWorld,validateWorld,purchaseUpgrade,stepWorld,DT,createWorld,navigate} from '../src/domain/world.ts';
import {orderOffers,acceptOrder,claimOrder,orderReady,deliverOrder,ORDER_POINT,createOrders} from '../src/domain/orders.ts';
import {cycleSeconds,facilityStatuses} from '../src/domain/operations.ts';
import {BrowserPlatform} from '../src/platform/BrowserPlatform.ts';
import {availableCash} from '../src/domain/finance.ts';
import {transferItems} from '../src/domain/economy.ts';
import {updateChapter} from '../src/domain/chapter2.ts';
const checkpoints=JSON.parse(fs.readFileSync(new URL('../verification/capacity-checkpoints.json',import.meta.url)));
const world=()=>migrateWorld(structuredClone(checkpoints.expanded));
function advance(w,seconds){for(let i=0;i<seconds/DT;i++)stepWorld(w);}

test('v3.1 migration preserves all legacy fields and retains the exact original storage backup',()=>{
  const source=world();delete source.orders;source.upgrades=source.upgrades.slice(0,30);source.version='farm-v3.1';
  const before=structuredClone(source),w=migrateWorld(source),{orders,version,upgrades,...rest}=w,{version:oldVersion,upgrades:oldUpgrades,...oldRest}=before;
  assert.deepEqual(source,before);assert.deepEqual(rest,oldRest);assert.deepEqual(upgrades.slice(0,30),oldUpgrades);assert.deepEqual(orders,createOrders());validateWorld(w);
  const raw=JSON.stringify({schemaVersion:1,configVersion:oldVersion,world:source}),data=new Map([['farm-and-flow.save.v1',raw]]);
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const p=new BrowserPlatform(),loaded=p.load();assert.ok(loaded);assert.equal(data.get('farm-and-flow.save.v1.backup.v3.1-before-orders'),raw);assert.equal(p.save(loaded),true);validateWorld(p.load());
});

test('facility upgrades charge once, enforce levels, retain inventories and preserve completion fraction',()=>{
  const w=world(),cash=availableCash(w),input=w.chapter.input.items.egg,output=w.chapter.output.items.gift;
  w.chapter.progress=1.2;assert.equal(purchaseUpgrade(w,'speed_pack_table_2'),false);
  assert.equal(purchaseUpgrade(w,'speed_pack_table_1'),true);assert.ok(Math.abs(cycleSeconds(w,'pack_table')-1.6)<1e-9);
  assert.ok(Math.abs(w.chapter.progress-.8)<1e-9);assert.equal(w.chapter.input.items.egg,input);assert.equal(w.chapter.output.items.gift,output);
  assert.equal(availableCash(w),cash-350);assert.equal(purchaseUpgrade(w,'speed_pack_table_1'),false);validateWorld(w);
  assert.equal(purchaseUpgrade(createWorld(),'speed_oven_1'),false);
  // Compare an isolated supplied production line with ample output space.
  const base=world(),fast=structuredClone(base);purchaseUpgrade(fast,'speed_pack_table_1');purchaseUpgrade(fast,'speed_pack_table_2');
  for(const v of [base,fast]){v.chapter.progress=0;transferItems(v.chapter.output,v.player.bag,'gift',36);}
  const before=base.chapter.packed;
  for(let i=0;i<10/DT;i++){updateChapter(base,DT,()=>{});updateChapter(fast,DT,()=>{});}
  assert.ok(fast.chapter.packed-before>=1.8*(base.chapter.packed-before));validateWorld(base);validateWorld(fast);
});

test('existing employees complete a real mixed order without player input or stock grants, settling exactly once',()=>{
  const w=world();navigate(w,{x:41,z:16});const offer=orderOffers(w)[1];assert.ok(offer.requires.egg&&offer.requires.gift&&offer.requires.cake);
  assert.equal(acceptOrder(w,offer.id),true);assert.equal(acceptOrder(w,offer.id),false);assert.equal(claimOrder(w),0);
  for(let i=0;i<600/DT&&!orderReady(w);i++){stepWorld(w);if(i%300===0)validateWorld(w);}
  assert.equal(orderReady(w),true,JSON.stringify({order:w.orders.active,workers:w.workers.map(a=>({job:a.job,task:a.task,bag:a.bag.items,position:a.position}))}));
  const cash=availableCash(w);assert.equal(claimOrder(w),offer.reward);assert.equal(claimOrder(w),0);assert.equal(availableCash(w),cash+offer.reward);assert.equal(w.orders.completed,1);validateWorld(w);
  const clone=migrateWorld(JSON.parse(JSON.stringify(w)));advance(clone,10);advance(w,10);assert.deepEqual(clone,w);
});

test('manual drop-off respects requirements and persisted cargo; overtime keeps normal payout',()=>{
  const w=world(),offer=orderOffers(w)[2];acceptOrder(w,offer.id);
  for(const [source,item]of [[w.ground,'egg'],[w.chapter.output,'gift'],[w.bakery.cakes,'cake']])transferItems(source,w.player.bag,item,3);
  const moved=deliverOrder(w,w.player.bag,4);assert.equal(moved,4);validateWorld(w);
  const saved=migrateWorld(JSON.parse(JSON.stringify(w)));assert.deepEqual(saved.orders,w.orders);
  // Deadline fixture: let the accepted order expire before workers start delivery.
  w.tick+=Math.ceil(241/DT);w.time=w.tick*DT;assert.ok(w.orders.active);validateWorld(w);
  for(let i=0;i<600/DT&&!orderReady(w);i++)stepWorld(w);
  assert.equal(orderReady(w),true);assert.equal(claimOrder(w),offer.reward);validateWorld(w);
});

test('player walks to the delivery pad and unloads automatically; unavailable goods are never created',()=>{
  const w=world();acceptOrder(w,orderOffers(w)[0].id);transferItems(w.ground,w.player.bag,'egg',12);navigate(w,ORDER_POINT);
  for(let i=0;i<30/DT&&!orderReady(w);i++)stepWorld(w);
  assert.equal(orderReady(w),true);validateWorld(w);
  const empty=createWorld();assert.equal(orderOffers(empty).length,0);assert.equal(acceptOrder(empty,'0:0'),false);
});

test('an accepted contract remains unchanged when later facilities open',()=>{
  const w=createWorld();w.looseCash.cash=0;w.wallet.cash=10000;w.stats.earned=9950;
  purchaseUpgrade(w,'car_counter');acceptOrder(w,orderOffers(w)[1].id);const contract=structuredClone(w.orders.active.offer);
  for(const id of ['harvest_team','car_clerk','walk_counter','walk_expansion','harvester','walk_clerk','market_land','pack_table','gift_stall'])assert.equal(purchaseUpgrade(w,id),true);
  assert.deepEqual(w.orders.active.offer,contract);assert.equal(orderOffers(w)[1].requires.gift,4);validateWorld(w);
});

test('timely delivered rush bonuses survive late collection and repeated contracts scale at five completions',()=>{
  const w=world();navigate(w,{x:41,z:16});const offer=orderOffers(w)[2];acceptOrder(w,offer.id);
  for(let i=0;i<200/DT&&!orderReady(w);i++)stepWorld(w);
  assert.ok(orderReady(w));assert.ok(w.orders.active.readyAt-w.orders.active.acceptedAt<240);
  advance(w,260);assert.equal(claimOrder(w),offer.reward+offer.bonus);validateWorld(w);
  for(let round=0;round<5;round++){
    const offer=orderOffers(w)[0];acceptOrder(w,offer.id);
    for(let i=0;i<600/DT&&!orderReady(w);i++)stepWorld(w);
    assert.ok(orderReady(w));assert.ok(claimOrder(w)>0);validateWorld(w);
  }
  assert.equal(w.orders.completed,6);assert.ok(Object.values(orderOffers(w)[0].requires).some(n=>n>=6));
});

test('corrupt rewards, cargo and clocks are rejected, and facility status derives from inventories',()=>{
  const w=world();acceptOrder(w,orderOffers(w)[0].id);w.orders.active.offer.reward++;assert.throws(()=>validateWorld(w),/invalid active order/);
  const b=world();acceptOrder(b,orderOffers(b)[0].id);b.orders.active.stock.items.egg=999;assert.throws(()=>validateWorld(b));
  const c=world();c.chapter.progress=99;assert.throws(()=>validateWorld(c),/clock/);
  const d=world();assert.ok(facilityStatuses(d).every(f=>f.seconds>0&&f.state&&f.detail));
});
