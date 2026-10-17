import tuning from '../content/tuning.json' with {type:'json'};
import {chapterConfig} from './chapter2.ts';
import {inventoryUsed} from './economy.ts';
import type {World} from './world.ts';
const DT=1/tuning.simulation.tickHz;
const unlocked=(w:World,id:string)=>w.upgrades.some(u=>u.id===id&&u.unlocked);
const eligible=(w:World,id:string)=>(id!=='wholesale'||w.chapter.retailSold>=4)&&(id!=='packer'||w.chapter.truck.delivered>=1);
export function validatePreviousWorld(w: World, legacy=false): void {
  if (w.version !== (legacy?'farm-v1.0':'farm-v2.0') || !Number.isSafeInteger(w.tick) || w.tick < 0) throw new Error('unsupported save');
  if (w.crops.length !== 48 || w.upgrades.length !== (legacy?7:12) || w.stations.length !== 2 || w.production.length !== 6 || w.workers.length > (legacy?5:6)) throw new Error('invalid world shape');
  const integers = [w.wallet.cash, w.looseCash.cash, ...Object.values(w.stats)];
  for (const s of w.stations) integers.push(s.pendingCash, s.serial, s.order.packsRemaining);
  if (integers.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('invalid quantities');
  [w.player.bag, w.feed, w.ground, w.machine.bag, ...w.workers.map(a => a.bag), ...w.stations.map(s => s.stock)].forEach(inventoryUsed);
  for (const a of [w.player, ...w.workers]) if (!Number.isFinite(a.position.x) || !Number.isFinite(a.position.z)) throw new Error('invalid actor position');
  for (let i = 0; i < w.upgrades.length; i++) { const u = w.upgrades[i], spec = [...tuning.upgrades,...chapterConfig.upgrades][i]; if (u.id !== spec.id || u.cost !== spec.cost || !Number.isSafeInteger(u.paid) || u.paid < 0 || u.paid > u.cost || u.unlocked !== (u.paid === u.cost) || (u.unlocked && !spec.requires.every(id => unlocked(w, id)))) throw new Error('invalid progression'); }
  const finite=(value:unknown):void=>{if(typeof value==='number'&&!Number.isFinite(value))throw new Error('non-finite value');if(value&&typeof value==='object')for(const child of Object.values(value))finite(child);};finite(w);
  if(w.time!==w.tick*DT||w.player.bag.capacity!==60||w.feed.capacity!==120||w.ground.capacity!==180||w.machine.bag.capacity!==120||w.looseCash.cash>50)throw new Error('invalid world limits');
  if(w.production.some(n=>n<0||n>tuning.farm.productionSecondsPerChicken))throw new Error('invalid production clock');
  const allowedJobs=new Set(['harvest','haul','car_counter','walk_counter',...(legacy?[]:['packer'])]);
  for(const a of w.workers)if(!allowedJobs.has(a.job)||a.path.length>300||typeof a.delivering!=='boolean')throw new Error('invalid worker');
  for(let i=0;i<w.stations.length;i++){const s=w.stations[i],spec=tuning.stations[i];if(s.id!==spec.id||s.enabled!==unlocked(w,s.id)||s.order.eggsPerPack!==spec.eggsPerPack||s.order.cashPerPack!==spec.cashPerPack||s.order.packsRemaining<1||s.order.packsRemaining>2||s.stock.capacity!==(i===1&&unlocked(w,'walk_expansion')?240:120))throw new Error('invalid station');}
  for(let i=0;i<w.upgrades.length;i++)if(JSON.stringify(w.upgrades[i].requires)!==JSON.stringify([...tuning.upgrades,...chapterConfig.upgrades][i].requires))throw new Error('invalid prerequisite');
  const heldCorn=w.feed.items.corn+w.machine.bag.items.corn+w.player.bag.items.corn+w.workers.reduce((n,a)=>n+a.bag.items.corn,0);
  let heldEggs=w.ground.items.egg+w.player.bag.items.egg+w.workers.reduce((n,a)=>n+a.bag.items.egg,0)+w.stations.reduce((n,s)=>n+s.stock.items.egg,0);
  let allCash=w.wallet.cash+w.looseCash.cash+w.stations.reduce((n,s)=>n+s.pendingCash,0)+w.upgrades.reduce((n,u)=>n+u.paid,0);
  if(!legacy){
    const c=w.chapter;if(!c)throw new Error('missing chapter');
    [c.input,c.output,c.stock].forEach(inventoryUsed);
    if(c.input.capacity!==chapterConfig.recipe.inputCapacity||c.output.capacity!==chapterConfig.recipe.outputCapacity||c.stock.capacity!==chapterConfig.retail.capacity)throw new Error('invalid chapter capacities');
    const counts=[c.packed,c.retailSold,c.wholesaleSold,c.pendingCash,c.truck.loaded,c.truck.delivered,c.truck.pendingCash];
    if(counts.some(n=>!Number.isSafeInteger(n)||n<0)||c.truck.loaded>=chapterConfig.wholesale.boxes||c.truck.cooldown<0||c.truck.cooldown>chapterConfig.wholesale.returnSeconds||c.progress<0||c.progress>chapterConfig.recipe.seconds||c.retailTime<0||c.retailTime>chapterConfig.retail.seconds)throw new Error('invalid chapter state');
    const gifts=w.player.bag.items.gift+w.workers.reduce((n,a)=>n+a.bag.items.gift,0)+c.output.items.gift+c.stock.items.gift+c.truck.loaded;
    if(c.packed!==gifts+c.retailSold+c.wholesaleSold||c.wholesaleSold!==c.truck.delivered*chapterConfig.wholesale.boxes)throw new Error('gift conservation failed');
    heldEggs+=c.input.items.egg+c.packed*chapterConfig.recipe.eggs;allCash+=c.pendingCash+c.truck.pendingCash;
    if([w.feed,w.ground,w.machine.bag,...w.stations.map(s=>s.stock)].some(b=>b.items.gift))throw new Error('invalid gift store');
    if(w.upgrades.some(u=>u.unlocked&&!eligible(w,u.id)))throw new Error('invalid chapter milestone');
    if(c.input.items.corn||c.input.items.gift||c.output.items.corn||c.output.items.egg||c.stock.items.corn||c.stock.items.egg)throw new Error('invalid chapter cargo');
    if(w.workers.filter(a=>a.job==='packer').length!==(unlocked(w,'packer')?1:0))throw new Error('invalid packer');
  }
  if(w.stats.harvested!==heldCorn+w.stats.produced||w.stats.produced!==heldEggs+w.stats.eggsSold||allCash!==50+w.stats.earned)throw new Error('resource conservation failed');
}
