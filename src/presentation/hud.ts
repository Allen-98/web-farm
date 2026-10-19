import {farmCapacity} from '../domain/capacity.ts';
import {orderReady,TRADE_ITEMS} from '../domain/orders.ts';
import {availableCash,bankOpen} from '../domain/finance.ts';
import { getGoal, nextUpgrade, unlocked } from '../domain/world.ts';
import { inventoryUsed } from '../domain/economy.ts';
import type { World } from '../domain/world.ts';

const $=(id:string)=>document.getElementById(id)!;
export class Hud {
  lastCash=-1;
  lastUpgradeCount=0;
  toastTimer:ReturnType<typeof setTimeout>|undefined;
  present(w:World,fps:number):void{
    const goal=getGoal(w),used=inventoryUsed(w.player.bag);
    $('goal').setAttribute('aria-busy',String(w.player.path.length>0));
    const active=w.orders.active;
    $('orders').textContent=active?(orderReady(w)?'订单 · 领取货款':`订单 · ${TRADE_ITEMS.reduce((n,i)=>n+active.stock.items[i],0)} / ${TRADE_ITEMS.reduce((n,i)=>n+active.offer.requires[i],0)}`):'订单 · 挑选生意';
    $('orders').classList.toggle('order-ready',orderReady(w));
    $('cash').textContent=(availableCash(w)<10000?String(availableCash(w)):`${(availableCash(w)/10000).toFixed(1)}万`);$('cash').title=String(availableCash(w));$('money-label').textContent=bankOpen(w)?'账户余额':'现金';$('stage').textContent=goal.stage;$('goal-title').textContent=goal.title;$('goal-detail').textContent=goal.detail;
    $('gifts').textContent=String(w.player.bag.items.gift);$('gift-slot').hidden=!unlocked(w,'market_land');$('chapter-info').hidden=!unlocked(w,'pack_table');$('chapter-info').textContent=unlocked(w,'bakery_land')?`蛋糕已售 ${w.bakery.sold} · 员工 ${w.workers.length} · ATM $${w.bank.cash}`:`礼盒已售 ${w.chapter.retailSold} · 批发 ${w.chapter.truck.loaded} / 12 · 已发 ${w.chapter.truck.delivered} 车`;
    $('bakery-cargo').hidden=!unlocked(w,'wheat_field');$('bakery-cargo').textContent=`小麦 ${w.player.bag.items.wheat} · 面粉 ${w.player.bag.items.flour} · 蛋糕 ${w.player.bag.items.cake}`;
    $('cargo-count').innerHTML=`${used} <small>/ ${w.player.bag.capacity}</small>`;$('corn').textContent=String(w.player.bag.items.corn);$('eggs').textContent=String(w.player.bag.items.egg);$('cargo-fill').style.width=`${used/w.player.bag.capacity*100}%`;$('cargo-fill').classList.toggle('full',used===w.player.bag.capacity);
    if(availableCash(w)!==this.lastCash){$('cash').classList.remove('pop');void $('cash').offsetWidth;$('cash').classList.add('pop');this.lastCash=availableCash(w);}
    const investment=nextUpgrade(w);let context='';
    if(w.mode.startsWith('invest:'))context=availableCash(w)===0&&investment?`还差 $${investment.cost-investment.paid} · 已投入金额会保留`:'正在投入现金…';
    else if(used===w.player.bag.capacity)context='MAX · 背包满了，先去卸货';
    else if(w.mode==='wheat-harvest')context='正在收割小麦…';else if(w.mode==='mill-input')context='小麦送入磨坊…';else if(w.mode==='flour-output')context='面粉装入背包…';else if(w.mode==='flour-input')context='给烤炉送面粉…';else if(w.mode==='oven-egg')context='给烤炉送鸡蛋…';else if(w.mode==='cake-output')context='蛋糕装入背包…';else if(w.mode==='cake-supply')context='蛋糕上架中…';
    else if(w.mode==='pack-input')context='鸡蛋送入包装台…';else if(w.mode==='pack-output')context='礼盒装入背包…';else if(w.mode==='gift-supply')context='礼盒上架中…';else if(w.mode==='truck-load')context='正在装载批发货车…';else if(w.mode.endsWith('-cash'))context='货款收入囊中！';
    else if(w.mode==='order-delivery')context='订单货物交付中…';else if(w.mode==='feed')context='正在喂小鸡…';else if(w.mode==='eggs')context='正在收鸡蛋…';else if(w.mode==='harvest')context='正在收割…';else if(w.mode.startsWith('supply:'))context='鸡蛋上架中…';else if(w.mode.startsWith('cash:')||w.mode==='bootstrap')context='收入囊中！';
    $('context').textContent=context;$('context').classList.toggle('visible',!!context);
    $('help-hint').classList.toggle('faded',w.time>16);
    const count=w.upgrades.filter(u=>u.unlocked).length;if(count>this.lastUpgradeCount){this.lastUpgradeCount=count;this.toast(count===7?'第一章完成！去右侧开启乡间集市':unlocked(w,'cake_stall')?'烘焙工坊已建成，经营面板可补齐自动化岗位':unlocked(w,'packer')?'乡间集市已建成，右侧开启烘焙工坊':'新伙伴、新生意！农场又长大了一点');}
    $('debug-state').textContent=JSON.stringify({version:w.version,orders:w.orders,capacity:farmCapacity(w),tick:w.tick,time:w.time,fps:Math.round(fps),position:w.player.position,path:w.player.path.length,bag:w.player.bag.items,cash:w.wallet.cash,balance:availableCash(w),bank:w.bank,bakery:w.bakery,logistics:w.logistics,looseCash:w.looseCash.cash,feed:w.feed.items.corn,eggs:w.ground.items.egg,mode:w.mode,upgrades:w.upgrades.map(u=>({id:u.id,paid:u.paid,unlocked:u.unlocked})),workers:w.workers.map(a=>({id:a.id,job:a.job,position:a.position,bag:a.bag.items,task:a.task,cash:a.cash})),machine:w.machine,stations:w.stations.map(s=>({id:s.id,enabled:s.enabled,stock:s.stock.items.egg,cash:s.pendingCash})),chapter:w.chapter,stats:w.stats});
  }
  toast(text:string):void{clearTimeout(this.toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');this.toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
}
