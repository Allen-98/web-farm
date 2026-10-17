import type { Item, Inventory, Wallet, CashPile, Order, Station, Upgrade } from './contracts.ts';

function quantity(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}
export function inventoryUsed(store: Inventory): number {
  quantity(store.capacity, 'capacity');
  quantity(store.items.corn, 'corn');
  quantity(store.items.egg, 'egg');
  quantity(store.items.gift ?? 0, 'gift');
  for(const item of ['wheat','flour','cake'] as const)quantity(store.items[item]??0,item);
  const used = store.items.corn + store.items.egg + (store.items.gift ?? 0)+(store.items.wheat??0)+(store.items.flour??0)+(store.items.cake??0);
  quantity(used, 'inventory total');
  if (used > store.capacity) throw new RangeError('inventory exceeds capacity');
  return used;
}
export function transferItems(source: Inventory, target: Inventory, item: Item, requested: number): number {
  quantity(requested, 'requested');
  inventoryUsed(source);
  const free = target.capacity - inventoryUsed(target);
  if (source === target) return 0;
  const moved = Math.min(requested, source.items[item], free);
  source.items[item] -= moved;
  target.items[item] += moved;
  return moved;
}
/** Commits a finished production cycle; scheduling the cycle belongs to FeedProductionSystem. */
export function produceEgg(feed: Inventory, output: Inventory): boolean {
  inventoryUsed(feed);
  const free = output.capacity - inventoryUsed(output);
  if (feed === output) throw new Error('feed and egg output must be distinct stores');
  if (feed.items.corn < 1 || free < 1) return false;
  feed.items.corn -= 1;
  output.items.egg += 1;
  return true;
}
/** Call after service timer completes. One full pack is committed atomically. */
export function completeOrderPack(station: Station, order: Order): boolean {
  inventoryUsed(station.stock);
  quantity(station.pendingCash, 'pendingCash');
  quantity(order.packsRemaining, 'packsRemaining');
  quantity(order.eggsPerPack, 'eggsPerPack');
  quantity(order.cashPerPack, 'cashPerPack');
  if (order.eggsPerPack === 0) throw new RangeError('eggsPerPack must be positive');
  if (order.packsRemaining === 0 || station.stock.items.egg < order.eggsPerPack) return false;
  quantity(station.pendingCash + order.cashPerPack, 'resulting pendingCash');
  station.stock.items.egg -= order.eggsPerPack;
  station.pendingCash += order.cashPerPack;
  order.packsRemaining -= 1;
  return true;
}
export function collectCash(pile: CashPile, wallet: Wallet, allowance: number): number {
  quantity(pile.cash, 'pile cash');
  quantity(wallet.cash, 'wallet cash');
  quantity(allowance, 'allowance');
  if (pile === wallet) throw new Error('cash pile and wallet must be distinct');
  const moved = Math.min(pile.cash, allowance);
  quantity(wallet.cash + moved, 'resulting cash');
  pile.cash -= moved;
  wallet.cash += moved;
  return moved;
}
export function collectStationCash(station: Station, wallet: Wallet, allowance: number): number {
  const pile: CashPile = { cash: station.pendingCash };
  const moved = collectCash(pile, wallet, allowance);
  station.pendingCash = pile.cash;
  return moved;
}
export function invest(wallet: Wallet, upgrade: Upgrade, allowance: number, unlockedIds: ReadonlySet<string>): { paid: number; completed: boolean } {
  quantity(wallet.cash, 'wallet cash');
  quantity(upgrade.cost, 'cost');
  quantity(upgrade.paid, 'paid');
  quantity(allowance, 'allowance');
  if (upgrade.paid > upgrade.cost) throw new RangeError('paid exceeds cost');
  if (upgrade.unlocked && upgrade.paid !== upgrade.cost) throw new Error('inconsistent upgrade state');
  if (upgrade.unlocked || !upgrade.requires.every(id => unlockedIds.has(id))) return { paid: 0, completed: false };
  const amount = Math.min(wallet.cash, allowance, upgrade.cost - upgrade.paid);
  wallet.cash -= amount;
  upgrade.paid += amount;
  const completed = upgrade.paid === upgrade.cost;
  if (completed) upgrade.unlocked = true;
  return { paid: amount, completed };
}
