import fs from 'node:fs';
import {createWorld,stepWorld,navigate,getGoal,purchaseUpgrade,unlocked,validateWorld,DT} from '../src/domain/world.ts';
import {bakeryConfig} from '../src/domain/bakery.ts';
import {cashSources,availableCash,ATM} from '../src/domain/finance.ts';
const checkpoints={},w=createWorld();
for(let i=0;i<3600/DT;i++){
  if(i%15===0){navigate(w,getGoal(w).target);for(const spec of bakeryConfig.automation)purchaseUpgrade(w,spec.id);}
  stepWorld(w);
  if(unlocked(w,'cake_stall')&&!checkpoints.bakery){validateWorld(w);checkpoints.bakery=structuredClone(w);}
  if(w.bakery.sold>=3&&w.upgrades.slice(0,24).every(u=>u.unlocked)){validateWorld(w);checkpoints.baking=structuredClone(w);break;}
}
if(!checkpoints.baking)throw new Error('Baking checkpoint not reached');
navigate(w,ATM);for(let i=0;i<3000;i++){stepWorld(w);if(!w.player.path.length)break;}
validateWorld(w);checkpoints.bank=structuredClone(w);
const hire=createWorld();
for(let i=0;i<1800/DT;i++){
  if(i%15===0){if(!unlocked(hire,'gift_stall'))navigate(hire,getGoal(hire).target);else navigate(hire,cashSources(hire).sort((a,b)=>b.amount-a.amount)[0].at);}
  stepWorld(hire);if(unlocked(hire,'gift_stall')&&availableCash(hire)>=650)break;
}
validateWorld(hire);checkpoints.staff=hire;
fs.writeFileSync(new URL('./chapter3-checkpoints.json',import.meta.url),JSON.stringify(checkpoints));
console.log(Object.fromEntries(Object.entries(checkpoints).map(([id,w])=>[id,{seconds:w.time,balance:availableCash(w),sold:w.bakery.sold,staff:w.workers.length,logistics:w.logistics}])));
