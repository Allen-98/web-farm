import {MapCamera} from './MapCamera.ts';
import {OrderBoardView} from './OrderBoardView.ts';
import {farmCapacity} from '../domain/capacity.ts';
import { BakeryView, BAKERY_ASSETS } from './BakeryView.ts';
import { bakeryConfig } from '../domain/bakery.ts';
import { JOB_NAMES } from '../domain/logistics.ts';
import {bankOpen} from '../domain/finance.ts';
import { ChapterView, GIFT } from './ChapterView.ts';
import { chapterConfig } from '../domain/chapter2.ts';
import Phaser from 'phaser';
import { createArt, createTerrain, ASSETS } from './art.ts';
import { project, unproject, screenDirection } from './projection.ts';
import { stepWorld, getGoal, unlocked, nextUpgrade, zone, BOOT_CASH, FEED, DT } from '../domain/world.ts';
import type { World, Actor, FxEvent } from '../domain/world.ts';
import type { Vec2 } from '../domain/contracts.ts';

export interface ScenePorts {
  world(): World;
  movement(): Vec2;
  paused(): boolean;
  present(fps: number): void;
  event(event: FxEvent): void;
  ready(scene: FarmScene): void;
}
class StackView {
  images: Phaser.GameObjects.Image[];
  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container) {
    this.images = Array.from({ length: 72 }, () => { const image = scene.add.image(0,0,ASSETS.cash).setVisible(false); root.add(image); return image; });
  }
  update(a: Actor, cash: number, time: number): void {
    const layers=[...Array(Math.ceil(a.bag.items.corn/1.7)).fill(ASSETS.cornUnit),...Array(Math.ceil(a.bag.items.egg/1.7)).fill(ASSETS.eggUnit),...Array(a.bag.items.gift).fill(GIFT),...Array(Math.ceil(a.bag.items.wheat/2)).fill(BAKERY_ASSETS.wheatUnit),...Array(a.bag.items.flour).fill(BAKERY_ASSETS.flour),...Array(a.bag.items.cake).fill(BAKERY_ASSETS.cake)].slice(0,36);
    const sway=Math.sin(time*7)*(a.moving?1.7:.3),money=Math.min(a.job==='cashier'?10:18,Math.ceil(cash/(a.job==='cashier'?200:Math.max(6,cash/18))));
    for(let i=0;i<72;i++){const image=this.images[i];if(i<layers.length)image.setVisible(true).setTexture(layers[i]).setScale(layers[i]===BAKERY_ASSETS.flour?.47:layers[i]===GIFT||layers[i]===BAKERY_ASSETS.cake?.6:.8).setPosition(-10+sway*(1+i*.07),-30-i*6);else if(i>=36&&i<36+money)image.setVisible(true).setTexture(ASSETS.cash).setScale(.8).setPosition(layers.length?17:0,-29-(i-36)*5+sway);else image.setVisible(false);}

  }
}
class ActorView {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  stack: StackView;
  ring?: Phaser.GameObjects.Ellipse;
  constructor(scene: Phaser.Scene, a: Actor) {
    this.root=scene.add.container(0,0);
    if(a.id==='player'){this.ring=scene.add.ellipse(0,-1,39,18,0xc8efbe,.22).setStrokeStyle(2,0xf8f9d6,.8);this.root.add(this.ring);}
    this.stack=new StackView(scene,this.root);
    this.body=scene.add.image(0,0,'actor.player.0.0').setOrigin(.5,100/110).setScale(.59);this.root.add(this.body);if(JOB_NAMES[a.job])this.root.add(scene.add.text(0,13,JOB_NAMES[a.job],{fontFamily:'Microsoft YaHei',fontSize:'10px',color:'#fff4d5',stroke:'#516e49',strokeThickness:3}).setOrigin(.5));
  }
  update(a: Actor, w: World): void {
    const p=project(a.position), v=project(a.facing);
    const dir=Math.abs(v.x)>Math.abs(v.y)?v.x>0?2:3:v.y<0?1:0;
    const role=a.id==='player'?'player':a.job==='harvest'||a.job==='haul'?'harvest':'clerk';
    const frame=a.moving?Math.floor(w.time*9)%2:0;
    this.body.setTexture(`actor.${role}.${dir}.${frame}`).setY(a.moving?Math.sin(w.time*18)*.8:0);
    this.root.setPosition(p.x,p.y).setDepth(p.y+10);
    this.stack.update(a,a.id==='player'?(bankOpen(w)?0:w.wallet.cash):a.cash,w.time);
    this.ring?.setAlpha(.65+Math.sin(w.time*3)*.15);
  }
}
interface Flight { image: Phaser.GameObjects.Image; from: {x:number;y:number}; to: {x:number;y:number}; t: number; duration: number; star?: boolean }
const TEXT: Phaser.Types.GameObjects.Text.TextStyle={fontFamily:'"Microsoft YaHei", "PingFang SC", sans-serif',fontSize:'13px',fontStyle:'bold',color:'#fffbe3',stroke:'#4f633f',strokeThickness:3};

