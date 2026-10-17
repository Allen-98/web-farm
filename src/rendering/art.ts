import Phaser from 'phaser';
import { project } from './projection.ts';

type C = CanvasRenderingContext2D;
export const ASSETS = { corn: 'crop.corn', egg: 'resource.egg', cornUnit: 'resource.corn-stack', cash: 'resource.cash', eggUnit: 'resource.egg-stack', counter: 'building.counter', coop: 'building.coop', tractor: 'vehicle.harvester', tree: 'environment.pine' } as const;
function ellipse(c: C, x: number, y: number, rx: number, ry: number, color: string, angle = 0): void { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); c.fill(); }
function polygon(c: C, pts: number[][], color: string): void { c.fillStyle = color; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
function line(c: C, points: number[][], color: string, width: number): void { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
function gradient(c: C, x: number, y: number, a: string, b: string): CanvasGradient { const g = c.createLinearGradient(x - 15, y - 12, x + 18, y + 20); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (ctx: C) => void): void { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const c = canvas.getContext('2d')!; draw(c); scene.textures.addCanvas(key, canvas); }
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
  texture(scene,ASSETS.counter,280,180,c=>{
    ellipse(c,140,112,114,34,'#34432b25');
    line(c,[[50,104],[50,143]],'#816239',12);line(c,[[230,104],[230,143]],'#6d5031',12);
    box(c,140,105,112,43,29,'#789790','#496a65','#537770');
    polygon(c,[[28,76],[140,33],[252,76],[140,119]],'#79a8a7');line(c,[[30,76],[140,35],[249,76]],'#b5cfbd',3);
    box(c,201,80,21,10,18,'#d2c2b0','#8c7c6d','#a3978b');polygon(c,[[190,57],[209,52],[218,59],[199,65]],'#374c4a');
    box(c,94,75,29,13,5,'#c6b773','#9d8c53','#a69856');
  });
  texture(scene,ASSETS.coop,400,300,c=>{
    ellipse(c,200,220,157,45,'#2f3b2924');box(c,200,190,148,72,46,'#a68b55','#78573a','#88663e');
    for(let i=0;i<8;i++)line(c,[[63+i*18,145+i*8.5],[63+i*18,186+i*8.5]],'#b2935c',2);
    line(c,[[52,144],[52,80],[200,8],[348,80],[348,144]],'#8b683e',12);line(c,[[54,80],[200,10],[347,80]],'#c0a36b',5);
    polygon(c,[[52,83],[200,10],[348,83],[348,101],[200,29],[52,101]],'#b39a66');
    polygon(c,[[68,156],[183,102],[205,114],[88,169]],'#547e81');polygon(c,[[88,169],[205,114],[205,130],[88,185]],'#365e65');
    polygon(c,[[204,220],[323,162],[346,173],[226,232]],'#73999a');polygon(c,[[226,232],[346,173],[346,188],[226,248]],'#4f787b');
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
  texture(scene,ASSETS.tree,140,220,c=>{ellipse(c,73,205,45,10,'#2f472c26');line(c,[[71,188],[71,209]],'#836743',15);for(let i=0;i<5;i++){const y=172-i*32,w=62-i*9;polygon(c,[[70,y-65],[70+w,y],[70+5,y+18],[70-w,y]],i%2?'#4f7c43':'#426e3e');polygon(c,[[70,y-65],[70+5,y+18],[70-w,y]],'#658c4b');}});
  texture(scene,'fx.star',24,24,c=>{const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:12;p.push([12+Math.cos(a)*r,12+Math.sin(a)*r]);}polygon(c,p,'#ffde76');});
}

export function createTerrain(scene: Phaser.Scene): void {
  texture(scene,'terrain',2100,1280,c=>{
    const offset={x:1050,y:70};const pp=(x:number,z:number)=>{const p=project({x,z});return[p.x+offset.x,p.y+offset.y];};
    const rect=(x:number,z:number,w:number,h:number,color:string)=>polygon(c,[pp(x,z),pp(x+w,z),pp(x+w,z+h),pp(x,z+h)],color);
    const plane=c.createLinearGradient(200,0,1500,1200);plane.addColorStop(0,'#9bbf68');plane.addColorStop(.6,'#85ad5c');plane.addColorStop(1,'#c6cf83');c.fillStyle=plane;c.fillRect(0,0,2100,1280);
    rect(0,-2,6.3,28,'#91a19b');rect(.2,-2,5.7,28,'#6e8985');rect(1,-2,4.1,28,'#7b918b');rect(6.2,.2,19.6,18.6,'#9bc568');
    rect(12.8,18.8,15,3.8,'#b8b58a');rect(13.2,19.3,15,2.8,'#d8cc9b');
    rect(15.3,1.1,9.5,9.7,'#9d8557');rect(15.65,1.45,8.8,9,'#8c714d');
    for(let row=0;row<8;row++)rect(16,2+row*.96,7.8,.12,'#796344');
    rect(7.6,6.65,6.8,4.8,'#5b9396');rect(7.9,6.95,6.2,4.2,'#9d7953');rect(8.1,7.15,5.8,3.8,'#8c6b4a');
    let seed=924;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<3600;i++) {const x=6.5+rand()*19,z=.8+rand()*17.6;if((x>15.2&&z<10.9)||(x>7.4&&x<14.6&&z>2.5&&z<11.6))continue;const p=pp(x,z);ellipse(c,p[0],p[1],rand()*2+.5,rand()+.4,i%4?'#719d4966':'#c9db8b88');if(i%24===0)line(c,[[p[0]-2,p[1]],[p[0],p[1]-4],[p[0]+2,p[1]]],'#688f43',1.2);}
    for(let i=0;i<90;i++){const p=pp(13+rand()*13,19+rand()*3);ellipse(c,p[0],p[1],2+rand()*4,1+rand()*2,'#b8ac7b88');}
    for(let z=0;z<24;z+=2.5){const a=pp(3,z),b=pp(3,z+1);line(c,[a,b],'#d8d9b2',3);}
    const fence=(x:number,z:number,x2:number,z2:number)=>{const a=pp(x,z),b=pp(x2,z2);line(c,[[a[0]+3,a[1]+2],[b[0]+3,b[1]+2]],'#536a3433',9);for(const height of [13,26]){line(c,[[a[0],a[1]-height],[b[0],b[1]-height]],'#94703f',7);line(c,[[a[0],a[1]-height-2],[b[0],b[1]-height-2]],'#c6a970',2);}for(const p of [a,b]){line(c,[[p[0],p[1]],[p[0],p[1]-35]],'#a3824c',9);line(c,[[p[0]-2,p[1]-5],[p[0]-2,p[1]-36]],'#d3b77e',2);}};
    for(let z=.6;z<18;z+=1.7)fence(6.4,z,6.4,Math.min(18.6,z+1.7));
    for(let x=6.4;x<25;x+=1.7)fence(x,18.7,Math.min(25.4,x+1.7),18.7);
    for(let x=6.4;x<25;x+=1.7)fence(x,.5,Math.min(25.4,x+1.7),.5);
  });
  scene.add.image(-1050,-70,'terrain').setOrigin(0,0).setDepth(-1000);
}
