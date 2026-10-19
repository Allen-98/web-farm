import {cycleSeconds,facilityLevel,facilityStatuses} from '../domain/operations.ts';
import Phaser from 'phaser';
import { project } from './projection.ts';
import { chapterConfig as config, has } from '../domain/chapter2.ts';
import type { World } from '../domain/world.ts';
import type { Vec2 } from '../domain/contracts.ts';

export const GIFT='resource.gift-box';
type C=CanvasRenderingContext2D;
export function poly(c:C,points:number[][],color:string):void {c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
export function box(c:C,x:number,y:number,w:number,d:number,h:number,top:string,left:string,right:string):void {
  poly(c,[[x-w,y],[x,y+d],[x,y+d-h],[x-w,y-h]],left);poly(c,[[x,y+d],[x+w,y],[x+w,y-h],[x,y+d-h]],right);poly(c,[[x-w,y-h],[x,y-d-h],[x+w,y-h],[x,y+d-h]],top);
}
export function tex(s:Phaser.Scene,key:string,w:number,h:number,draw:(c:C)=>void):void {const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d')!);s.textures.addCanvas(key,canvas);}
export function createChapterArt(s:Phaser.Scene):void {
  tex(s,GIFT,58,40,c=>{box(c,29,25,26,11,15,'#f4d588','#a97c46','#cb9e5d');poly(c,[[16,5],[23,2],[43,12],[36,16]],'#d6715c');poly(c,[[36,16],[43,12],[43,27],[36,30]],'#b84c44');c.fillStyle='#ffefd0';c.beginPath();c.ellipse(22,13,5,4,0,0,7);c.fill();c.beginPath();c.ellipse(32,17,5,4,0,0,7);c.fill();});
  tex(s,'building.pack-table',300,190,c=>{
    for(const x of [55,245]){c.fillStyle='#826440';c.fillRect(x,111,10,59);}
    box(c,150,130,122,45,30,'#b4cbb7','#6c8e7c','#87a395');
    poly(c,[[49,96],[143,59],[246,96],[152,132]],'#547d79');
    for(let i=0;i<7;i++){c.strokeStyle='#99b6a4';c.lineWidth=4;c.beginPath();c.moveTo(68+i*17,90-i*6);c.lineTo(151+i*13,123-i*5);c.stroke();}
    box(c,156,81,40,16,44,'#e8e4bf','#8fa28d','#bac7a3');c.fillStyle='#558b75';c.fillRect(145,28,24,12);c.fillStyle='#cceba9';c.fillRect(149,31,15,6);
    box(c,76,104,23,11,10,'#edcf8b','#bc915a','#d9ac66');
  });
  tex(s,'building.gift-stall',300,230,c=>{
    for(const x of [45,250]){c.fillStyle='#8e6942';c.fillRect(x,70,9,132);}
    box(c,150,176,117,44,34,'#dcc694','#7c956c','#92ac78');
    for(let i=0;i<5;i++)box(c,95+i*22,143-i*3,16,8,16,'#f0d592','#ae8147','#c49c5c');
    poly(c,[[20,65],[149,17],[280,65],[150,115]],'#e6ca94');
    for(let i=0;i<6;i++)poly(c,[[21+i*21,65-i*8],[42+i*21,57-i*8],[170+i*18,107-i*8],[150+i*18,115-i*8]],i%2?'#f4e5b6':'#c36b55');
    c.fillStyle='#fff2cd';c.beginPath();c.roundRect(106,62,88,25,6);c.fill();c.fillStyle='#6a7950';c.font='bold 15px Microsoft YaHei';c.textAlign='center';c.fillText('田园礼盒',150,80);
  });
  tex(s,'vehicle.wholesale',370,230,c=>{
    c.fillStyle='#334a3b33';c.beginPath();c.ellipse(185,176,160,35,0,0,7);c.fill();
    for(const [x,y]of [[79,167],[220,201],[319,163]]){c.fillStyle='#35494c';c.beginPath();c.ellipse(x,y,17,23,-.25,0,7);c.fill();c.fillStyle='#aeb6a4';c.beginPath();c.ellipse(x,y,8,13,-.25,0,7);c.fill();}
    box(c,235,165,105,42,18,'#b8be9a','#5b877a','#80a48b');
    box(c,104,142,71,30,65,'#8db3a1','#3e807b','#66a49a');
    poly(c,[[37,72],[104,45],[164,68],[102,95]],'#a9c5a4');poly(c,[[43,78],[94,98],[94,127],[43,108]],'#344e5b');poly(c,[[108,100],[153,82],[153,113],[108,130]],'#446877');
    c.fillStyle='#f7db85';c.fillRect(48,133,14,8);c.fillRect(127,146,14,8);
    box(c,239,130,99,38,7,'#ccbc8b','#8b8c68','#b0a87d');
  });
}
const TEXT={fontFamily:'Microsoft YaHei, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#fffbe3',stroke:'#536847',strokeThickness:3};
export class ChapterView {
  scene:Phaser.Scene;
  land:Phaser.GameObjects.Graphics;
  gate:Phaser.GameObjects.Text;
  title:Phaser.GameObjects.Text;
  views=new Map<string,Phaser.GameObjects.Image>();
  pads:{id:string;at:Vec2;g:Phaser.GameObjects.Graphics;label:Phaser.GameObjects.Text;name:string}[]=[];
  stacks: {id:string;at:Vec2;images:Phaser.GameObjects.Image[]}[]=[];
  status:Phaser.GameObjects.Text;
  truckStatus:Phaser.GameObjects.Text;
  bar:Phaser.GameObjects.Graphics;
  customers:Phaser.GameObjects.Image[]=[];
  constructor(scene:Phaser.Scene){
    this.scene=scene;createChapterArt(scene);
    const a=config.area,points=[{x:a.x,z:a.z},{x:a.x+a.width,z:a.z},{x:a.x+a.width,z:a.z+a.height},{x:a.x,z:a.z+a.height}].map(p=>project(p));
    this.land=scene.add.graphics().setDepth(-990);this.land.fillStyle(0xc2cc8b).fillPoints(points,true).lineStyle(5,0xe2d3a0).strokePoints(points,true);
    const road=[{x:26,z:9.8},{x:41,z:9.8},{x:41,z:11},{x:26,z:11}].map(p=>project(p));this.land.fillStyle(0xd4c99e).fillPoints(road,true);
    const gate=project(config.points.gate);this.gate=scene.add.text(gate.x+85,gate.y-55,'乡间集市\n完成农场建设后开放',{...TEXT,fontSize:'16px',align:'center',backgroundColor:'#5f7955',padding:{x:14,y:10}}).setOrigin(.5).setDepth(gate.y+1);
    const title=project({x:34,z:2});this.title=scene.add.text(title.x,title.y-85,'CHAPTER 02\n乡 间 集 市',{...TEXT,fontSize:'18px',align:'center',color:'#fff1c4'}).setOrigin(.5).setDepth(-900);
    for(const b of config.buildings){const at=project(b.center);const key=b.id==='pack_table'?'building.pack-table':b.id==='gift_stall'?'building.gift-stall':'vehicle.wholesale';const image=scene.add.image(at.x,at.y,key).setOrigin(.5,b.id==='gift_stall'?176/230:b.id==='pack_table'?130/190:165/230).setScale(b.id==='wholesale'?.9:.9).setDepth(at.y+8);this.views.set(b.id,image);}
    const pad=(id:string,at:Vec2,name:string)=>{const p=project(at),g=scene.add.graphics().setDepth(-2);g.fillStyle(id.includes('cash')?0x83b767:0xb9dfc1,.25).fillPoints([{x:p.x-41,y:p.y},{x:p.x,y:p.y-21},{x:p.x+41,y:p.y},{x:p.x,y:p.y+21}],true).lineStyle(2,0xfff4cc,.9).strokePoints([{x:p.x-41,y:p.y},{x:p.x,y:p.y-21},{x:p.x+41,y:p.y},{x:p.x,y:p.y+21}],true);const label=scene.add.text(p.x,p.y,name,{...TEXT,fontSize:'12px'}).setOrigin(.5).setDepth(p.y-5);this.pads.push({id,at,g,label,name});};
    pad('input',config.points.input,'送鸡蛋');pad('output',config.points.output,'取礼盒');pad('supply',config.points.supply,'礼盒供货');pad('cash',config.points.cash,'$ 0');pad('loading',config.points.loading,'装货');pad('truckCash',config.points.truckCash,'$ 0');
    const stack=(id:string,at:Vec2,key:string)=>{const p=project(at);this.stacks.push({id,at,images:Array.from({length:24},(_,i)=>scene.add.image(p.x,p.y-i*7,key).setScale(.65).setDepth(p.y+1+i*.01).setVisible(false))});};
    stack('input',{x:28.5,z:6.6},'resource.egg-stack');stack('output',{x:31,z:6.5},GIFT);stack('stock',{x:36,z:14},GIFT);stack('truck',{x:38,z:5.3},GIFT);stack('cash',{x:40,z:15.5},'resource.cash');stack('truckCash',{x:39,z:9.5},'resource.cash');
    const pack=project(config.buildings[0].center);this.status=scene.add.text(pack.x,pack.y-115,'',{...TEXT,fontSize:'12px',align:'center',backgroundColor:'#486e60dd',padding:{x:10,y:7}}).setOrigin(.5,1).setDepth(pack.y+100);
    const truck=project(config.buildings[2].center);this.truckStatus=scene.add.text(truck.x,truck.y-120,'',{...TEXT,fontSize:'13px',align:'center',backgroundColor:'#486e60dd',padding:{x:10,y:7}}).setOrigin(.5,1).setDepth(truck.y+100);
    this.bar=scene.add.graphics().setDepth(pack.y+101);
    for(let i=0;i<3;i++){const p=project({x:37+i*.9,z:17.8});this.customers.push(scene.add.image(p.x,p.y,'actor.customer.0.0').setOrigin(.5,100/110).setScale(.5).setDepth(p.y+2));}
  }
  update(w:World):void {
    const open=has(w,'market_land'),c=w.chapter;
    this.land.setAlpha(open?1:.35);this.title.setVisible(open);this.gate.setVisible(!open).setText(has(w,'walk_clerk')?'乡间集市\n投资新地块，开启第二章':'乡间集市\n完成农场建设后开放');
    const trip=c.truck.cooldown,travel=trip>9?(12-trip)/3:trip<3?trip/3:1,offset={x:travel*420,y:travel*200};
    for(const[id,v]of this.views){v.setVisible(has(w,id));if(id==='wholesale'){const p=project(config.buildings[2].center);v.setVisible(has(w,id)&&!(trip>3&&trip<9)).setPosition(p.x+offset.x,p.y+offset.y).setDepth(p.y+offset.y+8);}}
    for(const p of this.pads){const visible=has(w,['input','output'].includes(p.id)?'pack_table':['supply','cash'].includes(p.id)?'gift_stall':'wholesale');p.g.setVisible(visible);p.label.setVisible(visible);if(p.id==='cash')p.label.setText(`$ ${c.pendingCash}`);if(p.id==='truckCash')p.label.setText(`$ ${c.truck.pendingCash}`);if(p.id==='loading')p.label.setText(`${c.truck.loaded} / ${config.wholesale.boxes}`);}
    const count:Record<string,number>={input:Math.ceil(c.input.items.egg/6),output:c.output.items.gift,stock:c.stock.items.gift,truck:trip>9?config.wholesale.boxes:c.truck.loaded,cash:Math.ceil(c.pendingCash/20),truckCash:Math.ceil(c.truck.pendingCash/30)};
    for(const s of this.stacks)s.images.forEach((v,i)=>{v.setVisible(i<Math.min(24,count[s.id])&&(s.id!=='truck'||!trip||trip>9));const p=project(s.at);if(s.id==='truck')v.setPosition(p.x+(i%3-1)*24+offset.x,p.y-48-Math.floor(i/3)*13+offset.y).setDepth(project(config.buildings[2].center).y+offset.y+20+i*.01);if(s.id==='stock')v.setY(p.y-45-i*7);if(s.id==='input')v.setY(p.y-34-i*5).setDepth(project(config.buildings[0].center).y+20+i*.01);});
    this.status.setVisible(has(w,'pack_table')).setText(`鸡蛋 ${c.input.items.egg} → 礼盒 ${c.output.items.gift}\n${facilityStatuses(w).find(f=>f.id==='pack_table')?.state} · Lv.${facilityLevel(w,'pack_table')} · 包装 ${Math.floor(c.progress/cycleSeconds(w,'pack_table')*100)}%`);
    this.truckStatus.setVisible(has(w,'wholesale')).setText(c.truck.cooldown?`货车送货中 · ${Math.ceil(c.truck.cooldown)} 秒返回`:`批发订单 ${c.truck.loaded} / ${config.wholesale.boxes} 盒\n装满赚 $${config.wholesale.price} · 已发 ${c.truck.delivered} 车`);
    const pack=project(config.buildings[0].center);this.bar.clear();if(has(w,'pack_table'))this.bar.fillStyle(0x3e6955).fillRoundedRect(pack.x-55,pack.y-110,110,5,2).fillStyle(0xf3d58c).fillRoundedRect(pack.x-55,pack.y-110,110*c.progress/cycleSeconds(w,'pack_table'),5,2);
    for(const v of this.customers)v.setVisible(has(w,'gift_stall'));
  }
}
