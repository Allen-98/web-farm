import type {World} from '../domain/world.ts';
import {POLICIES,AREAS,FLOOR_NAMES,FLOOR_LIMITS,TASK_AREA,TASK_TITLES,assignment,supportedTasks,cartLevel,configureWorker,setPolicy,setFloor} from '../domain/dispatch.ts';
import {JOB_NAMES,TASK_NAMES} from '../domain/logistics.ts';
import {availableCash} from '../domain/finance.ts';
import {productionReport} from '../domain/telemetry.ts';
import type {Vec2} from '../domain/contracts.ts';

const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
function select<T extends string>(label:string,options:Partial<Record<T,string>>,value:T,change:(v:T)=>void){
  const wrap=node('label',label),s=node('select');s.setAttribute('aria-label',label);
  for(const [id,text]of Object.entries(options)){const o=node('option',String(text));o.value=id;o.selected=id===value;s.append(o);}s.addEventListener('change',()=>change(s.value as T));wrap.append(s);return wrap;
}
export function renderDispatch(w:World,purchase:(id:string)=>void,changed:(refresh?:boolean)=>void):void {
  const root=document.getElementById('dispatch-options')!;root.replaceChildren();
  const policy=node('div','','dispatch-policies');
  for(const [id,title]of Object.entries(POLICIES)){const b=node('button',title);b.dataset.policy=id;b.setAttribute('aria-pressed',String(w.dispatch.policy===id));b.addEventListener('click',()=>{setPolicy(w,id as keyof typeof POLICIES);changed();});policy.append(b);}
  root.append(policy,node('p',w.dispatch.policy==='orders'?'先补齐保底，再优先履行订单，剩余运力用于日常营业。':w.dispatch.policy==='processing'?'先补齐保底，再优先供应包装台、烤炉和面粉运输。':'先补齐保底，再按目标库存和缺货程度平衡配送。','staff-note'));
  root.append(node('h3','库存保底'));
  const floors=node('div','','floor-grid');const unlocks:Record<string,string>={car_counter:'car_counter',walk_counter:'walk_counter',pack:'pack_table',oven:'oven',flour:'oven',gift:'gift_stall',cake:'cake_stall'};
  for(const [id,name]of Object.entries(FLOOR_NAMES)){if(!w.upgrades.some(u=>u.id===unlocks[id]&&u.unlocked))continue;
    const key=id as keyof typeof FLOOR_NAMES,wrap=node('label',name),input=node('input');input.type='number';input.min='0';input.max=String(FLOOR_LIMITS[key]);input.step='1';input.value=String(w.dispatch.floors[key]);input.setAttribute('aria-label',`${name}保底`);
    input.addEventListener('input',()=>{if(input.value!==''&&setFloor(w,key,Number(input.value)))changed(false);});
    input.addEventListener('change',()=>{if(input.value===''||!setFloor(w,key,Number(input.value)))input.value=String(w.dispatch.floors[key]);});wrap.append(input);floors.append(wrap);
  }
  root.append(floors,node('p','保底是员工优先补货的目标数量，货物仍会正常消耗。订单取货前会为其他设施的保底缺口留出原料；角色手动搬运由你决定。','staff-note'));
  root.append(node('h3','员工分工与运输推车'),node('p','区域按交货地点划分，取货可以跨区。分工只影响新任务；已有货物先送完，目标失效时运回原处。专岗按员工原有工种选择。','staff-note'));
  if(!w.workers.length)root.append(node('p','招聘员工后可安排配送和购买推车。'));
  w.workers.forEach((a,index)=>{
    const card=node('article','','dispatch-worker'),header=node('div','','facility-heading'),level=cartLevel(w,a),tasks=supportedTasks(a),s=assignment(w,a);
    header.append(node('b',`${JOB_NAMES[a.job]??a.job} · ${index+1}`),node('span',level===0?'背包运输':level===1?'运输推车 Lv.1':'加固推车 Lv.2','status-good'));card.append(header);
    const claim=w.dispatch.claims[a.id],count=Object.values(a.bag.items).reduce((n,v)=>n+v,0);
    const cashTasks:Record<string,string>={car_counter:'汽车柜台收款',walk_counter:'步行柜台收款',gift:'礼盒摊收款',truck:'批发收款',cake:'蛋糕摊收款',deposit:'去 ATM 存款'};
    card.append(node('p',`载货 ${count}/${a.bag.capacity}${claim?` · 已预留 ${TASK_TITLES[claim.task]} ${claim.amount} 份`:a.task?` · ${a.job==='cashier'?cashTasks[a.task]??a.task:TASK_TITLES[a.task]??TASK_NAMES[a.task]??a.task}`:a.moving?' · 运输中':' · 待命'}`));
    if(tasks.length){const controls=node('div','','assignment-controls'),areas=Object.fromEntries(Object.entries(AREAS).filter(([id])=>id==='all'||tasks.some(t=>TASK_AREA[t]===id)));
      controls.append(select('工作区域',areas,s.area,area=>{configureWorker(w,a.id,area,'auto');changed();}));
      const focus={auto:'按策略调度',...Object.fromEntries(tasks.filter(t=>s.area==='all'||TASK_AREA[t]===s.area).map(t=>[t,TASK_TITLES[t]]))};
      controls.append(select('配送专岗',focus,s.focus,focus=>{configureWorker(w,a.id,s.area,focus);changed();}));card.append(controls);
    }else card.append(node('small','固定岗位，继续负责原有收割、饲料或收款工作。'));
    const upgrade=w.upgrades.find(u=>u.id===`cart_${a.id}_${level+1}`);
    if(upgrade){const button=node('button',`${level===0?'购买运输推车':'升级加固推车'} · $${upgrade.cost}`);button.dataset.cart=a.id;button.disabled=!upgrade.requires.every(id=>w.upgrades.some(u=>u.id===id&&u.unlocked))||availableCash(w)<upgrade.cost;button.addEventListener('click',()=>purchase(upgrade.id));
      card.append(node('small',`下一级：容量与目标批次提升至基础的 ${level+2} 倍，移速 +${(level+1)*10}%，装卸 +${(level+1)*50}%。`),button);
    }
    root.append(card);
  });
}
export function renderProductionReport(w:World,locate:(at:Vec2)=>void):void {
  const root=document.getElementById('telemetry-options')!,r=productionReport(w);root.replaceChildren();
  root.append(node('p',`最近 ${r.duration.toFixed(1)} 秒经营记录 · 最多保留 60 秒，打开面板时暂停统计。`,'staff-note'));
  const flows=node('div','','flow-grid');
  for(const [label,key]of [['玉米收获','corn'],['鸡蛋产出','egg'],['鸡蛋消耗 / 交货','eggUsed'],['小麦收获','wheat'],['面粉产出','flour'],['礼盒产出','gift'],['蛋糕产出','cake'],['营业与订单收入','revenue']]as const){const card=node('div');card.append(node('small',label),node('b',`${r.flow[key]}${key==='revenue'?' 金币':' 份'}`),node('small',`折合 ${r.duration?(r.flow[key]*60/r.duration).toFixed(1):'—'} / 分钟`));flows.append(card);}root.append(flows);
  if(!r.rows.length)root.append(node('p','建设第一座柜台后开始记录设施开工情况。'));
  for(const f of r.rows){const card=node('article','','facility-card'),heading=node('div','','facility-heading');heading.append(node('b',f.name),node('span',`开工 ${(f.utilization*100).toFixed(0)}%`,f.utilization<.6?'status-warn':'status-good'));
    const progress=node('progress');progress.max=1;progress.value=f.utilization;progress.setAttribute('aria-label',`${f.name}实际开工率`);
    card.append(heading,progress,node('p',`实际 ${f.cycles} 批 · ${f.perMinute.toFixed(1)} 批/分 · 理论满负荷 ${(60/f.seconds).toFixed(1)} 批/分`),node('small',`供料 / 配送等待 ${f.missing.toFixed(1)} 秒 · 仓满停工 ${f.full.toFixed(1)} 秒 · 本设施样本 ${f.observed.toFixed(1)} 秒`),node('p',f.advice,'bottleneck-advice'));
    const b=node('button','前往处理 ↗');b.addEventListener('click',()=>locate(f.position));card.append(b);root.append(card);
  }
}
