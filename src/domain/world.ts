import {capacityUpgrades,farmCapacity,applyCapacity,workerCapacity} from './capacity.ts';
import {operationsUpgrades,cycleSeconds,rescaleClock,FACILITIES} from './operations.ts';
import {createOrders,validateOrders,deliverOrder,ORDER_POINT,orderReady,TRADE_ITEMS,updateOrders} from './orders.ts';
import type {OrdersState} from './orders.ts';
import { bakeryConfig, createBakery, emptyItems, bakeryMode, bakeryInteract, updateBakery, bakeryGoal } from './bakery.ts';
import type {BakeryState} from './bakery.ts';
import { availableCash, incomeAccount, spendCash, depositWallet, bankOpen, collectionRate, cashSources, ATM, updateCashier } from './finance.ts';
import {updateCourier,updateWheatFarmer} from './logistics.ts';
import {validatePreviousWorld} from './previousSave.ts';
import { chapterConfig, createChapter, eligible, chapterMode, chapterInteract, updateChapter, chapterGoal } from './chapter2.ts';
import type { ChapterState } from './chapter2.ts';
import tuning from '../content/tuning.json' with { type: 'json' };
import map from '../content/map.json' with { type: 'json' };
import { inventoryUsed, transferItems, produceEgg, completeOrderPack, collectCash, collectStationCash, invest } from './economy.ts';
import type { Inventory, Vec2, Wallet, Upgrade, Order, Station, Item } from './contracts.ts';

export { tuning, map };
export const DT = 1 / tuning.simulation.tickHz;
export const CONFIG_VERSION = 'farm-v3.2';
export const BOOT_CASH = { x: 12, z: 15.5 };
export const FEED = { x: 15, z: 5 };
export const EGG_PICKUP = { x: 12.8, z: 9.4 };
export const LABELS: Record<string, string> = { car_counter: '开设汽车柜台', harvest_team: '雇佣收割小队', car_clerk: '雇佣搬蛋店员', walk_counter: '开设步行柜台', walk_expansion: '扩建步行柜台', harvester: '购买收割机', walk_clerk: '雇佣第二位店员' };
export interface Actor { cash:number;task:string|null;deliveries:number; id: string; position: Vec2; bag: Inventory; path: Vec2[]; facing: Vec2; moving: boolean; job: string; cooldown: number; targetCrop: number | null; credit: number; delivering: boolean }
export interface Crop { id: number; position: Vec2; readyAt: number; reservedBy: string | null }
export interface FarmStation extends Station { order: Order; service: number; serial: number; lastSale: number; enabled: boolean }
export interface FarmUpgrade extends Upgrade { position: Vec2;label?:string;job?:string }
export interface FxEvent { kind: 'item' | 'build'; item: Item | 'cash'; amount: number; from: Vec2; to: Vec2 }
export interface World {
  orders:OrdersState;
  chapter: ChapterState;bakery:BakeryState;bank:{cash:number;deposited:number};logistics:{eggToPack:number;eggToOven:number;originalToOven:number;flour:number;cake:number};
  version: string; tick: number; time: number; player: Actor; wallet: Wallet; looseCash: { cash: number };
  feed: Inventory; ground: Inventory; crops: Crop[]; stations: FarmStation[]; upgrades: FarmUpgrade[];
  workers: Actor[]; machine: { active: boolean; position: Vec2; bag: Inventory; pathIndex: number; credit: number };
  production: number[]; mode: string; credit: number; dwell: number; events: FxEvent[];
  stats: { harvested: number; produced: number; eggsSold: number; earned: number; collected: number };
  navigationTarget: Vec2 | null;cashRate:number;
}
export interface Goal { title: string; detail: string; target: Vec2; stage: string }
export const bag = (capacity: number, corn = 0, egg = 0): Inventory => ({ capacity, items: { ...emptyItems(),corn,egg } });
const point = (p: Vec2): Vec2 => ({ x: p.x, z: p.z });
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
export function unlocked(w: World, id: string): boolean { return w.upgrades.some(u => u.id === id && u.unlocked); }
export function zone(id: string): Vec2 { const p = map.interactionZones.find(p => p.id === id); if (!p) throw new Error(`Unknown zone ${id}`); return { x: p.x, z: p.z }; }
function actor(id: string, position: Vec2, capacity: number, job = ''): Actor { return { id, cash:0,task:null,deliveries:0,position: point(position), bag: bag(capacity), path: [], facing: { x: 1, z: 1 }, moving: false, job, cooldown: 0, targetCrop: null, credit: 0, delivering: false }; }
export const MAIN_UPGRADE_COUNT=17;
export const UPGRADE_SPECS=[...tuning.upgrades.map(u=>({...u,label:LABELS[u.id],position:map.investmentZones.find(z=>z.upgradeId===u.id)!})),...chapterConfig.upgrades,...bakeryConfig.upgrades,...bakeryConfig.automation,...capacityUpgrades,...operationsUpgrades];
export function createWorld(): World {
  const field = map.areas.find(a => a.id === 'corn_field')!;
  return {
    orders:createOrders(),version: CONFIG_VERSION, tick: 0, time: 0, chapter: createChapter(),bakery:createBakery(),bank:{cash:0,deposited:0},logistics:{eggToPack:0,eggToOven:0,originalToOven:0,flour:0,cake:0},
    player: actor('player', map.playerSpawn, tuning.player.inventoryCapacity), wallet: { cash: 0 }, looseCash: { cash: tuning.bootstrap.looseCash },
    feed: bag(tuning.farm.feedCapacity), ground: bag(tuning.farm.eggGroundCapacity),
    crops: Array.from({ length: field.rows! * field.columns! }, (_, id) => ({ id, position: { x: field.x + 0.6 + (id % field.columns!) * 1.3, z: field.z + 0.5 + Math.floor(id / field.columns!) * 0.96 }, readyAt: 0, reservedBy: null })),
    stations: tuning.stations.map(s => ({ id: s.id, stock: bag(s.eggCapacity), pendingCash: 0, order: { id: `${s.id}-0`, packsRemaining: 1, eggsPerPack: s.eggsPerPack, cashPerPack: s.cashPerPack }, service: 0, serial: 0, lastSale: -10, enabled: false })),
    upgrades: UPGRADE_SPECS.map(u=>({...u,requires:[...u.requires],paid:0,unlocked:false,position:point(u.position)})),
    workers: [], machine: { active: false, position: { x: 17, z: 2.5 }, bag: bag(120), pathIndex: 0, credit: 0 },
    production: Array(tuning.farm.chickenCount).fill(0), mode: '', credit: 0, dwell: 0, events: [], navigationTarget: null,cashRate:0,
    stats: { harvested: 0, produced: 0, eggsSold: 0, earned: 0, collected: 0 }
  };
}

