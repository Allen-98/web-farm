import {capacityUpgrades,farmCapacity} from '../domain/capacity.ts';
import {bakeryConfig} from '../domain/bakery.ts';
import {availableCash} from '../domain/finance.ts';
import {eligible} from '../domain/chapter2.ts';
import {JOB_NAMES,TASK_NAMES} from '../domain/logistics.ts';
import type {World} from '../domain/world.ts';
export function renderStaff(w:World,purchase:(id:string)=>void):void {
  document.getElementById('staff-balance')!.textContent=`可用余额 $${availableCash(w)} · ATM $${w.bank.cash} · 员工待存 $${w.workers.reduce((n,a)=>n+a.cash,0)}`;
  const root=document.getElementById('staff-options')!;root.replaceChildren();
  const options=[...bakeryConfig.automation,...(!w.upgrades.find(u=>u.id==='packer')!.unlocked?[{id:'packer',description:'早期运蛋和礼盒任务均可支援；首车完成后解锁'}]:[])];
  for(const spec of options){
    const u=w.upgrades.find(u=>u.id===spec.id)!;
    const row=document.createElement('div');row.className='staff-row';const copy=document.createElement('div'),name=document.createElement('b'),detail=document.createElement('p');name.textContent=u.label??u.id;detail.textContent=spec.description;copy.append(name,detail);
    const button=document.createElement('button');button.dataset.hire=u.id;
    const missing=u.requires.filter(id=>!w.upgrades.find(u=>u.id===id)?.unlocked);
    button.disabled=u.unlocked||!!missing.length||!eligible(w,u.id)||availableCash(w)<u.cost-u.paid;
    button.textContent=u.unlocked?'已到岗':missing.length?'待建设':!eligible(w,u.id)?'首车后开放':`$${u.cost-u.paid}`;
    if(missing.length)detail.textContent+=` · 需要${missing.map(id=>w.upgrades.find(u=>u.id===id)?.label??id).join('、')}`;
    if(u.id==='bank_atm'&&u.unlocked)button.textContent='已建成';button.addEventListener('click',()=>purchase(u.id));row.append(copy,button);root.append(row);
  }
  const roster=document.getElementById('staff-roster')!;roster.replaceChildren();
  if(!w.workers.length)roster.textContent='建设第一章收割小队后开始招聘';
  for(const a of w.workers){const row=document.createElement('div');row.className='roster-row';const cashTasks:Record<string,string>={car_counter:'汽车柜台收款',walk_counter:'步行柜台收款',gift:'礼盒摊收款',truck:'批发货款',cake:'蛋糕摊收款',deposit:'去 ATM 存款'};const task=a.task?(a.job==='cashier'?cashTasks[a.task]:TASK_NAMES[a.task])??a.task:a.moving?'运输中':'待命';row.textContent=`${JOB_NAMES[a.job]??a.job} · ${task}${a.cash?` · 携款 $${a.cash}`:''}`;roster.append(row);}
  renderCapacity(w,purchase);
}

function renderCapacity(w:World,purchase:(id:string)=>void):void {
  const f=farmCapacity(w),summary=document.getElementById('capacity-summary')!;
  const cornStatus=w.machine.bag.items.corn>=w.machine.bag.capacity?'收割机仓满，等待运输':w.feed.items.corn>=w.feed.capacity?'饲料仓满，按需收割':w.machine.active?'机械收割与运输中':'等待购买收割机';
  const eggStatus=w.ground.items.egg>=w.ground.capacity?'集蛋区满，等待供货':w.feed.items.corn===0?'缺少饲料，等待玉米':'正在产蛋';
  summary.replaceChildren();
  for(const [title,body,status]of [
    [`玉米 Lv.${f.cornLevel}`,`每株 ${f.yield} 份 · 理论 ${f.cornPerSecond} 份/秒`,`${cornStatus} · 饲料 ${w.feed.items.corn}/${f.feed}`],
    [`鸡舍 Lv.${f.coopLevel}`,`${f.chickens} 只鸡 · 理论 ${f.eggsPerSecond} 枚/秒`,`${eggStatus} · 鸡蛋 ${w.ground.items.egg}/${f.ground}`]
  ]){const card=document.createElement('div'),heading=document.createElement('b'),text=document.createElement('p'),detail=document.createElement('small');card.className='capacity-card';heading.textContent=title;text.textContent=body;detail.textContent=status;card.append(heading,text,detail);summary.append(card);}
  const root=document.getElementById('capacity-options')!;root.replaceChildren();
  for(const spec of capacityUpgrades){
    const u=w.upgrades.find(u=>u.id===spec.id)!,missing=u.requires.filter(id=>!w.upgrades.find(u=>u.id===id)?.unlocked);
    const row=document.createElement('div'),copy=document.createElement('div'),name=document.createElement('b'),detail=document.createElement('p'),button=document.createElement('button');
    row.className='staff-row';name.textContent=spec.label;detail.textContent=spec.description;
    if(missing.length)detail.textContent+=` · 需要${missing.map(id=>w.upgrades.find(u=>u.id===id)?.label??id).join('、')}`;
    button.dataset.upgrade=u.id;button.disabled=u.unlocked||!!missing.length||availableCash(w)<u.cost-u.paid;
    button.textContent=u.unlocked?'已升级':missing.length?'待开放':`$${u.cost-u.paid}`;
    if(!u.unlocked&&!missing.length&&availableCash(w)<u.cost-u.paid)detail.textContent+=` · 还差 $${u.cost-u.paid-availableCash(w)}`;
    button.addEventListener('click',()=>purchase(u.id));copy.append(name,detail);row.append(copy,button);root.append(row);
  }
}
