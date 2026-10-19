import {cycleSeconds,facilityLevel,facilityStatuses} from '../domain/operations.ts';
import Phaser from 'phaser';
import {tex,box,poly} from './ChapterView.ts';
import {project} from './projection.ts';
import {bakeryConfig as config} from '../domain/bakery.ts';
import {has} from '../domain/chapter2.ts';
import {ATM,bankOpen} from '../domain/finance.ts';
import type {World} from '../domain/world.ts';
import type {Vec2} from '../domain/contracts.ts';
export const BAKERY_ASSETS={wheat:'crop.wheat',wheatUnit:'resource.wheat',flour:'resource.flour',cake:'resource.cake'};
const TEXT={fontFamily:'Microsoft YaHei, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#fff6d8',stroke:'#655e40',strokeThickness:3};
function createBakeryArt(s:Phaser.Scene):void {
  tex(s,BAKERY_ASSETS.wheat,64,100,c=>{for(let i=0;i<5;i++){const x=13+i*9,y=8+(i%2)*9;c.strokeStyle='#b38e38';c.lineWidth=3;c.beginPath();c.moveTo(32,94);c.lineTo(x,y+22);c.stroke();for(let j=0;j<5;j++){c.fillStyle=j%2?'#f6d575':'#e4b94c';c.beginPath();c.ellipse(x+(j%2?4:-4),y+j*5,4,8,j%2?.5:-.5,0,7);c.fill();}}});
  tex(s,BAKERY_ASSETS.wheatUnit,40,24,c=>{box(c,20,15,18,7,9,'#efd381','#b88d42','#d4b05e');c.fillStyle='#a8854c';c.fillRect(17,3,5,15);});
  tex(s,BAKERY_ASSETS.flour,42,48,c=>{c.fillStyle='#ede4bf';c.beginPath();c.moveTo(12,3);c.lineTo(30,3);c.lineTo(28,12);c.bezierCurveTo(42,35,37,45,20,45);c.bezierCurveTo(1,45,0,32,14,12);c.fill();c.fillStyle='#bca573';c.fillRect(12,8,18,5);c.fillStyle='#8b9d67';c.beginPath();c.roundRect(10,24,22,12,3);c.fill();c.fillStyle='#fff4cf';c.font='bold 11px sans-serif';c.fillText('麦',15,34);});
  tex(s,BAKERY_ASSETS.cake,54,43,c=>{c.fillStyle='#e6dfbd';c.beginPath();c.ellipse(27,35,25,7,0,0,7);c.fill();box(c,27,26,21,10,17,'#fff0cc','#d18b68','#e5af82');box(c,27,19,22,10,5,'#f8dfbc','#efe3b6','#eed3a4');c.fillStyle='#ca6862';for(const x of [16,27,38]){c.beginPath();c.arc(x,12+(x===27?-2:2),4,0,7);c.fill();}});
  tex(s,'building.mill',270,240,c=>{box(c,135,178,101,40,25,'#c5b78a','#8c7850','#ac9661');box(c,135,143,60,26,99,'#e5d6af','#a9956c','#c0ac80');poly(c,[[66,58],[132,20],[204,56],[135,90]],'#8d7560');c.fillStyle='#5c776c';c.beginPath();c.ellipse(135,113,30,31,0,0,7);c.fill();box(c,73,170,22,10,16,'#c3b07d','#968452','#b39d67');});
  tex(s,'building.oven',260,210,c=>{box(c,130,154,100,40,28,'#d9af88','#956c51','#b48760');box(c,130,116,76,30,62,'#e0b48b','#b66f50','#ca8d62');c.fillStyle='#664c42';c.beginPath();c.roundRect(91,82,77,56,25);c.fill();c.fillStyle='#edb767';c.beginPath();c.roundRect(101,94,58,33,15);c.fill();box(c,175,57,20,9,47,'#d2b18e','#9f785c','#bd9774');box(c,62,149,20,9,9,'#f2ddaf','#b89363','#d9b27a');});
  tex(s,'building.cake-stall',300,230,c=>{for(const x of [45,250]){c.fillStyle='#967554';c.fillRect(x,70,9,132);}box(c,150,176,117,44,34,'#e2d4ae','#a77b77','#be9591');poly(c,[[20,65],[149,17],[280,65],[150,115]],'#efdfb9');for(let i=0;i<6;i++)poly(c,[[21+i*21,65-i*8],[42+i*21,57-i*8],[170+i*18,107-i*8],[150+i*18,115-i*8]],i%2?'#f9ead0':'#b57b81');c.fillStyle='#fff6dc';c.beginPath();c.roundRect(106,62,88,25,6);c.fill();c.fillStyle='#966965';c.font='bold 15px Microsoft YaHei';c.textAlign='center';c.fillText('田园烘焙',150,80);});
  tex(s,'building.atm',96,132,c=>{box(c,48,110,33,13,90,'#c3d4b0','#3f807b','#70a399');c.fillStyle='#304f57';c.fillRect(29,37,39,29);c.fillStyle='#abd5a7';c.fillRect(34,42,29,19);c.fillStyle='#fff0b5';c.font='bold 16px sans-serif';c.fillText('$',42,58);c.fillStyle='#d7d7b1';c.fillRect(36,77,27,5);c.fillStyle='#f5e8bd';c.font='bold 13px sans-serif';c.fillText('ATM',32,28);});
}
export class BakeryView {
  s:Phaser.Scene;land:Phaser.GameObjects.Graphics;gate:Phaser.GameObjects.Text;title:Phaser.GameObjects.Text;
  wheat:Phaser.GameObjects.Image[]=[];buildings=new Map<string,Phaser.GameObjects.Image>();
  pads:{id:string;g:Phaser.GameObjects.Graphics;label:Phaser.GameObjects.Text;requires:string}[]=[];
  stocks:{id:string;images:Phaser.GameObjects.Image[]}[]=[];
  millText:Phaser.GameObjects.Text;ovenText:Phaser.GameObjects.Text;atm:Phaser.GameObjects.Image;atmLabel:Phaser.GameObjects.Text;
  customers:Phaser.GameObjects.Image[]=[];
  constructor(s:Phaser.Scene){
    this.s=s;createBakeryArt(s);const a=config.area;
    const rect=(x:number,z:number,width:number,height:number)=>[{x,z},{x:x+width,z},{x:x+width,z:z+height},{x,z:z+height}].map(p=>project(p));
    this.land=s.add.graphics().setDepth(-989).fillStyle(0xbac889).fillPoints(rect(a.x,a.z,a.width,a.height),true).lineStyle(5,0xe3d2a5).strokePoints(rect(a.x,a.z,a.width,a.height),true);
    this.land.fillStyle(0xd8c5a0).fillPoints(rect(42,9.3,19,1.5),true).fillStyle(0x9d8055).fillPoints(rect(42.5,1.6,6.4,6.2),true);
    const gate=project(config.points.gate);this.gate=s.add.text(gate.x+100,gate.y-65,'烘焙工坊\n完成集市后开放',{...TEXT,fontSize:'16px',align:'center',backgroundColor:'#847654',padding:{x:14,y:9}}).setOrigin(.5).setDepth(gate.y+1);
    const title=project({x:54,z:1.5});this.title=s.add.text(title.x,title.y-80,'CHAPTER 03\n烘 焙 工 坊',{...TEXT,fontSize:'18px',align:'center'}).setOrigin(.5).setDepth(-900);
    for(let i=0;i<25;i++){const p=project({x:43.5+(i%5)*1.1,z:2.5+Math.floor(i/5)*1.1});this.wheat.push(s.add.image(p.x,p.y,BAKERY_ASSETS.wheat).setOrigin(.5,.95).setScale(.58).setDepth(p.y));}
    for(const b of config.buildings){const p=project(b.center),key=b.id==='mill'?'building.mill':b.id==='oven'?'building.oven':'building.cake-stall';this.buildings.set(b.id,s.add.image(p.x,p.y,key).setOrigin(.5,b.id==='mill'?178/240:b.id==='oven'?154/210:176/230).setScale(.9).setDepth(p.y+8));}
    const pad=(id:string,at:Vec2,name:string,requires:string)=>{const p=project(at),g=s.add.graphics().setDepth(-1),points=[{x:p.x-40,y:p.y},{x:p.x,y:p.y-21},{x:p.x+40,y:p.y},{x:p.x,y:p.y+21}];g.fillStyle(0xcce1b6,.2).fillPoints(points,true).lineStyle(2,0xfff4cf,.95).strokePoints(points,true);const label=s.add.text(p.x,p.y,name,TEXT).setOrigin(.5).setDepth(p.y-5);this.pads.push({id,g,label,requires});};
    pad('millInput',config.points.millInput,'送小麦','mill');pad('flourOutput',config.points.flourOutput,'取面粉','mill');pad('flourInput',config.points.flourInput,'送面粉','oven');pad('eggInput',config.points.eggInput,'送鸡蛋','oven');pad('cakeOutput',config.points.cakeOutput,'取蛋糕','oven');pad('cakeSupply',config.points.cakeSupply,'蛋糕供货','cake_stall');pad('cash',config.points.cash,'$ 0','cake_stall');
    const stack=(id:string,at:Vec2,key:string)=>{const p=project(at);this.stocks.push({id,images:Array.from({length:18},(_,i)=>s.add.image(p.x,p.y-i*6,key).setScale(.65).setDepth(p.y+1+i*.01).setVisible(false))});};
    stack('wheat',{x:45,z:14},BAKERY_ASSETS.wheatUnit);stack('flour',{x:48.5,z:12.5},BAKERY_ASSETS.flour);stack('cake',{x:56,z:6.5},BAKERY_ASSETS.cake);stack('stock',{x:55.7,z:15},BAKERY_ASSETS.cake);stack('cash',{x:60,z:16.5},'resource.cash');
    const m=project(config.buildings[0].center),o=project(config.buildings[1].center);
    this.millText=s.add.text(m.x,m.y-155,'',{...TEXT,backgroundColor:'#6f7658df',padding:{x:10,y:7},align:'center'}).setOrigin(.5,1).setDepth(m.y+100);
    this.ovenText=s.add.text(o.x,o.y-125,'',{...TEXT,backgroundColor:'#896b53df',padding:{x:10,y:7},align:'center'}).setOrigin(.5,1).setDepth(o.y+100);
    const ap=project({x:25.5,z:15.3});this.atm=s.add.image(ap.x,ap.y,'building.atm').setOrigin(.5,110/132).setScale(.8).setDepth(ap.y+8);
    this.atmLabel=s.add.text(ap.x,ap.y-105,'',{...TEXT,align:'center',backgroundColor:'#456e61df',padding:{x:9,y:6}}).setOrigin(.5).setDepth(ap.y+100);
    pad('atm',ATM,'ATM','market_land');
    for(let i=0;i<3;i++){const p=project({x:55+i,z:18.1});this.customers.push(s.add.image(p.x,p.y,'actor.customer2.0.0').setOrigin(.5,100/110).setScale(.5).setDepth(p.y+1));}
  }
  update(w:World):void {
    const open=has(w,'bakery_land'),b=w.bakery;
    this.land.setAlpha(open?1:.3);this.title.setVisible(open);this.gate.setVisible(!open).setText(has(w,'packer')?'烘焙工坊\n投资新地块，开启第三章':'烘焙工坊\n完成集市后开放');
    for(const[id,v]of this.buildings)v.setVisible(has(w,id));
    this.wheat.forEach((v,i)=>v.setVisible(has(w,'wheat_field')).setScale(b.crops[i].readyAt<=w.time?.58:.17).setAlpha(b.crops[i].readyAt<=w.time?1:.65));
    for(const p of this.pads){p.g.setVisible(has(w,p.requires));p.label.setVisible(has(w,p.requires));if(p.id==='cash')p.label.setText(`$ ${b.pendingCash}`);if(p.id==='atm')p.label.setText(bankOpen(w)?'账户存款':'招聘面板建 ATM');}
    const amounts:Record<string,number>={wheat:Math.ceil(b.millInput.items.wheat/4),flour:b.flour.items.flour,cake:b.cakes.items.cake,stock:b.stock.items.cake,cash:Math.ceil(b.pendingCash/40)};
    this.stocks.forEach(t=>t.images.forEach((v,i)=>{v.setVisible(i<Math.min(18,amounts[t.id]));if(t.id==='stock')v.setY(project({x:55.7,z:15}).y-45-i*6);}));
    this.millText.setVisible(has(w,'mill')).setText(`小麦 ${b.millInput.items.wheat} → 面粉 ${b.flour.items.flour}\n${facilityStatuses(w).find(f=>f.id==='mill')?.state} · Lv.${facilityLevel(w,'mill')} · 研磨 ${Math.floor(b.millTime/cycleSeconds(w,'mill')*100)}%`);
    this.ovenText.setVisible(has(w,'oven')).setText(`面粉 ${b.ovenFlour.items.flour} + 鸡蛋 ${b.ovenEgg.items.egg}\n${facilityStatuses(w).find(f=>f.id==='oven')?.state} · Lv.${facilityLevel(w,'oven')} · 蛋糕 ${b.cakes.items.cake} · 烘烤 ${Math.floor(b.ovenTime/cycleSeconds(w,'oven')*100)}%`);
    this.atm.setVisible(has(w,'market_land')).setAlpha(bankOpen(w)?1:.4);this.atmLabel.setVisible(has(w,'market_land')).setText(bankOpen(w)?`ATM 账户\n余额 $${w.bank.cash}`:'ATM $250\n在经营面板建设');
    this.customers.forEach(v=>v.setVisible(has(w,'cake_stall')));
  }
}
