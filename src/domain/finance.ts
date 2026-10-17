import type { World, Actor } from './world.ts';
import type { Vec2 } from './contracts.ts';
import { chapterConfig } from './chapter2.ts';
import bakeryConfig from '../content/chapter3.json' with {type:'json'};
export const ATM={x:24.5,z:16.8};
export const bankOpen=(w:World)=>w.upgrades.some(u=>u.id==='bank_atm'&&u.unlocked);
export const availableCash=(w:World)=>w.wallet.cash+w.bank.cash;
export const incomeAccount=(w:World)=>bankOpen(w)?w.bank:w.wallet;
export function spendCash(w:World,amount:number):void {
  if(!Number.isSafeInteger(amount)||amount<0||amount>availableCash(w))throw new Error('insufficient balance');
  const physical=Math.min(w.wallet.cash,amount);w.wallet.cash-=physical;w.bank.cash-=amount-physical;
}
export function depositWallet(w:World):number {const n=w.wallet.cash;w.wallet.cash=0;w.bank.cash+=n;w.bank.deposited+=n;return n;}
export function cashSources(w:World):{id:string;at:Vec2;amount:number;take:(n:number)=>void}[]{
  return [
    ...w.stations.filter(s=>s.enabled).map(s=>({id:s.id,at:s.id==='car_counter'?{x:13,z:14}:{x:24,z:16},amount:s.pendingCash,take:(n:number)=>{s.pendingCash-=n;}})),
    {id:'gift',at:chapterConfig.points.cash,amount:w.chapter.pendingCash,take:(n:number)=>{w.chapter.pendingCash-=n;}},
    {id:'truck',at:chapterConfig.points.truckCash,amount:w.chapter.truck.pendingCash,take:(n:number)=>{w.chapter.truck.pendingCash-=n;}},
    {id:'cake',at:bakeryConfig.points.cash,amount:w.bakery.pendingCash,take:(n:number)=>{w.bakery.pendingCash-=n;}}
  ];
}
export function collectionRate(w:World,pile:number):number {
  // Small starter piles retain their tactile pace; large piles take about 1.5 seconds.
  return Math.max(60,Math.min(1000000000,Math.max(pile,availableCash(w)*.12)/1.5));
}
export function updateCashier(w:World,a:Actor,dt:number,go:(p:Vec2)=>void):void {
  const distance=(p:Vec2)=>Math.hypot(a.position.x-p.x,a.position.z-p.z);
  const sources=cashSources(w).filter(p=>p.amount>0);
  if((a.cash>0&&!sources.length)||a.task==='deposit'){
    a.task='deposit';go(ATM);
    if(distance(ATM)<.9){w.bank.cash+=a.cash;w.bank.deposited+=a.cash;a.cash=0;a.task=null;a.deliveries++;}
    return;
  }
  const source=sources.find(p=>p.id===a.task)??sources.sort((a,b)=>b.amount/(2+distance(b.at))-a.amount/(2+distance(a.at)))[0];
  if(!source){a.task=null;go(ATM);return;}
  a.task=source.id;go(source.at);
  if(distance(source.at)<.9){const n=Math.min(source.amount,Math.max(1,Math.ceil(collectionRate(w,source.amount+a.cash)*dt)));source.take(n);a.cash+=n;w.stats.collected+=n;if(n===source.amount)a.task='deposit';}
}