export function walkable(w: World, p: Vec2): boolean {
  const bounds=map.walkBounds;
  if (p.x < bounds.minX || p.x > (unlocked(w,'bakery_land')?bakeryConfig.maxX:unlocked(w,'market_land')?chapterConfig.bounds.maxX:bounds.maxX) || p.z < bounds.minZ || p.z > bounds.maxZ) return false;
  for(const b of map.staticBlockers) if(p.x>b.x&&p.x<b.x+b.width&&p.z>b.z&&p.z<b.z+b.height)return false;
  for (const a of map.areas) if (a.role === 'station' && unlocked(w, a.id) && p.x > a.x - 0.25 && p.x < a.x + a.width + 0.25 && p.z > a.z - 0.25 && p.z < a.z + a.height + 0.25) return false;
  for(const b of [...chapterConfig.buildings,...bakeryConfig.buildings])if(unlocked(w,b.id)&&p.x>b.x-.25&&p.x<b.x+b.width+.25&&p.z>b.z-.25&&p.z<b.z+b.height+.25)return false;
  return true;
}
/** Half-meter navigation grid; renderer and engine coordinates never enter this pathfinder. */
export function findPath(w: World, start: Vec2, end: Vec2): Vec2[] {
  const cell = (p: Vec2) => ({ x: Math.round(p.x * 2), z: Math.round(p.z * 2) });
  const from = cell(start), to = cell(end); const key = (p: Vec2) => `${p.x},${p.z}`;
  let goal = { x: to.x / 2, z: to.z / 2 };
  if (!walkable(w, goal)) return [];
  const queue = [from], parents = new Map<string, Vec2 | null>([[key(from), null]]); let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (key(current) === key(to)) {
      const result: Vec2[] = []; let cursor: Vec2 | null = current;
      while (cursor && key(cursor) !== key(from)) { result.unshift({ x: cursor.x / 2, z: cursor.z / 2 }); cursor = parents.get(key(cursor)) ?? null; }
      if (walkable(w, end)) result.push(point(end));
      return result;
    }
    for (const d of [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }]) {
      const n = { x: current.x + d.x, z: current.z + d.z };
      if (!parents.has(key(n)) && walkable(w, { x: n.x / 2, z: n.z / 2 })) { parents.set(key(n), current); queue.push(n); }
    }
  }
  return [];
}
export function navigate(w: World, target: Vec2): void {
  const path = findPath(w, w.player.position, target);
  if (path.length) { w.player.path = path; w.navigationTarget = point(target); }
}
function followPath(w: World, a: Actor, speed: number, dt: number): void {
  a.moving = false;
  while (a.path.length && distance(a.position, a.path[0]) < 0.12) a.path.shift();
  if (!a.path.length) return;
  const target = a.path[0], dist = distance(a.position, target), step = Math.min(speed * dt, dist);
  const dx = (target.x - a.position.x) / dist, dz = (target.z - a.position.z) / dist;
  const next = { x: a.position.x + dx * step, z: a.position.z + dz * step };
  if (walkable(w, next)) { a.position = next; a.facing = { x: dx, z: dz }; a.moving = true; } else a.path = [];
}
function go(w: World, a: Actor, target: Vec2, speed: number, dt: number): void {
  if (distance(a.position, target) < 0.55) { a.moving = false; a.path = []; return; }
  if (!a.path.length || distance(a.path[a.path.length - 1], target) > 0.8) a.path = findPath(w, a.position, target);
  followPath(w, a, speed, dt);
}
function fx(w: World, item: Item | 'cash', amount: number, from: Vec2, to: Vec2): void {
  if (amount > 0 && w.events.length < 48) w.events.push({ kind: 'item', item, amount, from: point(from), to: point(to) });
}
function harvested(w: World, crop: Crop, target: Inventory, owner: Vec2): boolean {
  if (crop.readyAt > w.time || inventoryUsed(target) >= target.capacity) return false;
  crop.readyAt = w.time + tuning.farm.regrowSeconds; crop.reservedBy = null;
  const amount=Math.min(farmCapacity(w).yield,target.capacity-inventoryUsed(target));
  target.items.corn += amount; w.stats.harvested += amount; fx(w, 'corn', amount, crop.position, owner); return true;
}
export function nextUpgrade(w: World): FarmUpgrade | undefined { return w.upgrades.slice(0,MAIN_UPGRADE_COUNT).find(u => !u.unlocked && u.requires.every(id => unlocked(w, id)) && eligible(w,u.id)); }
function applyUnlock(w: World, u: FarmUpgrade): void {
  if (u.id === 'car_counter' || u.id === 'walk_counter') w.stations.find(s => s.id === u.id)!.enabled = true;
  if (u.id === 'harvest_team') for (let i = 0; i < 3; i++) w.workers.push(actor(`harvest-${i}`, { x: 17.5 + i, z: 11 }, 20, 'harvest'));
  if (u.id === 'car_clerk') w.workers.push(actor('clerk-car', { x: 12, z: 12 }, 24, 'car_counter'));
  if (u.id === 'walk_clerk') w.workers.push(actor('clerk-walk', { x: 21, z: 16 }, 24, 'walk_counter'));
  if(u.id==='bank_atm')depositWallet(w);
  const staff=bakeryConfig.automation.find(spec=>spec.id===u.id);if(staff?.job)w.workers.push(actor(staff.id,staff.position,staff.job==='wheat_farmer'?32:24,staff.job));
  if (u.id === 'packer') w.workers.push(actor('packer', chapterConfig.points.output, 24, 'packer'));
  if (u.id === 'walk_expansion') w.stations[1].stock.capacity = 240;
  if (u.id === 'harvester') {
    w.machine.active = true;
    for (const a of w.workers.filter(a => a.job === 'harvest')) { a.job = 'haul'; a.path = []; a.targetCrop = null; }
    for (const c of w.crops) c.reservedBy = null;
  }
  applyCapacity(w);
  w.events.push({ kind: 'build', item: 'cash', amount: u.cost, from: point(u.position), to: point(u.position) });
}
function interact(w: World, dt: number): void {
  const a = w.player, used = inventoryUsed(a.bag), u = w.upgrades.slice(0,MAIN_UPGRADE_COUNT).find(u=>!u.unlocked&&u.requires.every(id=>unlocked(w,id))&&eligible(w,u.id)&&distance(a.position,u.position)<.95);
  let mode = '', target: FarmStation | undefined;
  if (u && distance(a.position, u.position) < 0.95) mode = `invest:${u.id}`;
  else if(w.orders.active&&!orderReady(w)&&distance(a.position,ORDER_POINT)<1&&TRADE_ITEMS.some(i=>a.bag.items[i]&&w.orders.active!.stock.items[i]<w.orders.active!.offer.requires[i]))mode='order-delivery';
  else if(bakeryMode(w))mode=bakeryMode(w);
  else if(bankOpen(w)&&w.wallet.cash&&distance(a.position,ATM)<1)mode='atm-deposit';
  else if(chapterMode(w))mode=chapterMode(w);
  else if (a.bag.items.corn && distance(a.position, FEED) < 1.1) mode = 'feed';
  else if ((target = w.stations.find(s => s.enabled && a.bag.items.egg && distance(a.position, zone(s.id === 'car_counter' ? 'car_supply' : 'walk_supply')) < 1.1))) mode = `supply:${target.id}`;
  else if (w.looseCash.cash && distance(a.position, BOOT_CASH) < 1.1) mode = 'bootstrap';
  else if ((target = w.stations.find(s => s.enabled && s.pendingCash && distance(a.position, zone(s.id === 'car_counter' ? 'car_cash' : 'walk_cash')) < 1))) mode = `cash:${target.id}`;
  else if (a.position.x > 7.9 && a.position.x < 14.1 && a.position.z > 6.9 && a.position.z < 11.1 && w.ground.items.egg && used < a.bag.capacity) mode = 'eggs';
  else if (used < a.bag.capacity && !a.bag.items.egg && !a.bag.items.gift && !a.bag.items.wheat && !a.bag.items.flour && !a.bag.items.cake && (!w.navigationTarget || (w.navigationTarget.x>=16&&w.navigationTarget.x<=24&&w.navigationTarget.z<=10)) && w.crops.some(c => c.readyAt <= w.time && distance(c.position, a.position) < 1.15)) mode = 'harvest';
  if (mode !== w.mode) { w.mode = mode; w.credit = 0; w.dwell = 0;w.cashRate=0; }
  if (!mode) return;
  w.dwell += dt;
  const cashMode=mode.startsWith('cash:')||mode.endsWith('-cash')||mode==='bootstrap';
  const pile=mode==='bootstrap'?w.looseCash.cash:cashSources(w).find(p=>distance(a.position,p.at)<1.1)?.amount??0;
  if(cashMode)w.cashRate=Math.max(w.cashRate,collectionRate(w,pile));
  const rate = mode.startsWith('invest:') ? Math.max(40,(u?u.cost-u.paid:40)/2) : cashMode ? w.cashRate : mode === 'feed' ? tuning.player.feedPerSecond : mode === 'harvest' ? 1 / tuning.player.harvestSeconds : tuning.player.pickupPerSecond;
  if (mode.startsWith('invest:') && w.dwell < tuning.player.investmentDwellSeconds) return;
  w.credit = Math.min(cashMode||mode.startsWith('invest:')?Math.max(4,rate*dt*2):4, w.credit + rate * dt); let allowance = Math.floor(w.credit);
  if(mode.startsWith('invest:')&&u&&availableCash(w)>=u.cost-u.paid)allowance=u.cost-u.paid;
  if (!allowance) return;
  w.credit = Math.max(0,w.credit-allowance);
  if (mode.startsWith('invest:') && u) {
    const result = invest({cash:availableCash(w)}, u, allowance, new Set(w.upgrades.filter(x => x.unlocked).map(x => x.id)));
    spendCash(w,result.paid);fx(w, 'cash', result.paid, a.position, u.position); if (result.completed) applyUnlock(w, u);
  } else if(mode==='order-delivery'){deliverOrder(w,a.bag,allowance,(item,n)=>fx(w,item,n,a.position,ORDER_POINT));}
  else if(mode==='atm-deposit'){const amount=depositWallet(w);fx(w,'cash',amount,a.position,ATM);}
  else if(['mill-input','flour-output','flour-input','oven-egg','cake-output','cake-supply','wheat-harvest','cake-cash'].includes(mode))bakeryInteract(w,mode,allowance,(item,n,from,to)=>fx(w,item,n,from,to));
  else if (['pack-input','pack-output','gift-supply','truck-load','gift-cash','truck-cash'].includes(mode)) chapterInteract(w,mode,allowance,(item,n,from,to)=>fx(w,item,n,from,to));
  else if (mode === 'feed') { const n = transferItems(a.bag, w.feed, 'corn', allowance); fx(w, 'corn', n, a.position, FEED); }
  else if (mode === 'eggs') { const n = transferItems(w.ground, a.bag, 'egg', allowance); fx(w, 'egg', n, EGG_PICKUP, a.position); }
  else if (mode === 'harvest') {
    const nearby = w.crops.filter(c => c.readyAt <= w.time && distance(c.position, a.position) < 1.15).sort((x, y) => distance(x.position, a.position) - distance(y.position, a.position));
    for (const c of nearby.slice(0, allowance)) harvested(w, c, a.bag, a.position);
  } else if (mode === 'bootstrap') { const n = collectCash(w.looseCash, incomeAccount(w), allowance); w.stats.collected += n; fx(w, 'cash', n, BOOT_CASH, a.position); }
  else if (mode.startsWith('supply:') && target) { const n = transferItems(a.bag, target.stock, 'egg', allowance); fx(w, 'egg', n, a.position, zone(target.id === 'car_counter' ? 'car_supply' : 'walk_supply')); }
  else if (mode.startsWith('cash:') && target) { const n = collectStationCash(target, incomeAccount(w), allowance); w.stats.collected += n; fx(w, 'cash', n, zone(target.id === 'car_counter' ? 'car_cash' : 'walk_cash'), a.position); }
}
function updateWorker(w: World, a: Actor, dt: number): void {
  const capacity=farmCapacity(w),rate=['haul','harvest'].includes(a.job)?capacity.haulRate:8*(capacity.coopLevel+1);
  a.cooldown = Math.max(0, a.cooldown - dt); a.credit = Math.min(Math.max(2,rate*dt*2), a.credit + rate * dt); const allowance = Math.floor(a.credit);
  a.moving = false;
  const walk=(target:Vec2)=>go(w,a,target,a.job==='cashier'?5.8:4.6,dt),effect=(item:Item|'cash',n:number,from:Vec2,to:Vec2)=>fx(w,item,n,from,to);
  if(a.job==='cashier'){updateCashier(w,a,dt,walk);return;}
  if(a.job==='wheat_farmer'){updateWheatFarmer(w,a,dt,allowance,walk,effect);return;}
  if(a.job==='cake_courier'){updateCourier(w,a,'cake',allowance,walk,effect);return;}
  if(a.job==='gift_courier'){updateCourier(w,a,'gift',allowance,walk,effect);return;}
  if(a.job==='baker'){updateCourier(w,a,a.bag.items.egg||(!a.bag.items.flour&&w.bakery.ovenEgg.items.egg<4&&!w.bakery.flour.items.flour)?'egg':'flour',allowance,walk,effect);return;}
  if(a.job==='packer'){updateCourier(w,a,a.bag.items.egg||(!a.bag.items.gift&&!w.chapter.output.items.gift)?'egg':'gift',allowance,walk,effect);return;}
  if(['car_counter','walk_counter','egg_courier'].includes(a.job)){updateCourier(w,a,'egg',allowance,walk,effect);return;}
  if (a.job === 'harvest' || a.job === 'haul') {
    if (a.bag.items.corn >= capacity.haulBatch || (a.bag.items.corn >= 4 && w.feed.items.corn < 12)) a.delivering = true;
    if (a.bag.items.corn === 0) a.delivering = false;
    if (a.delivering) {
      if (a.targetCrop !== null) { const c = w.crops[a.targetCrop]; if (c.reservedBy === a.id) c.reservedBy = null; a.targetCrop = null; }
      go(w, a, FEED, capacity.haulSpeed, dt);
      if (distance(a.position, FEED) < 0.85 && allowance) { const n = transferItems(a.bag, w.feed, 'corn', allowance); a.credit -= allowance; fx(w, 'corn', n, a.position, FEED); }
      return;
    }
    if (a.job === 'haul') {
      go(w, a, w.machine.position, capacity.haulSpeed, dt);
      if (distance(a.position, w.machine.position) < 1.1 && allowance) { const n = transferItems(w.machine.bag, a.bag, 'corn', allowance); a.credit -= allowance; fx(w, 'corn', n, w.machine.position, a.position); }
      return;
    }
    let crop = a.targetCrop === null ? undefined : w.crops[a.targetCrop];
    if (!crop || crop.readyAt > w.time || (crop.reservedBy && crop.reservedBy !== a.id)) {
      if (crop?.reservedBy === a.id) crop.reservedBy = null;
      crop = w.crops.filter(c => c.readyAt <= w.time && !c.reservedBy).sort((x, y) => distance(x.position, a.position) - distance(y.position, a.position))[0];
      a.targetCrop = crop?.id ?? null; if (crop) crop.reservedBy = a.id;
    }
    if (crop) {
      go(w, a, crop.position, 3.1, dt);
      if (distance(a.position, crop.position) < 0.6 && !a.cooldown) { harvested(w, crop, a.bag, a.position); a.cooldown = 1; a.targetCrop = null; }
    }
  }
}

