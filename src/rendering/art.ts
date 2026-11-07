import Phaser from 'phaser';
import {paintVolume} from './volumeArt.ts';
import {marketStall,flower,planter} from './illustration.ts';
import {createMeadow,createLand,createCountryRoad} from './landscape.ts';

type C = CanvasRenderingContext2D;
export const ASSETS = { corn: 'crop.corn', egg: 'resource.egg', cornUnit: 'resource.corn-stack', cash: 'resource.cash', eggUnit: 'resource.egg-stack', counter: 'building.counter', coop: 'building.coop', tractor: 'vehicle.harvester', tree: 'environment.pine' } as const;
function ellipse(c: C, x: number, y: number, rx: number, ry: number, color: string, angle = 0): void { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); c.fill(); }
function polygon(c: C, pts: number[][], color: string): void { c.fillStyle = color; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
function line(c: C, points: number[][], color: string, width: number): void { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
function gradient(c: C, x: number, y: number, a: string, b: string): CanvasGradient { const g = c.createLinearGradient(x - 15, y - 12, x + 18, y + 20); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: C) => void): void { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const c = canvas.getContext('2d')!; if(!paintVolume(scene,key,c,width,height))draw(c); scene.textures.addCanvas(key, canvas); }
function box(c: C, x: number, y: number, width: number, depth: number, height: number, top: string, left: string, right: string): void {
  // A compact isometric box whose center is a fixed ground anchor.
  const p = [[x, y - depth], [x + width, y], [x, y + depth], [x - width, y]];
  polygon(c, [[p[3][0],p[3][1]-height],[p[2][0],p[2][1]-height],p[2],p[3]], left);
  polygon(c, [[p[2][0],p[2][1]-height],[p[1][0],p[1][1]-height],p[1],p[2]], right);
  polygon(c, p.map(([px,py]) => [px,py-height]), top);
}
function person(c: C, role: string, frame: number, dir: number): void {
  const back = dir === 1, side = dir > 1, flip = dir === 3;
  c.save(); if (flip) { c.translate(80,0); c.scale(-1,1); }
  const walk = frame ? 5 : -5, shirt = role === 'player' ? '#c15854' : role === 'harvest' ? '#be5440' : role === 'clerk' ? '#da6351' : role === 'customer2' ? '#dcaf53' : '#5b906c';
  ellipse(c, 40, 100, 18, 5, '#344e3325');
  line(c, [[34,70],[31+walk,91],[29+walk,97]], '#254e64', 10);
  line(c, [[46,70],[49-walk,91],[50-walk,97]], '#1d3c50', 10);
  line(c, [[25,49],[20-walk*.5,65],[21-walk*.5,73]], '#e6ac7b', 8);
  line(c, [[54,49],[58+walk*.5,64],[57+walk*.5,72]], '#d99669', 8);
  c.fillStyle = gradient(c,40,52,shirt,'#8a3f37'); c.beginPath(); c.roundRect(24,38,32,34,11); c.fill();
  c.fillStyle = gradient(c,40,60,'#5a8495','#2e536b'); c.beginPath(); c.roundRect(29,50,24,28,6); c.fill();
  line(c, [[30,42],[34,60]], '#7398a7', 4); line(c, [[49,42],[46,60]], '#91adb0', 4);
  if (!back) { ellipse(c,34,55,1.6,1.6,'#e8cd86'); ellipse(c,47,55,1.6,1.6,'#e8cd86'); }
  c.fillStyle = gradient(c,40,22,'#f3c695','#dca373'); c.beginPath(); c.ellipse(40,26,13,16,side?-0.1:0,0,Math.PI*2); c.fill();
  if (role === 'player') {
    ellipse(c,41,15,15,10,'#87452c'); ellipse(c,31,22,5,12,'#8c482e');
    if (back) ellipse(c,40,26,13,15,'#925132');
    ellipse(c,56,30,7,13,'#85452e',-.35); ellipse(c,55,24,3,3,'#d6b953');
    c.strokeStyle='#b8d2d5';c.lineWidth=3;c.beginPath();c.arc(13,71,14,Math.PI*1.05,Math.PI*1.95);c.stroke();line(c,[[7,73],[18,89]],'#8e6940',3);
  } else if (role === 'harvest') {
    ellipse(c,40,14,24,7,'#b88739'); ellipse(c,40,12,23,7,'#e4bf65'); ellipse(c,40,8,14,9,'#e4ba61'); line(c,[[27,13],[51,14]],'#957342',3);
  } else if (role === 'clerk') { ellipse(c,40,14,15,9,'#368ba5'); ellipse(c,48,19,16,4,'#25748c'); }
  else { ellipse(c,40,13,13,7,'#5b4b32'); if(back) ellipse(c,40,24,13,14,'#66513b'); }
  if (!back) { ellipse(c, side ? 47 : 36,26,1.3,1.8,'#443b30'); if(!side) ellipse(c,45,26,1.3,1.8,'#443b30'); line(c,[[38,34],[43,35]],'#b8785d',1.2); }
  c.restore();
}
export function createArt(scene: Phaser.Scene): void {
  texture(scene, ASSETS.corn, 76, 118, c => {
    ellipse(c,40,111,23,5,'#31482322'); line(c,[[38,112],[37,15]],'#5b8e27',5);
    for(let i=0;i<4;i++) for(const side of [-1,1]) {
      const y=99-i*19; c.fillStyle=gradient(c,38,y,side>0?'#82bd39':'#b0d653','#3b8027'); c.beginPath();c.moveTo(38,y);c.bezierCurveTo(38+side*26,y-5,38+side*35,y-24,38+side*28,y-27);c.bezierCurveTo(38+side*11,y-28,40,y-14,38,y);c.fill();
      line(c,[[39,y-1],[38+side*24,y-23]],'#a9cd4a',1);
    }
    for(const [x,y,a] of [[25,58,-.5],[49,37,.4]]) { c.save(); c.translate(x,y);c.rotate(a);c.fillStyle=gradient(c,0,0,'#ffe389','#d7a42d');c.beginPath();c.ellipse(0,0,6.5,14,0,0,Math.PI*2);c.fill();for(let k=-8;k<10;k+=4)line(c,[[-4,k],[4,k]],'#f6c955',1);c.restore(); }
    line(c,[[37,18],[33,7],[39,1],[43,10]],'#dbc681',2);
  });
  texture(scene, ASSETS.cornUnit, 34, 15, c => { ellipse(c,17,9,15,5,'#b88c28');ellipse(c,17,6,15,5,'#ffda60');line(c,[[5,5],[28,5]],'#fff0a0',1.5); for(let x=7;x<29;x+=4)line(c,[[x,3],[x,9]],'#e8bc42',1);polygon(c,[[1,7],[8,1],[7,11]],'#6a9d32'); });
  texture(scene, ASSETS.egg, 28, 34, c => { ellipse(c,14,30,10,3,'#223e3028');c.fillStyle=gradient(c,12,12,'#fffef0','#d9d8b9');c.beginPath();c.ellipse(14,16,10,13,-.1,0,Math.PI*2);c.fill();ellipse(c,11,10,3,5,'#ffffff66'); });
  texture(scene, ASSETS.eggUnit, 36, 24, c => { for(const [x,y] of [[12,10],[24,11]]) { c.fillStyle=gradient(c,x,y,'#fffef0','#c5c8a5');c.beginPath();c.ellipse(x,y,7,10,0,0,Math.PI*2);c.fill(); } });
  texture(scene, ASSETS.cash, 40, 19, c => { polygon(c,[[2,8],[27,2],[38,8],[13,15]],'#4c8a36');polygon(c,[[2,8],[13,15],[13,18],[2,11]],'#2a662c');polygon(c,[[13,15],[38,8],[38,12],[13,18]],'#368035');polygon(c,[[4,6],[28,1],[37,6],[13,12]],'#8fcb55');line(c,[[7,6],[27,3],[33,6],[13,10],[7,6]],'#c2e789',1);ellipse(c,21,6,5,2.2,'#daeaa6'); });
  for(const role of ['player','harvest','clerk','customer','customer2']) for(let dir=0;dir<4;dir++) for(let frame=0;frame<2;frame++)texture(scene,`actor.${role}.${dir}.${frame}`,80,110,c=>person(c,role,frame,dir));
  texture(scene,'animal.chicken',60,65,c=>{ellipse(c,30,58,18,5,'#38482926');line(c,[[24,48],[23,58]],'#bf8e32',3);line(c,[[36,48],[37,58]],'#bf8e32',3);c.fillStyle=gradient(c,29,35,'#ffdea1','#c98a45');c.beginPath();c.ellipse(29,36,19,17,-.1,0,Math.PI*2);c.fill();ellipse(c,26,38,12,10,'#e5b465',-.25);ellipse(c,40,22,11,12,'#f5d59a');ellipse(c,42,9,4,6,'#c9543d');ellipse(c,36,10,4,6,'#d46843');ellipse(c,44,20,1.8,2,'#28372a');polygon(c,[[49,22],[58,26],[48,28]],'#e1a43b');polygon(c,[[12,29],[4,17],[9,40]],'#c48c51');});
  texture(scene,ASSETS.counter,300,230,c=>{
    marketStall(c,'鲜 鸡 蛋','#7c9e8e','#5b7f70');
    box(c,204,150,18,9,17,'#f1dfb6','#a9906a','#c0aa83');
    polygon(c,[[193,126],[210,120],[219,127],[202,134]],'#45645c');
    box(c,109,150,33,13,6,'#d9bb83','#ac875b','#c9a36b');
    for(const [x,y]of [[92,141],[108,147],[108,134],[123,140]])ellipse(c,x,y,5,7,'#fff3d5');
  });
  texture(scene,ASSETS.coop,400,300,c=>{
    ellipse(c,204,232,157,40,'#425e4928');box(c,200,190,148,72,38,'#e1c18d','#b38d62','#c39b69');
    for(let i=0;i<8;i++)line(c,[[63+i*18,155+i*8.5],[63+i*18,186+i*8.5]],'#98744c55',2);
    // The shelter sits at the back, keeping the animated hens visible in the open run.
    box(c,197,117,106,49,54,'#f3dfb3','#d3af79','#bb9665');
    polygon(c,[[73,67],[198,9],[329,70],[202,128]],'#bd7860');
    polygon(c,[[73,67],[198,9],[200,36],[102,83]],'#d99a77');
    polygon(c,[[73,67],[202,128],[202,137],[73,77]],'#965d4c');
    polygon(c,[[202,128],[329,70],[329,79],[202,137]],'#aa6853');
    for(let i=1;i<7;i++)line(c,[[91+i*14,59-i*6.5],[210+i*14,116-i*6.5]],'#f2c29944',2);
    line(c,[[75,65],[198,8],[328,69]],'#f0c398',3);
    for(const [x,y]of [[139,122],[194,147],[246,124]]){
      c.fillStyle='#785b43';c.beginPath();c.roundRect(x-14,y-22,28,26,[13,13,2,2]);c.fill();
      ellipse(c,x,y+1,17,4,'#e2c17c');line(c,[[x-13,y],[x+13,y]],'#f6dc99',2);
    }
    for(const [x,y]of [[55,147],[200,219],[346,148]])line(c,[[x,y+27],[x,y-15]],'#b18b60',9);
    line(c,[[55,151],[200,222],[346,152]],'#f0d5a5',7);
    polygon(c,[[204,227],[323,169],[346,180],[226,239]],'#86a798');polygon(c,[[226,239],[346,180],[346,194],[226,253]],'#638577');
    line(c,[[226,237],[343,181]],'#c2d1ad',3);planter(c,55,198);
  });
  for(const [key,color,light] of [['red','#c64c36','#eb7655'],['blue','#487da6','#77a5c2'],['gold','#d69c37','#edc665'],['plum','#9b546e','#bd7890']]) texture(scene,`vehicle.car.${key}`,115,123,c=>{
    ellipse(c,58,106,48,13,'#293d302a');
    for(const [x,y] of [[23,93],[90,69],[90,99],[30,65]]){ellipse(c,x,y,10,16,'#263d3b');ellipse(c,x-1,y,5,9,'#879a8a');}
    polygon(c,[[12,63],[63,37],[104,62],[104,94],[52,119],[12,94]],color);
    polygon(c,[[12,63],[63,37],[104,62],[52,87]],light);
    polygon(c,[[24,52],[57,36],[80,46],[80,66],[48,82],[24,68]],color);
    polygon(c,[[24,52],[57,36],[80,46],[47,63]],light);
    polygon(c,[[29,55],[45,64],[45,76],[29,67]],'#b8d0cc');polygon(c,[[50,65],[75,52],[75,65],[50,78]],'#456b75');
    polygon(c,[[59,88],[95,70],[95,89],[59,107]],'#80512d');polygon(c,[[59,88],[95,70],[88,67],[53,84]],'#f4d782');
    ellipse(c,22,90,5,6,'#f4e3a6');ellipse(c,48,105,5,6,'#f4e3a6');line(c,[[18,99],[44,114]],'#b9c6b2',4);
  });
  texture(scene,ASSETS.tractor,170,145,c=>{ellipse(c,84,122,65,16,'#243c2c33');for(const [x,y,r]of [[38,102,22],[121,79,21],[116,112,18],[40,73,17]]){ellipse(c,x,y,r,r*1.2,'#2b3c35');ellipse(c,x,y,r*.55,r*.7,'#bd5040');ellipse(c,x,y,r*.2,r*.3,'#b8b792');}box(c,86,84,52,24,30,'#df6550','#a2372c','#bf4937');box(c,80,56,23,13,33,'#e49a70','#497879','#5d9eaa');polygon(c,[[56,23],[80,11],[108,25],[84,38]],'#cf4d3b');line(c,[[124,69],[124,35]],'#514c3d',7);box(c,111,102,50,12,8,'#aab7a5','#6a8173','#7a8d7b');});
  texture(scene,ASSETS.tree,140,220,c=>{
    ellipse(c,77,204,48,12,'#45644328');ellipse(c,72,203,28,6,'#45644316');
    line(c,[[71,205],[69,112]],'#96714f',16);line(c,[[67,193],[65,118]],'#c49a69',4);
    line(c,[[70,164],[43,129]],'#96714f',8);line(c,[[71,153],[99,120]],'#96714f',7);
    for(const [x,y,rx,ry,color]of [[70,119,55,52,'#719267'],[38,105,32,41,'#82a272'],[98,94,32,44,'#779c6b'],[61,70,47,52,'#99b780'],[86,57,29,35,'#a9c48c'],[35,73,24,31,'#abc68d']] as [number,number,number,number,string][])ellipse(c,x,y,rx,ry,color);
    for(const [x,y]of [[31,79],[65,42],[88,72],[55,108],[104,99],[82,128]]){ellipse(c,x,y,9,3,'#d9e5ac55',-.4);}
    for(const [x,y]of [[44,87],[84,100],[66,61]]){ellipse(c,x,y,5,5,'#dfa971');ellipse(c,x-1,y-2,2,1.5,'#ffe1a3');}
    flower(c,45,201,'#fff4d4',2.5);
  });
  texture(scene,'environment.garden',120,62,c=>{
    ellipse(c,61,50,52,9,'#425e4920');
    for(const [x,y,r]of [[28,35,21],[57,27,25],[89,38,22]]){ellipse(c,x,y,r,r*.68,'#829e68');ellipse(c,x-4,y-5,r*.8,r*.48,'#a0b980');}
    for(const [x,y]of [[23,30],[53,16],[80,30],[96,39],[59,35]])flower(c,x,y,x%2?'#fff4d5':'#e7b49d',3);
  });
  texture(scene,'fx.star',24,24,c=>{const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:12;p.push([12+Math.cos(a)*r,12+Math.sin(a)*r]);}polygon(c,p,'#ffde76');});
}

export function createTerrain(scene: Phaser.Scene): Phaser.GameObjects.TileSprite {
  const meadow=createMeadow(scene);
  createLand(scene,'land.farm',{x:6.2,z:.5,width:19.6,height:18.3},1);
  createCountryRoad(scene);
  return meadow;
}
