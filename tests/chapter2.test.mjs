import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, getGoal, navigate, DT, unlocked, validateWorld } from '../src/domain/world.ts';
import { chapterConfig, updateChapter, chapterInteract } from '../src/domain/chapter2.ts';
import { BrowserPlatform } from '../src/platform/BrowserPlatform.ts';

function drive(w,until,max=3000){for(let i=0;i<max/DT;i++){if(i%15===0)navigate(w,getGoal(w).target);stepWorld(w);if(until(w))return;}assert.fail(JSON.stringify({goal:getGoal(w),chapter:w.chapter}));}
function legacySnapshot(w){const old=structuredClone(w);old.version='farm-v1.0';old.upgrades=old.upgrades.slice(0,7);delete old.chapter;for(const b of [old.player.bag,old.feed,old.ground,old.machine.bag,...old.workers.map(a=>a.bag),...old.stations.map(s=>s.stock)])delete b.items.gift;return old;}
function storage(){const data=new Map();globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};return data;}

test('a completed first-chapter save migrates with cash, inventories, employees and investments intact',()=>{
  const w=createWorld();drive(w,w=>w.upgrades.slice(0,7).every(u=>u.unlocked));
  const old=legacySnapshot(w),data=storage(),raw=JSON.stringify({schemaVersion:1,configVersion:old.version,world:old});data.set('farm-and-flow.save.v1',raw);
  const platform=new BrowserPlatform(),loaded=platform.load();assert.ok(loaded);
  assert.deepEqual(loaded.wallet,old.wallet);assert.deepEqual(loaded.stats,old.stats);
  assert.deepEqual(loaded.upgrades.slice(0,7).map(u=>({id:u.id,paid:u.paid,unlocked:u.unlocked})),old.upgrades.map(u=>({id:u.id,paid:u.paid,unlocked:u.unlocked})));
  assert.deepEqual(loaded.workers.map(a=>({id:a.id,job:a.job,position:a.position})),old.workers.map(a=>({id:a.id,job:a.job,position:a.position})));
  assert.equal(loaded.player.bag.items.egg,old.player.bag.items.egg);assert.equal(loaded.player.bag.items.corn,old.player.bag.items.corn);
  assert.equal(data.get('farm-and-flow.save.v1.backup.v1-before-chapter2'),raw);
  assert.equal(loaded.chapter.packed,0);assert.equal(loaded.upgrades[7].paid,0);assert.equal(platform.save(loaded),true);validateWorld(platform.load());
});

test('partial first-chapter saves migrate without completing unpaid construction',()=>{
  const w=createWorld();w.looseCash.cash=0;w.wallet.cash=33;w.stats.collected=50;w.upgrades[0].paid=17;
  const old=legacySnapshot(w),data=storage();data.set('farm-and-flow.save.v1',JSON.stringify({schemaVersion:1,configVersion:old.version,world:old}));
  const loaded=new BrowserPlatform().load();assert.ok(loaded);assert.equal(loaded.upgrades[0].paid,old.upgrades[0].paid);assert.equal(loaded.upgrades[0].unlocked,false);validateWorld(loaded);
});

test('full packaging output preserves eggs and resumes only when there is storage',()=>{
  const w=createWorld();w.upgrades.find(u=>u.id==='pack_table').unlocked=true;
  const c=w.chapter;c.input.items.egg=12;c.output.items.gift=c.output.capacity;
  for(let i=0;i<300;i++)updateChapter(w,DT,()=>{});
  assert.equal(c.input.items.egg,12);assert.equal(c.packed,0);
  c.output.items.gift--;for(let i=0;i<74;i++)updateChapter(w,DT,()=>{});
  assert.equal(c.input.items.egg,6);assert.equal(c.output.items.gift,c.output.capacity);assert.equal(c.packed,1);
});

test('a full truck settles exactly once, returns, and preserves incomplete cargo across save/load',()=>{
  const w=createWorld();drive(w,w=>unlocked(w,'wholesale'));
  const c=w.chapter;c.truck.loaded=chapterConfig.wholesale.boxes-1;c.packed+=c.truck.loaded;w.stats.produced+=c.truck.loaded*6;w.stats.harvested+=c.truck.loaded*6;
  w.player.bag.items.gift=1;c.packed++;w.stats.produced+=6;w.stats.harvested+=6;
  validateWorld(w);storage();const platform=new BrowserPlatform();assert.equal(platform.save(w),true);
  const restored=platform.load();assert.ok(restored);assert.equal(restored.chapter.truck.loaded,11);
  chapterInteract(restored,'truck-load',4,()=>{});const earned=restored.stats.earned;updateChapter(restored,DT,()=>{});
  assert.equal(restored.chapter.truck.delivered,1);assert.equal(restored.chapter.truck.loaded,0);assert.equal(restored.stats.earned,earned+300);
  for(let i=0;i<500;i++)updateChapter(restored,DT,()=>{});
  assert.equal(restored.chapter.truck.delivered,1);assert.equal(restored.chapter.truck.cooldown,0);validateWorld(restored);
});

test('tampered chapter inventory and cargo loss are rejected',()=>{
  const w=createWorld();w.chapter.output.items.gift=1;assert.throws(()=>validateWorld(w),/gift conservation/);
  const a=createWorld();a.chapter.truck.loaded=-1;assert.throws(()=>validateWorld(a),/invalid quantities/);
});
