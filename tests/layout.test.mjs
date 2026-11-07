import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,migrateWorld,validateWorld,walkable,findPath,navigate,stepWorld,distance,EGG_PICKUP,DT,UPGRADE_SPECS} from '../src/domain/world.ts';
import {bakeryConfig} from '../src/domain/bakery.ts';
import {chapterConfig} from '../src/domain/chapter2.ts';
import {REGION_CENTERS} from '../src/domain/layout.ts';
import {BrowserPlatform} from '../src/platform/BrowserPlatform.ts';
import {withoutMapState} from './map-state.mjs';
const checkpoints=JSON.parse(fs.readFileSync(new URL('../verification/dispatch-checkpoints.json',import.meta.url)));
const world=()=>migrateWorld(structuredClone(checkpoints.dispatch_carts));
const length=(from,path)=>path.reduce((s,p,i)=>s+distance(i?path[i-1]:from,p),0);

test('compact map gates the south plot and connects all production and navigation destinations',()=>{
  const closed=createWorld();
  assert.equal(walkable(closed,bakeryConfig.points.gate),true);
  assert.equal(walkable(closed,REGION_CENTERS.bakery),false);
  assert.equal(walkable(closed,REGION_CENTERS.market),false);
  const w=world();assert.equal(walkable(w,{x:35,z:30}),false);
  for(const p of [...Object.values(REGION_CENTERS),...Object.values(chapterConfig.points),...Object.values(bakeryConfig.points),...bakeryConfig.upgrades.map(u=>u.position),...bakeryConfig.automation.map(u=>u.position)]){
    assert.ok(walkable(w,p),JSON.stringify(p));const path=findPath(w,EGG_PICKUP,p);
    assert.ok(path.length,JSON.stringify(p));assert.ok(path.every(p=>walkable(w,p)));
  }
  for(const from of Object.values(REGION_CENTERS))for(const to of Object.values(REGION_CENTERS))assert.ok(findPath(w,from,to).length);
});

test('farm eggs reach the relocated oven with at least 35 percent less walking',()=>{
  const path=findPath(world(),EGG_PICKUP,bakeryConfig.points.eggInput);
  const oldUnobstructedMinimum=Math.hypot(53-EGG_PICKUP.x,9.5-EGG_PICKUP.z);
  assert.ok(path.length);assert.ok(length(EGG_PICKUP,path)<oldUnobstructedMinimum*.65);
});

test('a fractional position at the L corner can walk into the bakery without getting stuck',()=>{
  const w=world();w.player.position={x:25.516173169074882,z:18.266031829381348};
  const target={x:7.5,z:30};navigate(w,target);assert.ok(w.player.path.length);
  for(let i=0;i<20/DT;i++){stepWorld(w);assert.ok(walkable(w,w.player.position));}
  assert.ok(distance(w.player.position,target)<.01,JSON.stringify(w.player.position));validateWorld(w);
});

test('v3.3 map migration preserves every economic value, active dispatch and original backup',()=>{
  const old=structuredClone(checkpoints.dispatch_carts),before=structuredClone(old),w=migrateWorld(old);
  assert.equal(old.version,'farm-v3.3');assert.deepEqual(old,before);
  const {version,...current}=w,{version:previousVersion,...previous}=before;
  assert.deepEqual(withoutMapState(current),withoutMapState(previous));
  assert.ok([w.player,...w.workers].every(a=>walkable(w,a.position)&&a.path.length===0));
  for(const u of w.upgrades){const p=UPGRADE_SPECS.find(s=>s.id===u.id).position;assert.deepEqual(u.position,{x:p.x,z:p.z});}
  assert.deepEqual(migrateWorld(structuredClone(w)),w);validateWorld(w);
  const raw=JSON.stringify({schemaVersion:1,configVersion:previousVersion,world:before}),data=new Map([['farm-and-flow.save.v1',raw]]);
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const platform=new BrowserPlatform(),loaded=platform.load();assert.ok(loaded);
  assert.equal(data.get('farm-and-flow.save.v1.backup.v3.3-before-compact-map'),raw);
  assert.ok(platform.save(loaded));validateWorld(platform.load());
});