function updateMachine(w: World, dt: number): void {
  const m = w.machine; if (!m.active) return;
  const row = Math.floor(m.pathIndex / 2) % 8;
  const target = { x: m.pathIndex % 2 === 0 ? 23.1 : 16.6, z: 2.5 + row * 0.96 };
  const d = distance(m.position, target);
  if (d < 0.15) m.pathIndex = (m.pathIndex + 1) % 16;
  else if (m.bag.items.corn < m.bag.capacity) { const move = Math.min(3 * farmCapacity(w).yield * dt, d) / d; m.position.x += (target.x - m.position.x) * move; m.position.z += (target.z - m.position.z) * move; }
  m.credit = Math.min(2, m.credit + tuning.workers.machineTargetCornPerSecond * dt);
  while (m.credit >= 1) { m.credit -= 1; const c = w.crops.find(c => c.readyAt <= w.time && distance(c.position, m.position) < 2); if (c) harvested(w, c, m.bag, m.position); }
}
function productionAndSales(w: World, dt: number): void {
  for (let i = 0; i < w.production.length; i++) {
    if (w.feed.items.corn > 0) w.production[i] = Math.min(tuning.farm.productionSecondsPerChicken, w.production[i] + dt);
    if (w.production[i] >= tuning.farm.productionSecondsPerChicken && produceEgg(w.feed, w.ground)) { w.production[i] = 0; w.stats.produced++; fx(w, 'egg', 1, { x: 9 + i * 0.7, z: 5 }, { x: 9 + i * 0.7, z: 8 }); }
  }
  for (const s of w.stations) {
    if (!s.enabled) continue;
    const config = tuning.stations.find(c => c.id === s.id)!;
    if (s.stock.items.egg >= s.order.eggsPerPack) s.service += dt;
    if (s.service >= cycleSeconds(w,s.id) && completeOrderPack(s, s.order)) {
      s.service = 0; s.lastSale = w.time; w.stats.eggsSold += s.order.eggsPerPack; w.stats.earned += s.order.cashPerPack;
      fx(w, 'cash', s.order.cashPerPack, zone(s.id === 'car_counter' ? 'car_supply' : 'walk_supply'), zone(s.id === 'car_counter' ? 'car_cash' : 'walk_cash'));
      if (!s.order.packsRemaining) { s.serial++; s.order = { id: `${s.id}-${s.serial}`, eggsPerPack: config.eggsPerPack, cashPerPack: config.cashPerPack, packsRemaining: config.orderPacks[s.serial % config.orderPacks.length] }; }
    }
  }
}
export function stepWorld(w: World, move: Vec2 = { x: 0, z: 0 }): void {
  const dt=DT;
  w.events = []; w.tick++; w.time = w.tick * DT;
  if (Math.hypot(move.x, move.z) > 0.01) {
    w.player.path = []; w.navigationTarget = null;
    const len = Math.max(1, Math.hypot(move.x, move.z)), dx = move.x / len * tuning.player.moveMetersPerSecond * dt, dz = move.z / len * tuning.player.moveMetersPerSecond * dt;
    const p = w.player.position; const before = point(p);
    if (walkable(w, { x: p.x + dx, z: p.z })) p.x += dx;
    if (walkable(w, { x: p.x, z: p.z + dz })) p.z += dz;
    w.player.moving = distance(before, p) > 0.001; w.player.facing = point(move);
  } else { followPath(w, w.player, tuning.player.moveMetersPerSecond, dt); if (!w.player.path.length) w.navigationTarget = null; }
  interact(w, dt);
  for (const a of w.workers) updateWorker(w, a, dt);
  updateMachine(w, dt); productionAndSales(w, dt);updateChapter(w,dt,(item,n,from,to)=>fx(w,item,n,from,to));updateBakery(w,dt,(item,n,from,to)=>fx(w,item,n,from,to));updateOrders(w);
}
export function getGoal(w: World): Goal {
  const next = nextUpgrade(w), chapterTwo=unlocked(w,'walk_clerk'), stage=unlocked(w,'packer')?`第三章 · 烘焙工坊 ${w.upgrades.slice(12,17).filter(u=>u.unlocked).length} / 5`:chapterTwo?`第二章 · 乡间集市 ${w.upgrades.slice(7,12).filter(u=>u.unlocked).length} / 5`:`第一章 · 鸡蛋农场 ${Math.min(7,w.upgrades.filter(u=>u.unlocked).length+1)} / 7`;
  const result = (title: string, detail: string, target: Vec2): Goal => ({ title, detail, target, stage });
  if (w.looseCash.cash > 0) return result('领取启动资金', '靠近现金堆，收下第一桶金', BOOT_CASH);
  if (next && availableCash(w) >= next.cost - next.paid) return result(LABELS[next.id]??next.label??next.id, `还需 $${next.cost - next.paid} · 站在地块里自动投入`, next.position);
  if(w.orders.active){
    if(orderReady(w))return result('订单已备齐，领取货款','点击订单按钮结算 · 货款直接计入余额',ORDER_POINT);
    if(TRADE_ITEMS.some(i=>w.player.bag.items[i]&&w.orders.active!.stock.items[i]<w.orders.active!.offer.requires[i]))return result('把订单货物送到交货区','走近订单板自动卸货 · 员工也会协助送货',ORDER_POINT);
  }
  if(!next&&unlocked(w,'cake_stall')&&!w.orders.active)return result('接一笔新订单','点击「订单」挑选生意，继续发展农场',ORDER_POINT);
  if(unlocked(w,'bakery_land')){
    if(next&&availableCash(w)<next.cost-next.paid){const source=cashSources(w).sort((a,b)=>b.amount-a.amount)[0];if(source?.amount)return result('\u9886\u53d6\u8d27\u6b3e\uff0c\u6269\u5efa\u70d8\u7119\u5de5\u574a',`\u8fd8\u5dee $${next.cost-next.paid-availableCash(w)} \u00b7 \u53ef\u62db\u8058\u6536\u6b3e\u5458`,source.at);}
    if(!unlocked(w,'wheat_field')&&next)return result(next.label??next.id,`$ ${next.cost-next.paid}`,next.position);
    const goal=bakeryGoal(w);if(goal)return {...goal,stage};
  }
  const chapterObjective=chapterGoal(w);if(chapterObjective)return {...chapterObjective,stage};
  const cash = w.stations.filter(s => s.enabled && s.pendingCash > 0).sort((a, b) => b.pendingCash - a.pendingCash)[0];
  if (cash) return result('把赚到的钱收回来', `有 $${cash.pendingCash} 等你领取`, zone(cash.id === 'car_counter' ? 'car_cash' : 'walk_cash'));
  if (!unlocked(w, 'harvest_team') && w.feed.items.corn === 0 && w.player.bag.items.corn > 0 && w.player.bag.items.corn < 16 && w.player.bag.items.egg === 0) {
    const c = w.crops.filter(c => c.readyAt <= w.time).sort((a,b) => distance(a.position,w.player.position)-distance(b.position,w.player.position))[0];
    if(c) return result('再收一捆玉米', '先收够 16 份，再去喂小鸡', c.position);
  }
  if (w.player.bag.items.corn > 0 && (w.player.bag.items.corn >= 16 || w.feed.items.corn < 6 || inventoryUsed(w.player.bag) === w.player.bag.capacity)) return result('给小鸡送玉米', '站在鸡舍旁的黄色喂料区', FEED);
  if (w.player.bag.items.egg > 0 && w.player.bag.items.egg < 24 && w.ground.items.egg > 0 && distance(w.player.position, EGG_PICKUP) < 1.2) return result('多装一些新鲜鸡蛋', '稍作停留，鸡蛋会自动装进背包', EGG_PICKUP);
  if (w.player.bag.items.egg > 0) {
    const s = w.stations.filter(s => s.enabled && s.stock.items.egg < s.stock.capacity).sort((a, b) => a.stock.items.egg - b.stock.items.egg)[0];
    if (s) return result('把鸡蛋搬到柜台', '靠近虚线供货区，鸡蛋自动上架', zone(s.id === 'car_counter' ? 'car_supply' : 'walk_supply'));
  }
  if (w.ground.items.egg >= 6 && inventoryUsed(w.player.bag) < w.player.bag.capacity) return result('收集新鲜鸡蛋', '走进蓝边集蛋区，鸡蛋会飞到背上', EGG_PICKUP);
  if (w.player.bag.items.corn > 0) return result('给小鸡送玉米', '把背上的玉米放进料槽', FEED);
  if (w.feed.items.corn > 0 || unlocked(w, 'harvest_team')) return result('小鸡正在下蛋', next ? `收蛋、卖货，为${LABELS[next.id]}攒钱` : '员工照看农场，你可以自由经营', EGG_PICKUP);
  const crop = w.crops.filter(c => c.readyAt <= w.time).sort((a, b) => distance(a.position, w.player.position) - distance(b.position, w.player.position))[0];
  return result('去田里收割玉米', '走过成熟玉米就会自动收割', crop?.position ?? { x: 19, z: 8 });
}

