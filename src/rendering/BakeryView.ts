import {cycleSeconds,facilityLevel,facilityStatuses} from '../domain/operations.ts';
import Phaser from 'phaser';
import {marketStall,WORLD_TEXT,oval,stroke,planter} from './illustration.ts';
import {createLand} from './landscape.ts';
import {tex,box,poly} from './ChapterView.ts';
import {project} from './projection.ts';
import {bakeryConfig as config} from '../domain/bakery.ts';
import {has} from '../domain/chapter2.ts';
import {ATM,bankOpen} from '../domain/finance.ts';
import type {World} from '../domain/world.ts';
import type {Vec2} from '../domain/contracts.ts';
export const BAKERY_ASSETS={wheat:'crop.wheat',wheatUnit:'resource.wheat',flour:'resource.flour',cake:'resource.cake'};
const TEXT={...WORLD_TEXT,fontStyle:'bold'};
function createBakeryArt(s:Phaser.Scene):void {
  tex(s,BAKERY_ASSETS.wheat,64,100,c=>{for(let i=0;i<5;i++){const x=13+i*9,y=8+(i%2)*9;c.strokeStyle='#b38e38';c.lineWidth=3;c.beginPath();c.moveTo(32,94);c.lineTo(x,y+22);c.stroke();for(let j=0;j<5;j++){c.fillStyle=j%2?'#f6d575':'#e4b94c';c.beginPath();c.ellipse(x+(j%2?4:-4),y+j*5,4,8,j%2?.5:-.5,0,7);c.fill();}}});
  tex(s,BAKERY_ASSETS.wheatUnit,40,24,c=>{box(c,20,15,18,7,9,'#efd381','#b88d42','#d4b05e');c.fillStyle='#a8854c';c.fillRect(17,3,5,15);});
  tex(s,BAKERY_ASSETS.flour,42,48,c=>{c.fillStyle='#ede4bf';c.beginPath();c.moveTo(12,3);c.lineTo(30,3);c.lineTo(28,12);c.bezierCurveTo(42,35,37,45,20,45);c.bezierCurveTo(1,45,0,32,14,12);c.fill();c.fillStyle='#bca573';c.fillRect(12,8,18,5);c.fillStyle='#8b9d67';c.beginPath();c.roundRect(10,24,22,12,3);c.fill();c.fillStyle='#fff4cf';c.font='bold 11px sans-serif';c.fillText('麦',15,34);});
  tex(s,BAKERY_ASSETS.cake,54,43,c=>{c.fillStyle='#e6dfbd';c.beginPath();c.ellipse(27,35,25,7,0,0,7);c.fill();box(c,27,26,21,10,17,'#fff0cc','#d18b68','#e5af82');box(c,27,19,22,10,5,'#f8dfbc','#efe3b6','#eed3a4');c.fillStyle='#ca6862';for(const x of [16,27,38]){c.beginPath();c.arc(x,12+(x===27?-2:2),4,0,7);c.fill();}});
  tex(s,'building.mill',270,240,c=>{
    oval(c,139,194,104,24,'#425e4924');box(c,135,178,101,40,25,'#d7c197','#ac9066','#bea579');
    box(c,135,148,60,26,99,'#f1e5c3','#c7b084','#e0c99e');
    poly(c,[[66,58],[132,20],[204,56],[135,90]],'#7e9a89');poly(c,[[66,58],[135,90],[135,101],[66,68]],'#597b6b');poly(c,[[135,90],[204,56],[204,66],[135,101]],'#6c8d7b');
    for(let i=1;i<5;i++)stroke(c,[[79+i*11,52-i*6],[144+i*11,83-i*6]],'#d4dbb655',2);
    oval(c,135,120,28,28,'#8f795a');oval(c,135,120,23,23,'#bfa77d');
    for(let i=0;i<8;i++){const a=i*Math.PI/4;stroke(c,[[135,120],[135+Math.cos(a)*21,120+Math.sin(a)*21]],'#816c50',3);}
    oval(c,135,120,7,7,'#e5ce9e');
    for(const [dx,dy]of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      c.save();c.translate(135,93);c.rotate(Math.atan2(dy,dx));poly(c,[[10,-5],[70,-7],[70,6],[10,4]],'#f7edcc');stroke(c,[[14,0],[72,0]],'#a39068',2);for(let i=28;i<68;i+=12)stroke(c,[[i,-6],[i,5]],'#cbbb92',1);c.restore();
    }
    oval(c,135,93,9,9,'#c8a677');oval(c,133,91,4,4,'#f7e6bf');
    box(c,73,170,22,10,16,'#d5be8e','#a88b60','#c2a679');planter(c,207,175);
  });
  tex(s,'building.oven',260,210,c=>{
    oval(c,133,174,103,25,'#425e4924');box(c,130,154,100,40,28,'#e3c49b','#af8865','#c7a078');
    box(c,130,116,76,30,62,'#ecc8a0','#c88e6c','#dca77e');
    for(let row=0;row<3;row++){stroke(c,[[56,70+row*16],[128,98+row*16]],'#f9dbb688',2);}
    c.fillStyle='#795847';c.beginPath();c.roundRect(91,82,77,56,[30,30,4,4]);c.fill();
    c.fillStyle='#b97548';c.beginPath();c.roundRect(100,93,59,34,[22,22,2,2]);c.fill();
    for(const [x,y,r]of [[114,118,9],[131,111,13],[148,120,8]])oval(c,x,y,r,r*.9,'#edbd70');
    oval(c,131,120,8,10,'#ffe0a0');stroke(c,[[99,137],[164,137]],'#f7d3a2',6);
    box(c,185,69,19,9,43,'#edcba7','#bb8a68','#d1a17d');box(c,185,28,23,11,8,'#f4dcba','#b88d6b','#ceac82');
    box(c,62,149,20,9,9,'#f2ddaf','#b89363','#d9b27a');planter(c,207,157);
  });
  tex(s,'building.cake-stall',300,230,c=>{marketStall(c,'田 园 烘 焙','#bb8c8b','#a77678');box(c,168,150,28,12,15,'#fff0d2','#ca9270','#e0b38a');box(c,168,138,29,12,4,'#fff8e6','#eddbb8','#f2e2c3');for(const x of [152,168,184])oval(c,x,126+(x===168?-5:0),4,4,'#bd745d');});
  tex(s,'building.atm',96,132,c=>{box(c,48,110,33,13,90,'#c3d4b0','#3f807b','#70a399');c.fillStyle='#304f57';c.fillRect(29,37,39,29);c.fillStyle='#abd5a7';c.fillRect(34,42,29,19);c.fillStyle='#fff0b5';c.font='bold 16px sans-serif';c.fillText('$',42,58);c.fillStyle='#d7d7b1';c.fillRect(36,77,27,5);c.fillStyle='#f5e8bd';c.font='bold 13px sans-serif';c.fillText('ATM',32,28);});
}
export class BakeryView {
  s:Phaser.Scene;land:Phaser.GameObjects.Image;gate:Phaser.GameObjects.Text;title:Phaser.GameObjects.Text;
  wheat:Phaser.GameObjects.Image[]=[];buildings=new Map<string,Phaser.GameObjects.Image>();
  pads:{id:string;g:Phaser.GameObjects.Graphics;label:Phaser.GameObjects.Text;requires:string}[]=[];
  stocks:{id:string;images:Phaser.GameObjects.Image[]}[]=[];
  millText:Phaser.GameObjects.Text;ovenText:Phaser.GameObjects.Text;atm:Phaser.GameObjects.Image;atmLabel:Phaser.GameObjects.Text;
  customers:Phaser.GameObjects.Image[]=[];
  constructor(s:Phaser.Scene){
    this.s=s;createBakeryArt(s);this.land=createLand(s,'land.bakery',config.area,3);
    const gate=project(config.points.gate);this.gate=s.add.text(gate.x+100,gate.y-65,'烘焙工坊\n完成集市后开放',{...TEXT,fontSize:'16px',align:'center',backgroundColor:'#847654',padding:{x:14,y:9}}).setOrigin(.5).setDepth(gate.y+1);
    const title=project({x:config.area.x+12,z:config.area.z+.5});this.title=s.add.text(title.x,title.y-80,'03  /  烘焙工坊',{...TEXT,fontSize:'16px',align:'center',color:'#716349',stroke:'#eee1bb',strokeThickness:4}).setOrigin(.5).setDepth(-900);
    for(let i=0;i<25;i++){const p=project({x:config.field.x+.5+(i%5)*1.1,z:config.field.z+.5+Math.floor(i/5)*1.1});this.wheat.push(s.add.image(p.x,p.y,BAKERY_ASSETS.wheat).setOrigin(.5,.95).setScale(.58).setDepth(p.y));}
    for(const b of config.buildings){const p=project(b.center),key=b.id==='mill'?'building.mill':b.id==='oven'?'building.oven':'building.cake-stall';this.buildings.set(b.id,s.add.image(p.x,p.y,key).setOrigin(.5,b.id==='mill'?178/240:b.id==='oven'?154/210:176/230).setScale(.9).setDepth(p.y+8));}
    const pad=(id:string,at:Vec2,name:string,requires:string)=>{const p=project(at),g=s.add.graphics().setDepth(-1),points=[{x:p.x-40,y:p.y},{x:p.x,y:p.y-21},{x:p.x+40,y:p.y},{x:p.x,y:p.y+21}];g.fillStyle(0xe5dcc0,.4).fillPoints(points,true).lineStyle(2,0xfff4cf,.95).strokePoints(points,true);const label=s.add.text(p.x,p.y,name,TEXT).setOrigin(.5).setDepth(p.y-5);this.pads.push({id,g,label,requires});};
    pad('millInput',config.points.millInput,'送小麦','mill');pad('flourOutput',config.points.flourOutput,'取面粉','mill');pad('flourInput',config.points.flourInput,'送面粉','oven');pad('eggInput',config.points.eggInput,'送鸡蛋','oven');pad('cakeOutput',config.points.cakeOutput,'取蛋糕','oven');pad('cakeSupply',config.points.cakeSupply,'蛋糕供货','cake_stall');pad('cash',config.points.cash,'$ 0','cake_stall');
    const stack=(id:string,at:Vec2,key:string)=>{const p=project(at);this.stocks.push({id,images:Array.from({length:18},(_,i)=>s.add.image(p.x,p.y-i*6,key).setScale(.65).setDepth(p.y+1+i*.01).setVisible(false))});};
    stack('wheat',{x:config.area.x+3,z:config.area.z+13},BAKERY_ASSETS.wheatUnit);stack('flour',{x:config.area.x+6.5,z:config.area.z+11.5},BAKERY_ASSETS.flour);stack('cake',{x:config.area.x+14,z:config.area.z+5.5},BAKERY_ASSETS.cake);stack('stock',{x:config.area.x+13.7,z:config.area.z+14},BAKERY_ASSETS.cake);stack('cash',{x:config.area.x+18,z:config.area.z+15.5},'resource.cash');
    const m=project(config.buildings[0].center),o=project(config.buildings[1].center);
    this.millText=s.add.text(m.x,m.y-155,'',{...TEXT,backgroundColor:'#6f7658df',padding:{x:10,y:7},align:'center'}).setOrigin(.5,1).setDepth(m.y+100);
    this.ovenText=s.add.text(o.x,o.y-125,'',{...TEXT,backgroundColor:'#896b53df',padding:{x:10,y:7},align:'center'}).setOrigin(.5,1).setDepth(o.y+100);
    const ap=project({x:25.5,z:15.3});this.atm=s.add.image(ap.x,ap.y,'building.atm').setOrigin(.5,110/132).setScale(.8).setDepth(ap.y+8);
    this.atmLabel=s.add.text(ap.x,ap.y-105,'',{...TEXT,align:'center',backgroundColor:'#456e61df',padding:{x:9,y:6}}).setOrigin(.5).setDepth(ap.y+100);
    pad('atm',ATM,'ATM','market_land');
    for(let i=0;i<3;i++){const p=project({x:config.area.x+13+i,z:config.area.z+17.1});this.customers.push(s.add.image(p.x,p.y,'actor.customer2.0.0').setOrigin(.5,100/110).setScale(.5).setDepth(p.y+1));}
  }
  update(w:World):void {
    const open=has(w,'bakery_land'),b=w.bakery;
    this.land.setAlpha(open?1:.3);this.title.setVisible(open);this.gate.setVisible(!open).setText(has(w,'packer')?'烘焙工坊\n投资新地块，开启第三章':'烘焙工坊\n完成集市后开放');
    for(const[id,v]of this.buildings)v.setVisible(has(w,id));
    this.wheat.forEach((v,i)=>v.setVisible(has(w,'wheat_field')).setScale(b.crops[i].readyAt<=w.time?.58:.17).setAlpha(b.crops[i].readyAt<=w.time?1:.65));
    for(const p of this.pads){p.g.setVisible(has(w,p.requires));p.label.setVisible(has(w,p.requires));if(p.id==='cash')p.label.setText(`$ ${b.pendingCash}`);if(p.id==='atm')p.label.setText(bankOpen(w)?'账户存款':'招聘面板建 ATM');}
    const amounts:Record<string,number>={wheat:Math.ceil(b.millInput.items.wheat/4),flour:b.flour.items.flour,cake:b.cakes.items.cake,stock:b.stock.items.cake,cash:Math.ceil(b.pendingCash/40)};
    this.stocks.forEach(t=>t.images.forEach((v,i)=>{v.setVisible(i<Math.min(18,amounts[t.id]));if(t.id==='stock')v.setY(project({x:config.area.x+13.7,z:config.area.z+14}).y-45-i*6);}));
    this.millText.setVisible(has(w,'mill')).setText(`小麦 ${b.millInput.items.wheat} → 面粉 ${b.flour.items.flour}\n${facilityStatuses(w).find(f=>f.id==='mill')?.state} · Lv.${facilityLevel(w,'mill')} · 研磨 ${Math.floor(b.millTime/cycleSeconds(w,'mill')*100)}%`);
    this.ovenText.setVisible(has(w,'oven')).setText(`面粉 ${b.ovenFlour.items.flour} + 鸡蛋 ${b.ovenEgg.items.egg}\n${facilityStatuses(w).find(f=>f.id==='oven')?.state} · Lv.${facilityLevel(w,'oven')} · 蛋糕 ${b.cakes.items.cake} · 烘烤 ${Math.floor(b.ovenTime/cycleSeconds(w,'oven')*100)}%`);
    this.atm.setVisible(has(w,'market_land')).setAlpha(bankOpen(w)?1:.4);this.atmLabel.setVisible(has(w,'market_land')).setText(bankOpen(w)?`ATM 账户\n余额 $${w.bank.cash}`:'ATM $250\n在经营面板建设');
    this.customers.forEach(v=>v.setVisible(has(w,'cake_stall')));
  }
}
