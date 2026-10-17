/** Engine-neutral contracts. Quantities use non-negative safe integers. */
export type Item = 'corn' | 'egg' | 'gift' | 'wheat' | 'flour' | 'cake';
export type Id = string;
export interface Vec2 { x: number; z: number }
export interface Inventory { capacity: number; items: Record<Item, number> }
export interface Wallet { cash: number }
export interface CashPile { cash: number }
export interface Order { id: Id; packsRemaining: number; eggsPerPack: number; cashPerPack: number }
export interface Station { id: Id; stock: Inventory; pendingCash: number }
export interface Upgrade { id: Id; cost: number; paid: number; requires: Id[]; unlocked: boolean }
export interface ActorState { id: Id; position: Vec2; bag: Inventory }
export type PlayerAction = { type: 'move'; x: number; z: number } | { type: 'pause'; paused: boolean };
export type DomainEvent =
  | { type: 'transfer'; item: Item; amount: number; from: Id; to: Id }
  | { type: 'sale'; stationId: Id; orderId: Id; eggs: number; cash: number }
  | { type: 'invest'; upgradeId: Id; paid: number; completed: boolean };
export interface HudModel { cash: number; cargoUsed: number; cargoCapacity: number; goal: string; paused: boolean }
export interface PlatformServices {
  readSave(key: string): Promise<string | null>;
  writeSave(key: string, serialized: string): Promise<void>;
  playAudio(assetKey: string): void;
  onVisibilityChanged(handler: (visible: boolean) => void): () => void;
}
export interface SimulationSnapshot {
  schemaVersion: 1;
  configVersion: string;
  tick: number;
  rngState: number;
  player: ActorState;
  wallet: Wallet;
  stations: Station[];
  upgrades: Upgrade[];
  // Full playable save must additionally include crops, workers and in-flight production.
}