/** Optional facilities and hires use the same money and unlock transaction as ground pads. */
export function purchaseUpgrade(w:World,id:string):boolean {
  const u=w.upgrades.find(u=>u.id===id);
  if(!u||u.unlocked||!u.requires.every(id=>unlocked(w,id))||!eligible(w,id)||availableCash(w)<u.cost-u.paid)return false;
  const facility=FACILITIES.find(f=>u.id.startsWith(`speed_${f.id}_`)),oldSeconds=facility?cycleSeconds(w,facility.id):0;
  const result=invest({cash:availableCash(w)},u,u.cost-u.paid,new Set(w.upgrades.filter(u=>u.unlocked).map(u=>u.id)));
  spendCash(w,result.paid);if(result.completed){applyUnlock(w,u);if(facility)rescaleClock(w,facility.id,oldSeconds);}return result.completed;
}
export function validateWorld(w:World,legacyV3:boolean|'v3.1'=false):void {
  if(w.version!==(legacyV3==='v3.1'?'farm-v3.1':legacyV3?'farm-v3.0':CONFIG_VERSION)||!Number.isSafeInteger(w.tick)||w.tick<0||w.time!==w.tick*DT)throw new Error('unsupported save');
  const f=farmCapacity(w);
  if(w.crops.length!==48||w.production.length!==(legacyV3===true?6:f.chickens)||w.stations.length!==2||w.upgrades.length!==(legacyV3==='v3.1'?30:legacyV3?24:UPGRADE_SPECS.length)||w.bakery.crops.length!==25)throw new Error('invalid world shape');
  const finite=(v:unknown):void=>{if(typeof v==='number'&&!Number.isFinite(v))throw new Error('non-finite value');if(v&&typeof v==='object')for(const child of Object.values(v))finite(child);};finite(w);
  const b=w.bakery,c=w.chapter;
  const integers=[w.wallet.cash,w.bank.cash,w.bank.deposited,w.looseCash.cash,...Object.values(w.stats),...Object.values(w.logistics),b.harvested,b.milled,b.baked,b.sold,b.pendingCash,c.packed,c.retailSold,c.wholesaleSold,c.pendingCash,c.truck.loaded,c.truck.delivered,c.truck.pendingCash];
  for(const s of w.stations)integers.push(s.pendingCash,s.serial,s.order.packsRemaining);
  if(integers.some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('invalid quantities');
  const stores=[w.player.bag,w.feed,w.ground,w.machine.bag,...w.workers.map(a=>a.bag),...w.stations.map(s=>s.stock),c.input,c.output,c.stock,b.millInput,b.flour,b.ovenFlour,b.ovenEgg,b.cakes,b.stock];stores.forEach(inventoryUsed);
  const capacities=[w.player.bag.capacity,w.feed.capacity,w.ground.capacity,w.machine.bag.capacity,c.input.capacity,c.output.capacity,c.stock.capacity,b.millInput.capacity,b.flour.capacity,b.ovenFlour.capacity,b.ovenEgg.capacity,b.cakes.capacity,b.stock.capacity];
  if(JSON.stringify(capacities)!==JSON.stringify([60,f.feed,f.ground,f.machine,120,36,36,120,60,60,60,36,60])||w.looseCash.cash>50)throw new Error('invalid world limits');
  if(legacyV3!==true&&w.workers.some(a=>a.bag.capacity!==workerCapacity(w,a)))throw new Error('invalid worker capacity');
  for(let i=0;i<w.upgrades.length;i++){
    const u=w.upgrades[i],spec=UPGRADE_SPECS[i];
    if(u.id!==spec.id||u.cost!==spec.cost||!Number.isSafeInteger(u.paid)||u.paid<0||u.paid>u.cost||u.unlocked!==(u.paid===u.cost)||JSON.stringify(u.requires)!==JSON.stringify(spec.requires)||(u.unlocked&&(!spec.requires.every(id=>unlocked(w,id))||!eligible(w,u.id))))throw new Error('invalid prerequisite or progression');
  }
  const jobCounts:Record<string,number>={harvest:unlocked(w,'harvest_team')&&!unlocked(w,'harvester')?3:0,haul:unlocked(w,'harvester')?3:0,car_counter:unlocked(w,'car_clerk')?1:0,walk_counter:unlocked(w,'walk_clerk')?1:0,packer:unlocked(w,'packer')?1:0};
  for(const spec of bakeryConfig.automation)if(spec.job)jobCounts[spec.job]=unlocked(w,spec.id)?1:0;
  if(new Set(w.workers.map(a=>a.id)).size!==w.workers.length||w.workers.length!==Object.values(jobCounts).reduce((a,b)=>a+b,0))throw new Error('invalid workers');
  for(const[job,count]of Object.entries(jobCounts))if(w.workers.filter(a=>a.job===job).length!==count)throw new Error('invalid worker role');
  for(const a of [w.player,...w.workers])if(!Number.isSafeInteger(a.cash)||a.cash<0||!Number.isSafeInteger(a.deliveries)||a.deliveries<0||(a.task!==null&&typeof a.task!=='string')||a.path.length>500||typeof a.delivering!=='boolean')throw new Error('invalid worker state');
  for(let i=0;i<2;i++){const s=w.stations[i],spec=tuning.stations[i];if(s.id!==spec.id||s.enabled!==unlocked(w,s.id)||s.order.eggsPerPack!==spec.eggsPerPack||s.order.cashPerPack!==spec.cashPerPack||s.order.packsRemaining<1||s.order.packsRemaining>2||s.stock.capacity!==(i===1&&unlocked(w,'walk_expansion')?240:120))throw new Error('invalid station');}
  const timers:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[c.progress,cycleSeconds(w,'pack_table')],[c.retailTime,cycleSeconds(w,'gift_stall')],[c.truck.cooldown,chapterConfig.wholesale.returnSeconds],[b.millTime,cycleSeconds(w,'mill')],[b.ovenTime,cycleSeconds(w,'oven')],[b.saleTime,cycleSeconds(w,'cake_stall')]];
  if(timers.some(([value,max])=>value<0||value>max)||c.truck.loaded>=12||w.production.some(n=>n<0||n>tuning.farm.productionSecondsPerChicken))throw new Error('invalid production clock');
  const actors=[w.player,...w.workers],held=(item:Item)=>actors.reduce((n,a)=>n+a.bag.items[item],0);
  if(!legacyV3)validateOrders(w);
  const ordered=(item:'egg'|'gift'|'cake')=>legacyV3?0:w.orders.delivered[item]+(w.orders.active?.stock.items[item]??0);
  if(w.stats.harvested!==w.feed.items.corn+w.machine.bag.items.corn+held('corn')+w.stats.produced)throw new Error('corn conservation failed');
  if(w.stats.produced!==ordered('egg')+w.ground.items.egg+held('egg')+w.stations.reduce((n,s)=>n+s.stock.items.egg,0)+c.input.items.egg+c.packed*6+b.ovenEgg.items.egg+b.baked*2+w.stats.eggsSold)throw new Error('egg conservation failed');
  if(c.packed!==ordered('gift')+held('gift')+c.output.items.gift+c.stock.items.gift+c.truck.loaded+c.retailSold+c.wholesaleSold||c.wholesaleSold!==c.truck.delivered*12)throw new Error('gift conservation failed');
  if(b.harvested!==held('wheat')+b.millInput.items.wheat+b.milled*3)throw new Error('wheat conservation failed');
  if(b.milled!==held('flour')+b.flour.items.flour+b.ovenFlour.items.flour+b.baked*2)throw new Error('flour conservation failed');
  if(b.baked!==ordered('cake')+held('cake')+b.cakes.items.cake+b.stock.items.cake+b.sold)throw new Error('cake conservation failed');
  const money=availableCash(w)+w.looseCash.cash+w.workers.reduce((n,a)=>n+a.cash,0)+cashSources(w).reduce((n,p)=>n+p.amount,0)+w.upgrades.reduce((n,u)=>n+u.paid,0);
  if(money!==50+w.stats.earned)throw new Error('cash conservation failed');
  const only=(store:Inventory,item:Item)=>{if(Object.entries(store.items).some(([key,n])=>key!==item&&n!==0))throw new Error('invalid cargo store');};
  only(w.feed,'corn');only(w.machine.bag,'corn');only(w.ground,'egg');w.stations.forEach(s=>only(s.stock,'egg'));only(c.input,'egg');only(c.output,'gift');only(c.stock,'gift');only(b.millInput,'wheat');only(b.flour,'flour');only(b.ovenFlour,'flour');only(b.ovenEgg,'egg');only(b.cakes,'cake');only(b.stock,'cake');
}
/** Old economies are validated before adding empty inventories, roles and construction nodes. */
export function migrateWorld(value:World):World {
  if(value.version===CONFIG_VERSION){validateWorld(value);return value;}
  if(value.version==='farm-v3.0'||value.version==='farm-v3.1'){
    validateWorld(value,value.version==='farm-v3.1'?'v3.1':true);
    const w=structuredClone(value);
    for(const spec of UPGRADE_SPECS.slice(w.upgrades.length))w.upgrades.push({...spec,requires:[...spec.requires],paid:0,unlocked:false,position:{...spec.position}});
    w.orders=createOrders();
    w.version=CONFIG_VERSION;validateWorld(w);return w;
  }
  if(!['farm-v1.0','farm-v2.0'].includes(value.version))throw new Error('unsupported save');
  validatePreviousWorld(value,value.version==='farm-v1.0');
  const w=JSON.parse(JSON.stringify(value)) as World;
  if(value.version==='farm-v1.0'){
    w.chapter=createChapter();
    for(const spec of chapterConfig.upgrades)w.upgrades.push({...spec,requires:[...spec.requires],paid:0,unlocked:false,position:{...spec.position}});
  }
  w.bakery=createBakery();w.bank={cash:0,deposited:0};w.logistics={eggToPack:0,eggToOven:0,originalToOven:0,flour:0,cake:0};
  for(const store of [w.player.bag,w.feed,w.ground,w.machine.bag,...w.workers.map(a=>a.bag),...w.stations.map(s=>s.stock),w.chapter.input,w.chapter.output,w.chapter.stock])store.items={...emptyItems(),...store.items};
  for(const a of [w.player,...w.workers]){a.cash=0;a.task=null;a.deliveries=0;a.path=[];}
  for(const spec of UPGRADE_SPECS.slice(12))w.upgrades.push({...spec,requires:[...spec.requires],paid:0,unlocked:false,position:{x:spec.position.x,z:spec.position.z}});
  w.orders=createOrders();w.cashRate=0;w.version=CONFIG_VERSION;validateWorld(w);return w;
}
