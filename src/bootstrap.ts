import {cashSources} from './domain/finance.ts';
import {renderOperations,renderOrders} from './presentation/operations.ts';
import {acceptOrder,claimOrder,ORDER_POINT} from './domain/orders.ts';
import type {Vec2} from './domain/contracts.ts';
import {renderStaff} from './presentation/staff.ts';
import {purchaseUpgrade} from './domain/world.ts';
import Phaser from 'phaser';
import './style.css';
import { FarmScene } from './rendering/FarmScene.ts';
import { createWorld, navigate, getGoal } from './domain/world.ts';
import { BrowserInput } from './input/BrowserInput.ts';
import { BrowserPlatform } from './platform/BrowserPlatform.ts';
import { Hud } from './presentation/hud.ts';

import type { World } from './domain/world.ts';

export function startGame(initialWorld?:World,persist=true):void {
const platform=new BrowserPlatform(),hud=new Hud();let world=initialWorld??platform.load()??createWorld();
hud.lastUpgradeCount=world.upgrades.filter(u=>u.unlocked).length;
let input:BrowserInput|undefined,manualPaused=false,hidden=document.hidden,scene:FarmScene|undefined,lastSave=0,resetArmed=false;
const menu=document.getElementById('menu')as HTMLDialogElement;
const staffMenu=document.getElementById('staff-menu')as HTMLDialogElement;
const ordersMenu=document.getElementById('orders-menu')as HTMLDialogElement;
const regionsMenu=document.getElementById('regions-menu')as HTMLDialogElement;
function save():void{if(!persist){document.getElementById('save-status')!.textContent='独立试玩检查，不写入正式存档';return;}const success=platform.save(world);document.getElementById('save-status')!.textContent=success?'进度已保存在此浏览器':'此浏览器未允许保存进度';}
function pause(paused:boolean):void{manualPaused=paused;input?.reset();if(input)input.enabled=!paused&&!hidden;if(paused){save();if(!menu.open)menu.showModal();}else{for(const dialog of [menu,staffMenu,ordersMenu,regionsMenu])if(dialog.open)dialog.close();}}
function show(dialog:HTMLDialogElement):void{manualPaused=true;input?.reset();if(input)input.enabled=false;save();dialog.showModal();}
function locate(at:Vec2):void{pause(false);if(scene?.mapCamera.overview)scene.mapCamera.follow();navigate(world,at);}
const farmScene=new FarmScene({world:()=>world,movement:()=>input?.movement()??{x:0,z:0},paused:()=>manualPaused||hidden,
  ready:s=>{scene=s;input=new BrowserInput(s.game.canvas,(x,y)=>{if(!manualPaused&&!hidden)navigate(world,s.screenToGround(x,y));},(dx,dy)=>s.mapCamera.pan(dx,dy));s.game.canvas.addEventListener('wheel',e=>{if(manualPaused||hidden||e.ctrlKey)return;e.preventDefault();s.mapCamera.zoomBy(e.deltaY<0?1.12:1/1.12);},{passive:false});document.getElementById('loading')!.classList.add('loaded');document.getElementById('loading')!.setAttribute('aria-hidden','true');hud.present(world,60);if(platform.loadFailed)hud.toast('旧进度读取失败，原存档已保留，自动保存已暂停');else if(platform.migratedFrom)hud.toast('原有进度已保留：订单板与加工升级已开放');},
  present:fps=>{hud.present(world,fps);if(world.time-lastSave>8){save();lastSave=world.time;}},
  event:e=>{platform.play(e.kind==='build'?'build':e.item);if(e.kind==='build')save();}
});
new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#97bb71',antialias:true,roundPixels:false,fps:{target:60,limit:60},scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},render:{antialias:true,pixelArt:false,powerPreference:'high-performance'},scene:[farmScene],audio:{noAudio:true}});
document.getElementById('goal')!.addEventListener('click',()=>{if(!manualPaused){input?.reset();navigate(world,getGoal(world).target);}});
document.getElementById('zoom-in')!.addEventListener('click',()=>scene?.mapCamera.zoomBy(1.25));
document.getElementById('zoom-out')!.addEventListener('click',()=>scene?.mapCamera.zoomBy(1/1.25));
document.getElementById('map-overview')!.addEventListener('click',()=>{input?.reset();scene?.mapCamera.toggle();});
for(const kind of ['staff','capacity','operations'])document.getElementById(`${kind}-tab`)!.addEventListener('click',()=>{for(const panel of ['staff','capacity','operations']){document.getElementById(`${panel}-panel`)!.hidden=panel!==kind;document.getElementById(`${panel}-tab`)!.setAttribute('aria-selected',String(panel===kind));}});
document.getElementById('staff')!.addEventListener('click',()=>{renderStaff(world,hire);renderOperations(world,hire,locate);show(staffMenu);});
function hire(id:string):void{const before=world.events.length;if(purchaseUpgrade(world,id)){for(const event of world.events.slice(before))scene?.flight(event);save();hud.present(world,60);hud.toast(`${world.upgrades.find(u=>u.id===id)!.label}已完成`);}renderStaff(world,hire);renderOperations(world,hire,locate);}
function orders():void{renderOrders(world,id=>{if(acceptOrder(world,id)){save();hud.present(world,60);orders();}},()=>{const reward=claimOrder(world);if(reward){save();hud.present(world,60);hud.toast(`订单完成，货款 $${reward} 已到账`);}orders();},()=>locate(ORDER_POINT));}
document.getElementById('orders')!.addEventListener('click',()=>{orders();show(ordersMenu);});
document.getElementById('orders-close')!.addEventListener('click',()=>pause(false));ordersMenu.addEventListener('cancel',e=>{e.preventDefault();pause(false);});
document.getElementById('chapter-map')!.addEventListener('click',()=>{for(const [id,unlock]of [['farm','car_counter'],['market','market_land'],['bakery','bakery_land'],['orders','car_counter']]){const b=document.querySelector(`[data-region="${id}"]`)as HTMLButtonElement;b.disabled=!world.upgrades.some(u=>u.id===unlock&&u.unlocked);}show(regionsMenu);});
const regions:Record<string,Vec2>={farm:{x:15,z:11},market:{x:30,z:11},bakery:{x:49,z:11},orders:ORDER_POINT};
document.querySelectorAll<HTMLButtonElement>('[data-region]').forEach(button=>button.addEventListener('click',()=>locate(regions[button.dataset.region!])));
document.getElementById('regions-close')!.addEventListener('click',()=>pause(false));regionsMenu.addEventListener('cancel',e=>{e.preventDefault();pause(false);});
document.getElementById('staff-collect')!.addEventListener('click',()=>{const source=cashSources(world).sort((a,b)=>b.amount-a.amount)[0];pause(false);if(source?.amount)navigate(world,source.at);});
document.getElementById('staff-close')!.addEventListener('click',()=>pause(false));staffMenu.addEventListener('cancel',e=>{e.preventDefault();pause(false);});
document.getElementById('pause')!.addEventListener('click',()=>pause(true));document.getElementById('resume')!.addEventListener('click',()=>pause(false));
menu.addEventListener('cancel',e=>{e.preventDefault();pause(false);});
window.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();pause(!manualPaused);}});
document.getElementById('sound')!.addEventListener('click',()=>{document.getElementById('sound')!.textContent=platform.toggleAudio()?'声音：开启':'声音：关闭';});
document.getElementById('reset')!.addEventListener('click',()=>{const button=document.getElementById('reset')!;if(!resetArmed){resetArmed=true;button.textContent='确认清空进度，重新开始';setTimeout(()=>{resetArmed=false;button.textContent='开始新的农场';},5000);return;}platform.clear();world=createWorld();lastSave=0;hud.lastUpgradeCount=0;hud.lastCash=-1;scene?.cameras.main.pan(0,468,300);save();resetArmed=false;button.textContent='开始新的农场';pause(false);hud.toast('新一天的小农场，出发吧！');});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;input?.reset();if(input)input.enabled=!manualPaused&&!hidden;if(hidden)save();});
window.addEventListener('pagehide',save);
window.addEventListener('error',e=>{document.getElementById('loading')!.innerHTML='<b>农场加载遇到问题</b><span>请刷新页面重试，或查看控制台错误信息。</span>';console.error(e.error);});

}
