import fs from 'node:fs';
import {createWorld,stepWorld,navigate,getGoal,unlocked,validateWorld,DT} from '../src/domain/world.ts';
const w=createWorld(),checkpoints={};
for(let i=0;i<3000/DT;i++){
  if(i%15===0)navigate(w,getGoal(w).target);
  stepWorld(w);
  for(const [name,ready]of Object.entries({packing:unlocked(w,'gift_stall'),truck:unlocked(w,'wholesale')&&w.chapter.truck.loaded===8,dispatch:unlocked(w,'wholesale')&&w.chapter.truck.loaded===11,automated:unlocked(w,'packer')})){
    if(ready&&!checkpoints[name]){validateWorld(w);checkpoints[name]=structuredClone(w);}
  }
  if(checkpoints.automated)break;
}
if(Object.keys(checkpoints).length!==4)throw new Error('Missing naturally played checkpoint');
fs.writeFileSync(new URL('./chapter2-checkpoints.json',import.meta.url),JSON.stringify(checkpoints));
console.log(Object.fromEntries(Object.entries(checkpoints).map(([key,w])=>[key,{seconds:w.time,cash:w.wallet.cash,chapter:w.chapter.truck}])));
