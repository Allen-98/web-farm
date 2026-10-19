import type {World} from './world.ts';
import type {Inventory,Vec2} from './contracts.ts';
import {incomeAccount} from './finance.ts';
import {transferItems,inventoryUsed} from './economy.ts';

export const ORDER_POINT:Vec2={x:23,z:13};
export const TRADE_ITEMS=['egg','gift','cake'] as const;
export type TradeItem=typeof TRADE_ITEMS[number];
export const ITEM_NAMES={egg:'鸡蛋',gift:'礼盒',cake:'蛋糕'};
type Cargo=Record<TradeItem,number>;
export interface Offer {id:string;stage:number;title:string;requires:Cargo;reward:number;bonus:number;rush:boolean}
export interface ActiveOrder {offer:Offer;acceptedAt:number;readyAt:number|null;stock:Inventory}
export interface OrdersState {serial:number;completed:number;revenue:number;delivered:Cargo;active:ActiveOrder|null}
export const createOrders=():OrdersState=>({serial:0,completed:0,revenue:0,delivered:{egg:0,gift:0,cake:0},active:null});
const has=(w:World,id:string)=>w.upgrades.some(u=>u.id===id&&u.unlocked);
export function orderOffers(w:World,serial=w.orders.serial,stage=has(w,'cake_stall')?2:has(w,'gift_stall')?1:0):Offer[] {
  if(!has(w,'car_counter'))return [];
  const level=1+Math.min(4,Math.floor(w.orders.completed/5)),gift=stage>=1,cake=stage>=2;
  const single:TradeItem=cake&&serial%3===2?'cake':gift&&serial%3!==0?'gift':'egg';
  return [0,1,2].map(slot=>{
    const requires:Cargo={egg:0,gift:0,cake:0};
    if(slot===0)requires[single]=(single==='egg'?12:single==='gift'?4:3)*level;
    else {requires.egg=(slot===1?12:18)*level;if(gift)requires.gift=(slot===1?4:6)*level;if(cake)requires.cake=(slot===1?3:4)*level;if(!gift&&!cake)requires.egg*=2;}
    const value=requires.egg*2+requires.gift*20+requires.cake*40;
    return {id:`${serial}:${slot}`,stage,title:slot===0?'邻里采购':slot===1?'集市拼单':'餐厅加急',requires,reward:Math.ceil(value*1.2),bonus:slot===2?Math.ceil(value*.4):0,rush:slot===2};
  });
}
export function acceptOrder(w:World,id:string):boolean {
  if(w.orders.active)return false;const offer=orderOffers(w).find(o=>o.id===id);if(!offer)return false;
  w.orders.active={offer:structuredClone(offer),acceptedAt:w.time,readyAt:null,stock:{capacity:512,items:{corn:0,egg:0,gift:0,wheat:0,flour:0,cake:0}}};return true;
}
export function orderRemaining(w:World,item:TradeItem):number {const a=w.orders.active;return a?Math.max(0,a.offer.requires[item]-a.stock.items[item]):0;}
export function orderReady(w:World):boolean {return !!w.orders.active&&TRADE_ITEMS.every(i=>!orderRemaining(w,i));}
export function rushRemaining(w:World):number {const a=w.orders.active;return a?.offer.rush?Math.max(0,240-((a.readyAt??w.time)-a.acceptedAt)):0;}
export function updateOrders(w:World):void {if(w.orders.active&&orderReady(w)&&w.orders.active.readyAt===null)w.orders.active.readyAt=w.time;}
export function deliverOrder(w:World,source:Inventory,limit:number,fx?:(item:TradeItem,n:number)=>void):number {
  const a=w.orders.active;if(!a)return 0;let moved=0;
  for(const item of TRADE_ITEMS){const n=transferItems(source,a.stock,item,Math.min(limit-moved,orderRemaining(w,item)));moved+=n;if(n)fx?.(item,n);}
  updateOrders(w);return moved;
}
/** Goods leave the economy only on settlement; an expired rush retains all cargo. */
export function claimOrder(w:World):number {
  const a=w.orders.active;if(!a||!orderReady(w))return 0;
  const reward=a.offer.reward+(rushRemaining(w)>0?a.offer.bonus:0);
  for(const item of TRADE_ITEMS)w.orders.delivered[item]+=a.stock.items[item];
  incomeAccount(w).cash+=reward;w.stats.earned+=reward;w.stats.collected+=reward;
  w.orders.revenue+=reward;w.orders.completed++;w.orders.serial++;w.orders.active=null;
  return reward;
}
export function validateOrders(w:World):void {
  const o=w.orders;if(!o||Object.values(o.delivered).length!==3||[o.serial,o.completed,o.revenue,...Object.values(o.delivered)].some(n=>!Number.isSafeInteger(n)||n<0)||o.serial!==o.completed||o.revenue>w.stats.earned)throw new Error('invalid orders');
  const a=o.active;if(!a)return;
  if(!Number.isInteger(a.offer.stage)||a.offer.stage<0||a.offer.stage>2||(a.offer.stage>=1&&!has(w,'gift_stall'))||(a.offer.stage===2&&!has(w,'cake_stall')))throw new Error('invalid order stage');
  const offer=orderOffers(w,o.serial,a.offer.stage).find(v=>v.id===a.offer.id);
  if(!offer||JSON.stringify(a.offer)!==JSON.stringify(offer)||typeof a.acceptedAt!=='number'||a.acceptedAt<0||a.acceptedAt>w.time||a.stock.capacity!==512)throw new Error('invalid active order');
  if(a.readyAt!==null&&(typeof a.readyAt!=='number'||a.readyAt<a.acceptedAt||a.readyAt>w.time||!orderReady(w)))throw new Error('invalid order completion');
  inventoryUsed(a.stock);
  if(Object.entries(a.stock.items).some(([i,n])=>!TRADE_ITEMS.includes(i as TradeItem)?n!==0:n>a.offer.requires[i as TradeItem]))throw new Error('invalid order cargo');
}