export class FarmScene extends Phaser.Scene {
  orderBoard!:OrderBoardView;
  mapCamera!:MapCamera;
  cornLabel!:Phaser.GameObjects.Text;
  coopLabel!:Phaser.GameObjects.Text;
  bakeryView!:BakeryView;
  chapterView!:ChapterView;
  ports: ScenePorts;
  actors = new Map<string,ActorView>();
  crops: Phaser.GameObjects.Image[]=[];
  eggs: Phaser.GameObjects.Image[]=[];
  chickens: Phaser.GameObjects.Image[]=[];
  feedCorn:Phaser.GameObjects.Image[]=[];
  stationViews: {root:Phaser.GameObjects.Container;stock:Phaser.GameObjects.Image[];cash:Phaser.GameObjects.Image[];bubble:Phaser.GameObjects.Text;cars:Phaser.GameObjects.Image[];serial:number;arrivalAt:number}[]=[];
  bootstrap:Phaser.GameObjects.Image[]=[];
  investment!:Phaser.GameObjects.Container;
  investmentShape!:Phaser.GameObjects.Graphics;
  investmentText!:Phaser.GameObjects.Text;
  investmentName!:Phaser.GameObjects.Text;
  goalArrow!:Phaser.GameObjects.Text;
  goalRing!:Phaser.GameObjects.Ellipse;
  pathView!:Phaser.GameObjects.Graphics;
  feedText!:Phaser.GameObjects.Text;
  groundText!:Phaser.GameObjects.Text;
  tractor!:Phaser.GameObjects.Image;
  blades:Phaser.GameObjects.Image[]=[];
  flights:Flight[]=[];
  freeFlights:Phaser.GameObjects.Image[]=[];
  accumulator=0;
  hudTime=0;
  frames=0;
  fpsAt=0;
  renderedFps=60;
  constructor(ports: ScenePorts) { super('Farm');this.ports=ports; }
  create():void {
    createArt(this);createTerrain(this);this.chapterView=new ChapterView(this);this.bakeryView=new BakeryView(this);this.orderBoard=new OrderBoardView(this);
    this.cameras.main.setBackgroundColor('#97bb71');
    const w=this.ports.world();
    const coop=project({x:11,z:4.5});this.add.image(coop.x,coop.y,ASSETS.coop).setOrigin(.5,190/300).setDepth(coop.y+10).setScale(.91);
    for(let i=0;i<24;i++){const p=project({x:8.7+(i%6)*.78,z:3.1+Math.floor(i/6)*.7},43);this.chickens.push(this.add.image(p.x,p.y,'animal.chicken').setOrigin(.5,.9).setScale(.42).setDepth(coop.y+15).setVisible(i<w.production.length));}
    for(const crop of w.crops) {const p=project(crop.position);this.crops.push(this.add.image(p.x,p.y,ASSETS.corn).setOrigin(.5,.95).setScale(.52).setDepth(p.y));}
    const random=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
    for(let i=0;i<180;i++) {const x=8.3+random(i*2)*5.3,z=7.3+random(i*2+1)*3.3,p=project({x,z});this.eggs.push(this.add.image(p.x,p.y,ASSETS.egg).setOrigin(.5,.85).setScale(.61).setDepth(p.y+1).setVisible(false));}
    for(let i=0;i<18;i++){const p=project({x:12.6+(i%6)*.35,z:5.45+Math.floor(i/6)*.12},28);this.feedCorn.push(this.add.image(p.x,p.y,ASSETS.cornUnit).setScale(.7).setDepth(coop.y+17).setVisible(false));}
    for(const [x,z,s]of [[0,2,.8],[0,8,.75],[0,15,.86],[0,22,.7],[9,23,.68],[11,24,.8],[65,5,.8],[65,11,.75],[65,17,.9],[26,23,.75],[5,-1,.7],[12,-1,.8],[20,-1,.7]]){const p=project({x,z});this.add.image(p.x,p.y,ASSETS.tree).setOrigin(.5,.93).setScale(s).setDepth(p.y+1);}
    for(let index=0;index<2;index++)this.createStation(index);
    for(let i=0;i<12;i++){const p=project(BOOT_CASH);this.bootstrap.push(this.add.image(p.x+(i%3-1)*14,p.y-Math.floor(i/3)*5,ASSETS.cash).setScale(.9).setDepth(p.y+i*.01));}
    const label=(at:Vec2,text:string,color='#fffbe3')=>{const p=project(at);return this.add.text(p.x,p.y,text,{...TEXT,color,fontSize:'12px',backgroundColor:'#4b674acc',padding:{x:9,y:5}}).setOrigin(.5,0).setDepth(p.y+1);};
    this.cornLabel=label({x:21,z:1.2},'玉 米 田');
    this.coopLabel=label({x:10,z:2.5},'鸡舍 · 6 只');
    this.feedText=label({x:15.5,z:4.5},'喂料 · 0 / 120','#ffe1a0');
    this.groundText=label({x:9,z:10.8},'新鲜鸡蛋 · 0');
    const fp=project(FEED);this.add.ellipse(fp.x,fp.y,67,31,0xffd46f,.14).setStrokeStyle(2,0xffe4a3,.8).setDepth(-1);
    this.add.text(fp.x,fp.y-2,'↓ 喂料',{...TEXT,fontSize:'12px',color:'#ffe2a2'}).setOrigin(.5).setDepth(fp.y-10);
    this.investmentShape=this.add.graphics();this.investmentText=this.add.text(0,-3,'',{...TEXT,fontSize:'20px',stroke:'#306959',strokeThickness:3}).setOrigin(.5);
    this.investmentName=this.add.text(0,30,'',{...TEXT,fontSize:'13px'}).setOrigin(.5,0);
    this.investment=this.add.container(0,0,[this.investmentShape,this.investmentText,this.investmentName]);
    this.pathView=this.add.graphics().setDepth(-.5);
    this.goalRing=this.add.ellipse(0,0,48,23,0x67e4ce,.15).setStrokeStyle(2,0x93f9db,.7).setDepth(-.1);
    this.goalArrow=this.add.text(0,0,'↓',{fontFamily:'Arial',fontSize:'49px',fontStyle:'bold',color:'#95e8df',stroke:'#3e9697',strokeThickness:4}).setOrigin(.5,1).setDepth(5000);
    this.tractor=this.add.image(0,0,ASSETS.tractor).setOrigin(.5,.8).setScale(.8).setVisible(false);
    for(let i=0;i<5;i++)this.blades.push(this.add.image(0,0,'fx.star').setTint(0xc5d1be).setScale(.8).setVisible(false));
    for(let i=0;i<96;i++)this.freeFlights.push(this.add.image(0,0,ASSETS.egg).setVisible(false).setDepth(6000));
    this.refreshActors();
    this.mapCamera=new MapCamera(this);
    this.resize();this.scale.on('resize',this.resize,this);
    this.ports.ready(this);
  }
  resize():void {this.mapCamera.resize();}
  screenToGround(clientX:number,clientY:number):Vec2 {const rect=this.game.canvas.getBoundingClientRect();const p=this.cameras.main.getWorldPoint((clientX-rect.left)*this.scale.width/rect.width,(clientY-rect.top)*this.scale.height/rect.height);return unproject(p.x,p.y);}
  createStation(index:number):void {
    const car=index===0,center=project(car?{x:9.5,z:13.5}:{x:21.5,z:17.5});
    const table=this.add.image(0,0,ASSETS.counter).setOrigin(.5,105/180).setScale(.83);
    const root=this.add.container(center.x,center.y,[table]).setDepth(center.y+10);
    const stock:Phaser.GameObjects.Image[]=[];for(let i=0;i<24;i++){const image=this.add.image(-30+(i%3)*11,-39-Math.floor(i/3)*6,ASSETS.eggUnit).setScale(.58).setVisible(false);root.add(image);stock.push(image);}
    const supply=project(zone(car?'car_supply':'walk_supply'));
    const g=this.add.graphics().setDepth(-1);
    const points=[{x:supply.x-42,y:supply.y},{x:supply.x,y:supply.y-22},{x:supply.x+42,y:supply.y},{x:supply.x,y:supply.y+22}];
    g.fillStyle(0x8cdfbf,.14).fillPoints(points,true).lineStyle(2,0xffffdd,.9);
    for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4];for(let s=0;s<1;s+=.3){g.lineBetween(a.x+(b.x-a.x)*s,a.y+(b.y-a.y)*s,a.x+(b.x-a.x)*Math.min(1,s+.18),a.y+(b.y-a.y)*Math.min(1,s+.18));}}
    const supplyLabel=this.add.text(supply.x,supply.y,'供货',{...TEXT,fontSize:'12px'}).setOrigin(.5).setDepth(supply.y-5);
    const cashPos=project(zone(car?'car_cash':'walk_cash'));const pad=this.add.ellipse(cashPos.x,cashPos.y,59,29,0x39674b,.5).setStrokeStyle(2,0xa0d8a1).setDepth(-1);const moneyLabel=this.add.text(cashPos.x,cashPos.y-1,'$',{...TEXT,fontSize:'18px',color:'#b7ec8a'}).setOrigin(.5).setDepth(cashPos.y);
    const cash:Phaser.GameObjects.Image[]=[];for(let i=0;i<30;i++)cash.push(this.add.image(cashPos.x+(i%3-1)*12,cashPos.y-3-Math.floor(i/3)*5,ASSETS.cash).setScale(.8).setDepth(cashPos.y+1+i*.01).setVisible(false));
    const bubblePos=project(car?{x:4.2,z:13}:{x:22.5,z:17});
    const bubble=this.add.text(bubblePos.x,bubblePos.y-75,'',{...TEXT,fontSize:'15px',color:'#3e6144',strokeThickness:0,backgroundColor:'#ffffe9',padding:{x:10,y:6}}).setOrigin(.5,1).setDepth(4000);
    const cars:Phaser.GameObjects.Image[]=[];
    for(let i=0;i<4;i++){const p=project(car?{x:4.1,z:13-i*3.6}:{x:21+i*1.15,z:20.2});const object=this.add.image(p.x,p.y,car?'vehicle.car.red':`actor.customer${i%2?'2':''}.0.0`).setOrigin(.5,car?.85:100/110).setScale(car?.74:.52).setDepth(p.y+2);cars.push(object);}
    root.setData('ground',[g,pad,moneyLabel,supplyLabel]);
    this.stationViews.push({root,stock,cash,bubble,cars,serial:0,arrivalAt:-10});
  }
  refreshActors():void {
    const w=this.ports.world(),actors=[w.player,...w.workers],ids=new Set(actors.map(a=>a.id));
    for(const [id,view]of this.actors)if(!ids.has(id)){view.root.destroy();this.actors.delete(id);}
    for(const a of actors)if(!this.actors.has(a.id))this.actors.set(a.id,new ActorView(this,a));
  }
  flight(event:FxEvent):void {
    this.ports.event(event);
    const from=project(event.from,30),to=project(event.to,30);
    if(event.kind==='build') {
      for(let i=0;i<14;i++){const image=this.freeFlights.pop();if(!image)break;image.setTexture('fx.star').setVisible(true).setScale(.5+Math.random()*.5).setAlpha(1);this.flights.push({image,from:{x:to.x,y:to.y},to:{x:to.x+Math.cos(i)*95,y:to.y+Math.sin(i)*65-55},t:0,duration:.7,star:true});}
      return;
    }
    const asset=event.item==='corn'?ASSETS.cornUnit:event.item==='egg'?ASSETS.egg:event.item==='gift'?GIFT:event.item==='wheat'?BAKERY_ASSETS.wheatUnit:event.item==='flour'?BAKERY_ASSETS.flour:event.item==='cake'?BAKERY_ASSETS.cake:ASSETS.cash;
    for(let i=0;i<Math.min(3,event.amount);i++){const image=this.freeFlights.pop();if(!image)break;image.setTexture(asset).setVisible(true).setAlpha(1).setScale(event.item==='egg'?.7:.9).setAngle(0);this.flights.push({image,from:{x:from.x+i*3,y:from.y-i*4},to:{x:to.x,y:to.y-8},t:-i*.025,duration:.36});}
  }
  update(_time:number,delta:number):void {
    const elapsed=Math.min(delta/1000,.167),w=this.ports.world();
    this.frames++;if(_time-this.fpsAt>=1000){this.renderedFps=Math.round(this.frames*1000/(_time-this.fpsAt));this.frames=0;this.fpsAt=_time;}
    if(!this.ports.paused()){this.accumulator+=elapsed;let n=0;while(this.accumulator>=DT&&n<5){stepWorld(w,screenDirection(this.ports.movement().x,this.ports.movement().z));for(const e of w.events)this.flight(e);this.accumulator-=DT;n++;}}else this.accumulator=0;
    this.mapCamera.update();this.refreshActors();this.chapterView.update(w);this.bakeryView.update(w);this.orderBoard.update(w);
    for(const a of [w.player,...w.workers])this.actors.get(a.id)!.update(a,w);
    this.crops.forEach((v,i)=>{const ready=w.crops[i].readyAt<=w.time;v.setVisible(true).setAlpha(ready?1:.65).setScale(ready?.52:.13+Math.max(0,1-(w.crops[i].readyAt-w.time)/6)*.2).setTint(ready?0xffffff:0x9abc67);});
    this.eggs.forEach((v,i)=>v.setVisible(i<w.ground.items.egg));
    this.bootstrap.forEach((v,i)=>v.setVisible(i<Math.ceil(w.looseCash.cash/5)));
    this.chickens.forEach((v,i)=>v.setVisible(i<w.production.length).setAngle(Math.sin(w.time*3+i*2)*4).setY(v.getData('baseY')??(v.setData('baseY',v.y),v.y)));
    this.cornLabel.setText(`玉米田 · 每株 ${farmCapacity(w).yield} 份`);this.coopLabel.setText(`鸡舍 · ${w.production.length} 只`);
    this.feedText.setText(`喂料 · ${w.feed.items.corn} / ${w.feed.capacity}`);this.groundText.setText(`新鲜鸡蛋 · ${w.ground.items.egg} / ${w.ground.capacity}`);
    this.feedCorn.forEach((v,i)=>v.setVisible(i<Math.ceil(w.feed.items.corn/3)));
    for(let i=0;i<2;i++){
      const s=w.stations[i],v=this.stationViews[i];v.root.setVisible(s.enabled);(v.root.getData('ground')as (Phaser.GameObjects.Graphics|Phaser.GameObjects.Ellipse|Phaser.GameObjects.Text)[]).forEach(o=>o.setVisible(s.enabled));
      (v.root.getAt(0)as Phaser.GameObjects.Image).setScale(i===1&&unlocked(w,'walk_expansion')?1.0:.83);
      if(v.serial!==s.serial){v.serial=s.serial;v.arrivalAt=w.time;}
      v.stock.forEach((x,j)=>x.setVisible(j<Math.ceil(s.stock.items.egg/3)));
      v.cash.forEach((x,j)=>x.setVisible(s.enabled&&j<Math.ceil(s.pendingCash/4)));
      v.bubble.setVisible(s.enabled).setText(i===0?`蛋托 × ${s.order.packsRemaining}`:`鸡蛋 × ${s.order.eggsPerPack}`);
      const arriving=1-Phaser.Math.Clamp((w.time-v.arrivalAt)/.8,0,1);
      v.cars.forEach((car,j)=>{const at=i===0?{x:4.1,z:13-j*3.6-arriving*3.6}:{x:21+j*1.15+arriving*1.15,z:20.2};const p=project(at);car.setVisible(s.enabled).setPosition(p.x,p.y).setDepth(p.y+2);if(i===0)car.setTexture(`vehicle.car.${['red','gold','blue','plum'][(j+s.serial)%4]}`);});
    }
    const u=nextUpgrade(w);this.investment.setVisible(!!u);
    if(u){const p=project(u.position),progress=u.paid/u.cost;this.investment.setPosition(p.x,p.y).setDepth(p.y+2);const g=this.investmentShape;g.clear().fillStyle(0x389575,.25).fillPoints([{x:-55,y:0},{x:0,y:-28},{x:55,y:0},{x:0,y:28}],true).lineStyle(3,w.wallet.cash?0x81efdb:0xe7e8c6,.9).strokePoints([{x:-55,y:0},{x:0,y:-28},{x:55,y:0},{x:0,y:28}],true);if(progress>0)g.fillStyle(0x68dab8,.55).fillEllipse(0,0,95*progress,40*progress);this.investmentText.setText(`$ ${u.cost-u.paid}`);this.investmentName.setText(({car_counter:'汽车柜台',harvest_team:'收割小队',car_clerk:'搬蛋店员',walk_counter:'步行柜台',walk_expansion:'柜台扩建',harvester:'收割机',walk_clerk:'第二位店员'}as Record<string,string>)[u.id]??u.label??u.id);}
    const goal=getGoal(w),gp=project(goal.target);this.goalArrow.setPosition(gp.x,gp.y-37-Math.sin(w.time*4)*6);this.goalRing.setPosition(gp.x,gp.y).setScale(1+Math.sin(w.time*4)*.07);
    this.pathView.clear();if(w.navigationTarget){this.pathView.lineStyle(2,0xd6f6d1,.5);let previous=project(w.player.position);for(const p of w.player.path){const next=project(p);this.pathView.lineBetween(previous.x,previous.y,next.x,next.y);previous=next;}}
    this.tractor.setVisible(w.machine.active);for(const b of this.blades)b.setVisible(w.machine.active);
    if(w.machine.active){const p=project(w.machine.position);this.tractor.setPosition(p.x,p.y).setDepth(p.y+11);this.blades.forEach((b,i)=>b.setPosition(p.x-45+i*23,p.y+12+(i-2)*4).setRotation(w.time*9).setDepth(p.y+12));}
    for(let i=this.flights.length-1;i>=0;i--){const f=this.flights[i];f.t+=this.ports.paused()?0:elapsed;if(f.t<0)continue;const t=Math.min(1,f.t/f.duration),ease=t*t*(3-2*t);f.image.setPosition(Phaser.Math.Linear(f.from.x,f.to.x,ease),Phaser.Math.Linear(f.from.y,f.to.y,ease)-Math.sin(t*Math.PI)*(f.star?20:55)).setAlpha(f.star?1-t:1);if(f.star)f.image.rotation+=elapsed*5;if(t===1){f.image.setVisible(false).setAngle(0);this.freeFlights.push(f.image);this.flights.splice(i,1);}}
    this.hudTime+=elapsed;if(this.hudTime>.1){this.hudTime=0;this.ports.present(this.renderedFps);}
  }
}
