import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stepWorld,validateWorld,map} from '../src/domain/world.ts';
import {BrowserPlatform} from '../src/platform/BrowserPlatform.ts';

test('browser storage adapter restores real progress with valid schema',()=>{
  const data=new Map();globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const platform=new BrowserPlatform(),w=createWorld();for(let i=0;i<300;i++)stepWorld(w,{x:1,z:0});
  assert.equal(platform.save(w),true);const restored=platform.load();assert.ok(restored);assert.equal(restored.tick,w.tick);assert.deepEqual(restored.player.position,w.player.position);validateWorld(restored);
  assert.equal(data.has('farm-and-flow.save.v1.pending'),false);
  platform.clear();assert.equal(platform.load(),null);
});

test('corrupt inventory, prerequisite edits and non-finite timers are rejected',()=>{
  const w=createWorld();w.wallet.cash=100;assert.throws(()=>validateWorld(w),/conservation/);
  const a=createWorld();a.upgrades[1].requires=[];assert.throws(()=>validateWorld(a),/prerequisite/);
  const b=createWorld();b.production[0]=NaN;assert.throws(()=>validateWorld(b),/non-finite/);
});

test('an unreadable existing save cannot be replaced by a new farm during autosave',()=>{
  const data=new Map([['farm-and-flow.save.v1','{broken save']]);
  globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const platform=new BrowserPlatform();assert.equal(platform.load(),null);assert.equal(platform.loadFailed,true);
  assert.equal(platform.save(createWorld()),false);assert.equal(data.get('farm-and-flow.save.v1'),'{broken save');
});

test('restoring an older layout relocates investment pads while preserving progress',()=>{
  const data=new Map();globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const platform=new BrowserPlatform(),w=createWorld();
  for(let i=0;i<300;i++)stepWorld(w,{x:1,z:0});
  w.upgrades.find(u=>u.id==='walk_expansion').position={x:17,z:17};
  assert.equal(platform.save(w),true);
  const restored=platform.load();assert.ok(restored);
  const pad=map.investmentZones.find(z=>z.upgradeId==='walk_expansion');
  assert.deepEqual(restored.upgrades.find(u=>u.id==='walk_expansion').position,{x:pad.x,z:pad.z});
  assert.deepEqual(restored.stats,w.stats);assert.deepEqual(restored.wallet,w.wallet);
  assert.deepEqual(restored.upgrades.map(({position,...u})=>u),w.upgrades.map(({position,...u})=>u));
  assert.deepEqual(restored.player.bag,w.player.bag);assert.equal(restored.tick,w.tick);validateWorld(restored);
});
