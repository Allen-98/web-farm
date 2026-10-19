import fs from 'node:fs';
import {migrateWorld,stepWorld,validateWorld,DT,navigate,purchaseUpgrade} from '../src/domain/world.ts';
import {orderOffers,acceptOrder,orderReady} from '../src/domain/orders.ts';
const previous=JSON.parse(fs.readFileSync(new URL('./capacity-checkpoints.json',import.meta.url)));
const w=migrateWorld(structuredClone(previous.expanded));
navigate(w,{x:23,z:13});
for(let i=0;i<30/DT&&w.player.path.length;i++)stepWorld(w);
validateWorld(w);
const checkpoints={operations:structuredClone(w)};
acceptOrder(w,orderOffers(w)[1].id);
for(let i=0;i<600/DT;i++){
  stepWorld(w);if(i%300===0)validateWorld(w);
  if(!checkpoints.delivering&&w.orders.active.stock.items.egg>=1)checkpoints.delivering=structuredClone(w);
  if(orderReady(w)){checkpoints.settlement=structuredClone(w);break;}
}
if(!checkpoints.settlement)throw new Error('Order delivery stalled');
purchaseUpgrade(w,'speed_pack_table_1');purchaseUpgrade(w,'speed_oven_1');validateWorld(w);
checkpoints.upgraded=structuredClone(w);
fs.writeFileSync(new URL('./operations-checkpoints.json',import.meta.url),JSON.stringify(checkpoints));
fs.writeFileSync(new URL('./playtest.html',import.meta.url),fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').replace('/src/main.ts','/verification/playtest.ts'));
console.log(Object.fromEntries(Object.entries(checkpoints).map(([name,w])=>[name,{time:w.time,order:w.orders.active?.stock.items}])));
