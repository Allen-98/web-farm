import type {World} from '../domain/world.ts';
import type {Vec2} from '../domain/contracts.ts';
import {facilityStatuses,operationsUpgrades} from '../domain/operations.ts';
import {availableCash} from '../domain/finance.ts';
import {orderOffers,orderRemaining,orderReady,rushRemaining,TRADE_ITEMS,ITEM_NAMES} from '../domain/orders.ts';

export function renderOperations(w:World,purchase:(id:string)=>void,locate:(at:Vec2)=>void):void {
  const root=document.getElementById('operations-options')!;root.replaceChildren();
  const statuses=facilityStatuses(w);
  if(!statuses.length)root.textContent='先建设汽车柜台，开启设施经营。';
  for(const f of statuses){
    const card=document.createElement('article');card.className='facility-card';
    const header=document.createElement('div'),title=document.createElement('b'),status=document.createElement('span');
    header.className='facility-heading';title.textContent=`${f.name} Lv.${f.level}`;status.textContent=f.state;status.className=f.blocked?'status-warn':'status-good';header.append(title,status);
    const copy=document.createElement('p');copy.textContent=f.detail;
    const metrics=document.createElement('small');metrics.textContent=`${f.seconds.toFixed(2).replace(/0$/,'')} 秒 / 批 · 满负荷 ${(60/f.seconds).toFixed(1)} 批 / 分钟\n${f.total}`;
    const actions=document.createElement('div');actions.className='facility-actions';
    const locateButton=document.createElement('button');locateButton.textContent='前往查看 ↗';locateButton.addEventListener('click',()=>locate(f.position));actions.append(locateButton);
    const spec=operationsUpgrades.find(u=>u.id===`speed_${f.id}_${f.level+1}`);
    if(spec){const u=w.upgrades.find(u=>u.id===spec.id)!,button=document.createElement('button');button.dataset.upgrade=u.id;button.disabled=availableCash(w)<u.cost;button.textContent=`${f.level===0?'提速 1.5×':'提速 2×'} · $${u.cost}`;button.addEventListener('click',()=>purchase(u.id));actions.append(button);}
    else {const max=document.createElement('small');max.textContent='已达到本轮最高等级';actions.append(max);}
    card.append(header,copy,metrics,actions);root.append(card);
  }
}
export function renderOrders(w:World,accept:(id:string)=>void,claim:()=>void,deliver:()=>void):void {
  const root=document.getElementById('order-options')!,o=w.orders,a=o.active;root.replaceChildren();
  document.getElementById('order-summary')!.textContent=`商誉 Lv.${1+Math.floor(o.completed/5)} · 已完成 ${o.completed} 单 · 订单收入 $${o.revenue}`;
  if(a){
    const card=document.createElement('article');card.className='order-card active-order';
    const title=document.createElement('h3');title.textContent=a.offer.title;
    const time=document.createElement('p');time.className='order-clock';time.textContent=a.offer.rush?(orderReady(w)&&rushRemaining(w)>0?'准时备齐 · 加急奖金已保留':rushRemaining(w)>0?`加急奖励剩余 ${Math.ceil(rushRemaining(w))} 秒（经营时间）`:'已转普通单 · 已交货物保留，仍可结算基础货款'):'普通订单 · 不限时，慢慢准备';
    card.append(title,time);
    for(const item of TRADE_ITEMS.filter(i=>a.offer.requires[i])){
      const row=document.createElement('div');row.className='order-line';const name=document.createElement('span'),count=document.createElement('b'),bar=document.createElement('progress');name.textContent=ITEM_NAMES[item];count.textContent=`${a.stock.items[item]} / ${a.offer.requires[item]}`;bar.max=a.offer.requires[item];bar.value=a.stock.items[item];bar.setAttribute('aria-label',`${ITEM_NAMES[item]}交货进度`);row.append(name,count,bar);card.append(row);
    }
    const payout=document.createElement('p');payout.textContent=`基础货款 $${a.offer.reward}${a.offer.bonus?` · 准时额外 +$${a.offer.bonus}`:''}`;card.append(payout);
    const action=document.createElement('button');action.className='primary';action.textContent=orderReady(w)?`领取 $${a.offer.reward+(rushRemaining(w)>0?a.offer.bonus:0)}`:'前往交货区 ↗';action.id='order-action';action.addEventListener('click',orderReady(w)?claim:deliver);card.append(action);
    const note=document.createElement('small');note.textContent='走到订单板前自动卸下背包中的所需货物；店员、运蛋员、礼盒配送和蛋糕配送会优先协助。缺少的配送岗位可在经营面板招聘。';card.append(note);root.append(card);
  } else {
    const offers=orderOffers(w);
    if(!offers.length)root.textContent='建设汽车柜台后开放订单。';
    for(const offer of offers){
      const card=document.createElement('article');card.className='order-card';const title=document.createElement('h3'),tag=document.createElement('small'),cargo=document.createElement('p'),reward=document.createElement('b'),button=document.createElement('button');
      title.textContent=offer.title;tag.textContent=offer.rush?'4 分钟加急 · 超时保留基础货款':'普通订单 · 不限时';cargo.textContent=TRADE_ITEMS.filter(i=>offer.requires[i]).map(i=>`${ITEM_NAMES[i]} × ${offer.requires[i]}`).join(' ＋ ');reward.textContent=`$${offer.reward}${offer.bonus?` + 准时奖 $${offer.bonus}`:''}`;button.textContent='接受订单';button.dataset.accept=offer.id;button.addEventListener('click',()=>accept(offer.id));card.append(title,tag,cargo,reward,button);root.append(card);
    }
  }
}
