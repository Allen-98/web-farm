import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, navigate, getGoal, distance, validateWorld, unlocked, DT } from '../src/domain/world.ts';

function conservation(w) {
  const corn=w.feed.items.corn+w.player.bag.items.corn+w.machine.bag.items.corn+w.workers.reduce((n,a)=>n+a.bag.items.corn,0);
  const eggs=w.ground.items.egg+w.player.bag.items.egg+w.workers.reduce((n,a)=>n+a.bag.items.egg,0)+w.stations.reduce((n,s)=>n+s.stock.items.egg,0);
  assert.equal(w.stats.harvested,corn+w.stats.produced,'corn conserved through processing');
  assert.equal(w.stats.produced,eggs+w.chapter.input.items.egg+w.chapter.packed*6+w.stats.eggsSold,'eggs conserved through sales');
  assert.equal(50+w.stats.earned,w.wallet.cash+w.looseCash.cash+w.stations.reduce((n,s)=>n+s.pendingCash,0)+w.upgrades.reduce((n,u)=>n+u.paid,0)+w.chapter.pendingCash+w.chapter.truck.pendingCash,'cash conserved through investment');
  validateWorld(w);
}
function drive(w,maxSeconds,until=()=>false) {
  const ticks=Math.ceil(maxSeconds/DT);
  for(let i=0;i<ticks;i++){
    if(i%15===0){const goal=getGoal(w);if(distance(w.player.position,goal.target)>.25&&(!w.player.path.length||distance(w.player.path.at(-1),goal.target)>.6))navigate(w,goal.target);}
    stepWorld(w);
    if(i%300===0)conservation(w);
    if(until(w))return;
  }
}
test('normal guided movement builds the first shop and completes a real sale',()=>{
  const w=createWorld();drive(w,300,w=>w.stats.eggsSold>=6&&w.stats.collected>50);
  assert.ok(unlocked(w,'car_counter'));
  assert.ok(w.stats.harvested>=6);
  assert.ok(w.stats.produced>=6);
  assert.ok(w.stats.eggsSold>=6,JSON.stringify({goal:getGoal(w),position:w.player.position,bag:w.player.bag,stats:w.stats}));
  assert.ok(w.stats.collected>50);conservation(w);
});
test('full progression reaches employees, second channel, machinery and both clerks without grants',()=>{
  const w=createWorld();drive(w,2400,w=>w.upgrades.slice(0,7).every(u=>u.unlocked));
  assert.ok(w.upgrades.slice(0,7).every(u=>u.unlocked),JSON.stringify({time:w.time,goal:getGoal(w),position:w.player.position,bag:w.player.bag,feed:w.feed.items.corn,eggs:w.ground.items.egg,upgrades:w.upgrades,workers:w.workers}));
  assert.equal(w.workers.length,5);assert.equal(w.machine.active,true);assert.equal(w.workers.filter(a=>a.job==='haul').length,3);
  const before=w.stats.produced;for(let i=0;i<1800;i++)stepWorld(w);
  assert.ok(w.stats.produced>before,'automation continues without player input');conservation(w);
});
test('serialization and restoring the simulation preserve every economic resource',()=>{
  const w=createWorld();drive(w,80);const clone=JSON.parse(JSON.stringify(w));validateWorld(clone);
  for(let i=0;i<600;i++){stepWorld(w);stepWorld(clone);}
  assert.deepEqual(clone,w);conservation(clone);
});
test('navigation routes around chicken-house obstacle and respects world bounds',()=>{
  const w=createWorld();navigate(w,{x:15,z:5});
  for(let i=0;i<600;i++)stepWorld(w);
  assert.ok(distance(w.player.position,{x:15,z:5})<.2);
  for(let i=0;i<1500;i++)stepWorld(w,{x:-1,z:0});
  assert.ok(w.player.position.x>=6.6);
  conservation(w);
});


test('chapter two guided play builds every facility and fulfills a wholesale order without grants',()=>{
  const w=createWorld();drive(w,3000,w=>w.upgrades.slice(0,12).every(u=>u.unlocked));
  assert.ok(w.upgrades.slice(0,12).every(u=>u.unlocked),JSON.stringify({goal:getGoal(w),position:w.player.position,bag:w.player.bag,chapter:w.chapter,upgrades:w.upgrades,workers:w.workers}));
  assert.ok(w.chapter.retailSold>=4);assert.ok(w.chapter.truck.delivered>=1);assert.equal(w.workers.length,6);
  const before=w.chapter.truck.delivered;for(let i=0;i<18000;i++)stepWorld(w);
  assert.ok(w.chapter.truck.delivered>before,JSON.stringify({message:'packer sustains production and loads subsequent trucks without player input',chapter:w.chapter,packer:w.workers.find(a=>a.job==='packer'),ground:w.ground,stats:w.stats}));
  conservation(w);
});
