import Phaser from 'phaser';
import {project} from './projection.ts';
import {ORDER_POINT,orderReady,TRADE_ITEMS} from '../domain/orders.ts';
import type {World} from '../domain/world.ts';
export class OrderBoardView {
  root:Phaser.GameObjects.Container;
  text:Phaser.GameObjects.Text;
  stacks:Phaser.GameObjects.Image[];
  constructor(scene:Phaser.Scene){
    const p=project(ORDER_POINT);this.root=scene.add.container(p.x,p.y).setDepth(p.y+8);
    const g=scene.add.graphics();g.fillStyle(0xd9e4b2,.35).fillPoints([{x:-48,y:0},{x:0,y:-24},{x:48,y:0},{x:0,y:24}],true).lineStyle(2,0xfff4cc,.95).strokePoints([{x:-48,y:0},{x:0,y:-24},{x:48,y:0},{x:0,y:24}],true);
    g.fillStyle(0x866845).fillRect(-30,-85,7,69).fillRect(23,-85,7,69).fillStyle(0x597852).fillRoundedRect(-42,-95,84,55,6).lineStyle(3,0xb8ad77).strokeRoundedRect(-42,-95,84,55,6);
    const title=scene.add.text(0,-78,'乡间订单',{fontFamily:'Microsoft YaHei',fontSize:'13px',color:'#fff4d0',fontStyle:'bold'}).setOrigin(.5);
    this.text=scene.add.text(0,4,'交货区',{fontFamily:'Microsoft YaHei',fontSize:'11px',color:'#fff9db',stroke:'#56724b',strokeThickness:3,align:'center'}).setOrigin(.5);
    this.root.add([g,title,this.text]);
    this.stacks=Array.from({length:12},(_,i)=>{const image=scene.add.image(27+i%3*9,-20-Math.floor(i/3)*7,'resource.egg').setScale(.25).setVisible(false);this.root.add(image);return image;});
  }
  update(w:World):void {
    this.root.setVisible(w.upgrades.some(u=>u.id==='car_counter'&&u.unlocked));
    const a=w.orders.active;this.text.setText(a?orderReady(w)?'已备齐 · 订单领奖':'订单交货区':'交货区 · 先接单');
    const items=a?TRADE_ITEMS.flatMap(i=>Array(Math.min(4,a.stock.items[i])).fill(i)):[];
    this.stacks.forEach((image,i)=>{image.setVisible(i<items.length);if(i<items.length)image.setTexture(items[i]==='egg'?'resource.egg':items[i]==='gift'?'resource.gift-box':'resource.cake');});
  }
}
