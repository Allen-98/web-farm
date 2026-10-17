import capacityConfig from '../content/capacity.json' with {type:'json'};
import type {World,Actor} from './world.ts';

/** Engine-independent, cumulative production upgrades. Base tuning remains save compatible. */
export const capacityUpgrades=capacityConfig.upgrades;
export function capacityLevel(w:World,kind:'corn'|'coop'):number {
  return [1,2,3].filter(i=>w.upgrades.some(u=>u.id===`${kind}_${i}`&&u.unlocked)).length;
}
export function farmCapacity(w:World){
  const cornLevel=capacityLevel(w,'corn'),coopLevel=capacityLevel(w,'coop');
  return {cornLevel,coopLevel,yield:cornLevel+1,chickens:6*(coopLevel+1),feed:120*(cornLevel+1),ground:180*(coopLevel+1),machine:120*(cornLevel+1),cornPerSecond:8*(cornLevel+1),eggsPerSecond:4*(coopLevel+1),haulSpeed:3.3*(cornLevel+1),haulBatch:12*(cornLevel+1),haulRate:8*(cornLevel+1),eggBatch:16*(coopLevel+1)};
}
export function workerCapacity(w:World,a:Actor):number {
  const f=farmCapacity(w);
  if(a.job==='haul'||a.job==='harvest')return 20*(f.cornLevel+1);
  if(['car_counter','walk_counter','egg_courier','packer','baker'].includes(a.job))return 24*(f.coopLevel+1);
  return a.job==='wheat_farmer'?32:24;
}
export function applyCapacity(w:World):void {
  const f=farmCapacity(w);
  w.feed.capacity=f.feed;w.ground.capacity=f.ground;w.machine.bag.capacity=f.machine;
  while(w.production.length<f.chickens)w.production.push(0);
  for(const a of w.workers)a.bag.capacity=workerCapacity(w,a);
}
