import type Phaser from 'phaser';
import {project} from './projection.ts';
import {PALETTE,poly,oval,stroke,flower} from './illustration.ts';

type Area={x:number;z:number;width:number;height:number};
function seeded(seed:number):()=>number{return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function canvasTexture(s:Phaser.Scene,key:string,w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void):void {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d')!);s.textures.addCanvas(key,canvas);
}
export function createMeadow(s:Phaser.Scene):Phaser.GameObjects.TileSprite {
  canvasTexture(s,'land.meadow',256,256,c=>{
    c.fillStyle=PALETTE.meadow;c.fillRect(0,0,256,256);const rand=seeded(47);
    for(let i=0;i<350;i++){const x=rand()*256,y=rand()*256;oval(c,x,y,rand()*2+.7,.7,i%3?'#73975e19':'#ecedbc40');}
    for(let i=0;i<16;i++){const x=8+rand()*240,y=8+rand()*240;stroke(c,[[x-2,y],[x,y-3],[x+2,y]],'#72975b35',1);}
  });
  // Keep the backing canvas viewport-sized, including when Phaser falls back to Canvas.
  return s.add.tileSprite(0,0,s.scale.width,s.scale.height,'land.meadow').setDepth(-1100);
}
export function frameMeadow(s:Phaser.Scene,ground:Phaser.GameObjects.TileSprite):void {
  const camera=s.cameras.main,w=Math.ceil(camera.width/camera.zoom)+128,h=Math.ceil(camera.height/camera.zoom)+128;
  const x=camera.scrollX+camera.width/2,y=camera.scrollY+camera.height/2;
  if(ground.width!==w||ground.height!==h)ground.setSize(w,h);
  ground.setPosition(x,y);
  if(ground.tilePositionX!==x-w/2||ground.tilePositionY!==y-h/2)ground.setTilePosition(x-w/2,y-h/2);
}
export function createLand(s:Phaser.Scene,key:string,a:Area,chapter:1|2|3):Phaser.GameObjects.Image {
  const width=Math.ceil((a.width+a.height)*34+90),height=Math.ceil((a.width+a.height)*18+120);
  const ox=a.height*34+45,oy=45;
  canvasTexture(s,key,width,height,c=>{
    const p=(x:number,z:number)=>{const q=project({x:x-a.x,z:z-a.z});return[q.x+ox,q.y+oy];};
    const rect=(x:number,z:number,w:number,h:number,color:string)=>poly(c,[p(x,z),p(x+w,z),p(x+w,z+h),p(x,z+h)],color);
    const corners=[p(a.x,a.z),p(a.x+a.width,a.z),p(a.x+a.width,a.z+a.height),p(a.x,a.z+a.height)];
    poly(c,corners.map(([x,y])=>[x+7,y+17]),'#275d4340');
    poly(c,[corners[3],corners[2],[corners[2][0],corners[2][1]+12],[corners[3][0],corners[3][1]+12]],'#a87738');
    poly(c,[corners[2],corners[1],[corners[1][0],corners[1][1]+12],[corners[2][0],corners[2][1]+12]],'#805e32');
    poly(c,corners,'#b5e96c');
    rect(a.x+.12,a.z+.12,a.width-.24,a.height-.24,chapter===2?'#93d94f':chapter===3?'#9cda4f':PALETTE.grass);
    stroke(c,[corners[3],corners[0],corners[1]],'#d4f593',3);
    const rand=seeded(chapter*931);
    for(let i=0;i<1200;i++){
      const q=p(a.x+.3+rand()*(a.width-.6),a.z+.3+rand()*(a.height-.6));
      oval(c,q[0],q[1],.5+rand()*2,.5+rand(),i%4?'#459d3535':'#defb9a5c');
      if(i%44===0)stroke(c,[[q[0]-3,q[1]],[q[0]-1,q[1]-4],[q[0],q[1]],[q[0]+3,q[1]-3]],'#4b9e3555',1);
    }
    const path=(x:number,z:number,w:number,h:number)=>{
      rect(x,z,w,h,'#b89149');rect(x+.06,z+.06,w-.12,h-.12,PALETTE.path);
      for(let i=0;i<w*h*6;i++){const q=p(x+.1+rand()*(w-.2),z+.1+rand()*(h-.2));oval(c,q[0],q[1],rand()*2+1,.8,'#ad946133');}
    };
    const field=(x:number,z:number,w:number,h:number)=>{
      rect(x-.14,z-.14,w+.28,h+.28,'#ffdc88');rect(x,z,w,h,'#af713a');
      for(let row=0;row<h-.2;row+=.98){rect(x+.1,z+.12+row,w-.2,.34,'#8d532d');rect(x+.1,z+.12+row,w-.2,.07,'#d39a50');}
      for(let i=0;i<160;i++){const q=p(x+rand()*w,z+rand()*h);oval(c,q[0],q[1],1.2,.65,i%2?'#d0aa7044':'#715b4033');}
    };
    if(chapter===1){
      path(6.55,11.2,19,1.55);path(14.35,5.8,1.3,11.95);
      field(15.65,1.45,8.8,9);rect(7.7,6.75,6.6,4.4,'#d5a848');rect(7.88,6.93,6.24,4.04,'#f2d16f');
      for(let i=0;i<120;i++){const q=p(8+rand()*5.9,7+rand()*3.8);stroke(c,[[q[0],q[1]],[q[0]+4,q[1]-2]],i%2?'#c5a87088':'#fff0bb88',1);}
    }else{
      path(a.x+.15,a.z+8.6,a.width-.3,1.55);
      if(chapter===2){path(a.x+4.7,a.z+5.2,1.2,9.2);path(a.x+10.5,a.z+9.9,1.1,6.7);}
      else {field(a.x+.5,a.z+.6,6.4,6.2);path(a.x+11.6,a.z+.15,1.2,16.65);path(a.x+7.6,a.z+.15,1.5,8.9);}
    }
    // Flowers stay on the boundary, away from navigation and resource drop zones.
    for(let i=0;i<32;i++){
      const x=a.x+.4+rand()*(a.width-.8),z=i%2?a.z+.38:a.z+a.height-.38,q=p(x,z);
      oval(c,q[0],q[1],5,2,'#73975c45');if(i%3)flower(c,q[0],q[1]-3,i%4?'#fff5d7':'#e7ad88',1.7);
    }
  });
  const origin=project(a);
  return s.add.image(origin.x-ox,origin.y-oy,key).setOrigin(0,0).setDepth(-990+chapter);
}

export function createCountryRoad(s:Phaser.Scene):void {
  canvasTexture(s,'land.road',2000,1040,c=>{
    const pp=(x:number,z:number)=>{const p=project({x,z});return[p.x+850,p.y+80];};
    const rect=(x:number,z:number,w:number,h:number,color:string)=>poly(c,[pp(x,z),pp(x+w,z),pp(x+w,z+h),pp(x,z+h)],color);
    rect(.1,-3,6.1,29,'#d5c89f');rect(.45,-3,5.4,29,'#537e90');rect(.85,-3,4.6,29,'#739ba5');
    for(let z=-2;z<25;z+=2.6)stroke(c,[pp(3.1,z),pp(3.1,z+1.05)],'#f3e9c2',3);
    rect(14.6,18.3,11,2.6,'#bbae86');rect(14.75,18.4,10.7,2.3,PALETTE.path);
    rect(14.35,16.9,1.7,3.6,PALETTE.path);rect(24,16.9,1.6,3.6,PALETTE.path);
    const fence=(x:number,z:number,x2:number,z2:number)=>{
      const a=pp(x,z),b=pp(x2,z2);stroke(c,[[a[0]+5,a[1]+4],[b[0]+5,b[1]+4]],'#4c694528',7);
      for(const h of [11,23]){stroke(c,[[a[0],a[1]-h],[b[0],b[1]-h]],'#c68d41',6);stroke(c,[[a[0],a[1]-h-2],[b[0],b[1]-h-2]],'#fff2c2',2);}
      stroke(c,[[a[0],a[1]],[a[0],a[1]-32]],'#efc76e',8);stroke(c,[[a[0]-2,a[1]-3],[a[0]-2,a[1]-32]],'#f4deaf',2);
      oval(c,a[0],a[1]-33,4,2,'#f6e6bd');
    };
    for(let z=.6;z<18;z+=1.7)fence(6.4,z,6.4,Math.min(18.6,z+1.7));
    for(let x=6.4;x<25;x+=1.7)fence(x,.5,Math.min(25.4,x+1.7),.5);
  });
  s.add.image(-850,-80,'land.road').setOrigin(0,0).setDepth(-980);
}
