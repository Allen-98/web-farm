import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {migrateWorld,validateWorld,purchaseUpgrade,stepWorld,navigate,DT} from '../src/domain/world.ts';
import {farmCapacity,capacityUpgrades} from '../src/domain/capacity.ts';
import {availableCash} from '../src/domain/finance.ts';
import {transferItems} from '../src/domain/economy.ts';
import {BrowserPlatform} from '../src/platform/BrowserPlatform.ts';
import {overviewFrame,clampZoom,MIN_ZOOM,MAX_ZOOM} from '../src/rendering/mapViewport.ts';
const old=JSON.parse(fs.readFileSync(new URL('../verification/chapter3-checkpoints.json',import.meta.url)));
const checkpoints=JSON.parse(fs.readFileSync(new URL('../verification/capacity-checkpoints.json',import.meta.url)));
const advance=(w,seconds)=>{for(let i=0;i<seconds/DT;i++)stepWorld(w);};

test('v3 save migration preserves every economic value and keeps the original backup',()=>{
  const source=structuredClone(old.baking),before=structuredClone(source),w=migrateWorld(source);
  assert.deepEqual(source,before);
  const {version,upgrades,...rest}=w,{version:oldVersion,upgrades:oldUpgrades,...oldRest}=before;
  assert.deepEqual(rest,oldRest);assert.deepEqual(upgrades.slice(0,24),oldUpgrades);
  assert.ok(upgrades.slice(24).every(u=>!u.unlocked&&u.paid===0));validateWorld(w);
  const raw=JSON.stringify({schemaVersion:1,configVersion:oldVersion,world:source}),data=new Map([['farm-and-flow.save.v1',raw]]);
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const platform=new BrowserPlatform(),loaded=platform.load();assert.ok(loaded);
  assert.equal(data.get('farm-and-flow.save.v1.backup.v3-before-capacity'),raw);
  assert.equal(platform.save(loaded),true);validateWorld(platform.load());
});

test('capacity purchases charge once, preserve stocks and existing production clocks, and respect tiers',()=>{
  const w=migrateWorld(structuredClone(checkpoints.capacity)),cash=availableCash(w),corn=w.stats.harvested,eggs=w.stats.produced,timers=[...w.production];
  assert.equal(purchaseUpgrade(w,'coop_2'),false);
  assert.equal(purchaseUpgrade(w,'corn_1'),true);assert.equal(purchaseUpgrade(w,'coop_1'),true);
  assert.equal(availableCash(w),cash-550);assert.equal(purchaseUpgrade(w,'corn_1'),false);
  assert.equal(w.stats.harvested,corn);assert.equal(w.stats.produced,eggs);
  assert.deepEqual(w.production.slice(0,6),timers);assert.deepEqual(w.production.slice(6),Array(6).fill(0));
  assert.equal(w.feed.capacity,240);assert.equal(w.ground.capacity,360);
  assert.ok(w.workers.filter(a=>a.job==='haul').every(a=>a.bag.capacity===40));validateWorld(w);
  const restored=migrateWorld(JSON.parse(JSON.stringify(w)));advance(w,20);advance(restored,20);assert.deepEqual(w,restored);validateWorld(w);
});

test('normal automated operation produces substantially more corn and eggs after expansion',()=>{
  const base=migrateWorld(structuredClone(old.baking)),expanded=migrateWorld(structuredClone(checkpoints.expanded));
  function measure(w){navigate(w,{x:41,z:16});advance(w,120);const before={...w.stats};advance(w,180);validateWorld(w);return {corn:w.stats.harvested-before.harvested,eggs:w.stats.produced-before.produced};}
  const baseline=measure(base),upgraded=measure(expanded);
  assert.ok(upgraded.corn>baseline.corn*1.4,JSON.stringify({baseline,upgraded}));
  assert.ok(upgraded.eggs>baseline.eggs*1.4,JSON.stringify({baseline,upgraded}));
  assert.equal(farmCapacity(expanded).chickens,24);assert.equal(farmCapacity(expanded).yield,4);
  console.log('180-second automated throughput',JSON.stringify({baseline,upgraded}));
});

test('expanded output never overflows or consumes feed when the egg area is full',()=>{
  const w=migrateWorld(structuredClone(checkpoints.expanded));
  const sources=[...w.workers.map(a=>a.bag),...w.stations.map(s=>s.stock),w.chapter.input,w.bakery.ovenEgg];
  for(const source of sources)transferItems(source,w.ground,'egg',w.ground.capacity-w.ground.items.egg);
  assert.equal(w.ground.items.egg,w.ground.capacity);validateWorld(w);
  // Keep all actors still for one frame. Their transfer credits cannot reach a whole item.
  for(const a of w.workers){a.credit=0;a.position={x:41,z:16};a.path=[];}
  const feed=w.feed.items.corn,produced=w.stats.produced;stepWorld(w);
  assert.equal(w.ground.items.egg,720);assert.equal(w.feed.items.corn,feed);assert.equal(w.stats.produced,produced);validateWorld(w);
});

test('expanded harvesting awards real extra units and respects the remaining bag space',()=>{
  const w=migrateWorld(structuredClone(checkpoints.expanded)),crop=w.crops.find(c=>c.readyAt<=w.time);
  transferItems(w.player.bag,w.bakery.stock,'cake',w.player.bag.items.cake);
  assert.ok(crop);assert.equal(Object.values(w.player.bag.items).reduce((a,b)=>a+b,0),0);
  w.player.position={...crop.position};w.player.path=[];w.navigationTarget=null;
  advance(w,.2);assert.ok(w.player.bag.items.corn>=4);assert.equal(w.player.bag.items.corn%4,0);validateWorld(w);
  transferItems(w.machine.bag,w.player.bag,'corn',59-w.player.bag.items.corn);
  const next=w.crops.find(c=>c.readyAt<=w.time);assert.ok(next);w.player.position={...next.position};advance(w,.2);
  assert.equal(w.player.bag.items.corn,60);validateWorld(w);
});

test('map overview and repeated zoom-out preserve the 57 percent readability limit',()=>{
  for(const [width,height]of [[1280,720],[393,852],[852,393]])for(const x of [18,35,54]){
    const frame=overviewFrame(width,height,{x,z:12});assert.equal(frame.zoom,.57);assert.ok(Number.isFinite(frame.x+frame.y));
    assert.equal(frame.x,(x-12)*34);
  }
  assert.equal(clampZoom(10),MAX_ZOOM);assert.equal(clampZoom(.001),MIN_ZOOM);
  let zoom=1.8;for(let i=0;i<100;i++)zoom=clampZoom(zoom/1.25);assert.equal(zoom,.57);
});
