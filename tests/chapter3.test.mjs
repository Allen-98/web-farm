import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stepWorld,navigate,getGoal,purchaseUpgrade,validateWorld,migrateWorld,DT,unlocked} from '../src/domain/world.ts';
import {availableCash,collectionRate,cashSources} from '../src/domain/finance.ts';
import {bakeryConfig} from '../src/domain/bakery.ts';
import {BrowserPlatform} from '../src/platform/BrowserPlatform.ts';

function drive(w,maxSeconds,until,hire=false){
  for(let i=0;i<maxSeconds/DT;i++){
    if(i%15===0){navigate(w,getGoal(w).target);if(hire)for(const u of bakeryConfig.automation)purchaseUpgrade(w,u.id);}
    stepWorld(w);if(i%600===0)validateWorld(w);if(until(w))return;
  }
  assert.fail(JSON.stringify({goal:getGoal(w),bag:w.player.bag,bakery:w.bakery,logistics:w.logistics,upgrades:w.upgrades,workers:w.workers}));
}
test('three chapters and recruited staff sustain cakes, gifts and bank deposits without player input',()=>{
  const w=createWorld();drive(w,3600,w=>w.upgrades.slice(0,24).every(u=>u.unlocked),true);
  assert.equal(w.workers.length,12);assert.ok(w.bakery.sold>=0);const before={sold:w.bakery.sold,packed:w.chapter.packed,deposits:w.bank.deposited,ovens:w.logistics.eggToOven};
  // Stop the player on empty ground so all further baking and deposits are employee work.
  navigate(w,{x:41,z:16});for(let i=0;i<18000;i++)stepWorld(w);
  assert.ok(w.bakery.sold>before.sold,JSON.stringify({b:w.bakery,workers:w.workers}));
  assert.ok(w.chapter.packed>before.packed);assert.ok(w.bank.deposited>before.deposits);assert.ok(w.logistics.eggToOven>before.ovens);
  assert.equal(w.wallet.cash,0);validateWorld(w);
  const restored=JSON.parse(JSON.stringify(w));for(let i=0;i<360;i++){stepWorld(w);stepWorld(restored);}assert.deepEqual(restored,w);validateWorld(restored);
});
test('original clerks deliver farm eggs across chapters even without hiring a courier',()=>{
  const w=createWorld();drive(w,2400,w=>unlocked(w,'cake_stall'));
  const before=w.logistics.eggToOven;for(let i=0;i<9000;i++)stepWorld(w);
  assert.ok(w.logistics.eggToPack>0);assert.ok(w.logistics.originalToOven>0);assert.equal(unlocked(w,'egg_courier'),false);validateWorld(w);
});
test('construction with enough money completes after a short dwell and collection scales with the pile',()=>{
  const w=createWorld();w.looseCash.cash=0;w.wallet.cash=50;w.stats.collected=50;w.player.position={...w.upgrades[0].position};
  for(let i=0;i<7;i++)stepWorld(w);assert.equal(w.upgrades[0].paid,0);
  for(let i=0;i<3;i++)stepWorld(w);assert.equal(w.upgrades[0].paid,50);assert.equal(w.wallet.cash,0);validateWorld(w);
  assert.equal(collectionRate(w,50),60);assert.ok(collectionRate(w,100000)>30000);
});
test('a large cash pile is fully collected in about 1.5 seconds without losing money',()=>{
  const w=createWorld();w.looseCash.cash=0;w.wallet.cash=50;w.stats.collected=50;w.player.position={...w.upgrades[0].position};for(let i=0;i<10;i++)stepWorld(w);
  // Isolated transaction fixture: a counter with a large already-earned pending payment.
  w.stations[0].pendingCash=100000;w.stats.earned=100000;w.player.position={x:13,z:14};validateWorld(w);
  for(let i=0;i<60;i++)stepWorld(w);
  assert.equal(w.stations[0].pendingCash,0);assert.equal(w.wallet.cash,100000);validateWorld(w);
});
test('second-chapter saves migrate all existing progress without adding money or hires',()=>{
  const w=createWorld();drive(w,1800,w=>w.upgrades.slice(0,12).every(u=>u.unlocked));
  const old=structuredClone(w);old.version='farm-v2.0';old.upgrades=old.upgrades.slice(0,12);delete old.bakery;delete old.bank;delete old.logistics;
  for(const a of [old.player,...old.workers]){delete a.cash;delete a.task;delete a.deliveries;}
  for(const store of [old.player.bag,old.feed,old.ground,old.machine.bag,...old.workers.map(a=>a.bag),...old.stations.map(s=>s.stock),old.chapter.input,old.chapter.output,old.chapter.stock])for(const key of ['wheat','flour','cake'])delete store.items[key];
  const next=migrateWorld(old);assert.deepEqual(next.wallet,old.wallet);assert.deepEqual(next.stats,old.stats);assert.deepEqual(next.chapter.packed,old.chapter.packed);assert.deepEqual(next.upgrades.slice(0,12),old.upgrades);assert.equal(next.bank.cash,0);assert.equal(next.workers.length,old.workers.length);validateWorld(next);
  // Real v1-to-v2 migrated saves may not contain display labels.
  for(const u of old.upgrades)delete u.label;
  const raw=JSON.stringify({schemaVersion:1,configVersion:'farm-v2.0',world:old}),data=new Map([['farm-and-flow.save.v1',raw]]);
  globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const platform=new BrowserPlatform(),loaded=platform.load();assert.ok(loaded);assert.equal(loaded.upgrades.find(u=>u.id==='packer').label,'雇佣包装工');assert.equal(platform.migratedFrom,'farm-v2.0');assert.equal(data.get('farm-and-flow.save.v1.backup.v2-before-chapter3'),raw);assert.equal(platform.save(loaded),true);validateWorld(platform.load());
});
test('recruitment and bank construction charge real income once and reject duplicate hires',()=>{
  const w=createWorld();drive(w,1800,w=>unlocked(w,'gift_stall'));
  for(let i=0;i<36000&&availableCash(w)<1000;i++){if(i%15===0){const source=cashSources(w).sort((a,b)=>b.amount-a.amount)[0];navigate(w,source.at);}stepWorld(w);}
  const before=availableCash(w);assert.equal(purchaseUpgrade(w,'bank_atm'),true);assert.equal(availableCash(w),before-250);assert.equal(w.wallet.cash,0);
  assert.equal(purchaseUpgrade(w,'cashier'),true);assert.equal(availableCash(w),before-550);assert.equal(purchaseUpgrade(w,'cashier'),false);validateWorld(w);
});
