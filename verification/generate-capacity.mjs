import fs from 'node:fs';
import {migrateWorld,stepWorld,purchaseUpgrade,validateWorld,navigate,DT} from '../src/domain/world.ts';
import {capacityUpgrades} from '../src/domain/capacity.ts';
import {availableCash} from '../src/domain/finance.ts';
const old=JSON.parse(fs.readFileSync(new URL('./chapter3-checkpoints.json',import.meta.url)));
const w=migrateWorld(structuredClone(old.baking));
navigate(w,{x:41,z:16});
const checkpoints={};
for(let i=0;i<6000/DT;i++){
  if(i%30===0){
    if(!checkpoints.capacity&&availableCash(w)>=600)checkpoints.capacity=structuredClone(w);
    if(checkpoints.capacity)for(const spec of capacityUpgrades)purchaseUpgrade(w,spec.id);
  }
  stepWorld(w);
  if(i%900===0)validateWorld(w);
  if(capacityUpgrades.every(spec=>w.upgrades.find(u=>u.id===spec.id).unlocked)){
    for(let j=0;j<3600;j++)stepWorld(w);
    validateWorld(w);checkpoints.expanded=structuredClone(w);break;
  }
}
if(!checkpoints.expanded)throw new Error('Capacity progression stalled');
fs.writeFileSync(new URL('./capacity-checkpoints.json',import.meta.url),JSON.stringify(checkpoints));
console.log(Object.fromEntries(Object.entries(checkpoints).map(([name,w])=>[name,{time:w.time,balance:availableCash(w),corn:w.stats.harvested,eggs:w.stats.produced,chickens:w.production.length,feed:w.feed.items.corn,ground:w.ground.items.egg}])));
