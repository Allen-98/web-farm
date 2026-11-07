// Offline contact sheet of the actual procedural textures, not a browser screenshot.
// Requires @napi-rs/canvas, available through NODE_PATH or the current installation.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const ts=require('typescript');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'docs/images');
const cache=new Map(),textures=new Map();
const volumeFrames=JSON.parse(fs.readFileSync(path.join(root,'src/content/volume-art.json'),'utf8'));
const volumePages=await Promise.all(Array.from({length:Math.max(...Object.values(volumeFrames).map(f=>f.page))+1},(_,i)=>i).map(i=>loadImage(path.join(root,'src/assets/volume-atlas-'+i+'.png'))));
const paintVolume=(_scene,key,c,w,h)=>{
  const f=volumeFrames[key];if(!f)return false;
  c.drawImage(volumePages[f.page],f.x,f.y,f.width,f.height,0,0,w,h);return true;
};
function load(file){
  file=path.resolve(file);
  if(cache.has(file))return cache.get(file);
  let source=fs.readFileSync(file,'utf8');
  // Expose the private pure painter in this verification context only.
  if(file.endsWith('BakeryView.ts'))source=source.replace('function createBakeryArt','export function createBakeryArt');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};cache.set(file,exports);
  const localRequire=name=>{
    if(name==='phaser'||name.includes('/domain/'))return {};
    if(name.endsWith('/volumeArt.ts'))return {paintVolume};
    return load(path.resolve(path.dirname(file),name));
  };
  vm.runInNewContext(code,{exports,require:localRequire,document:{createElement:()=>createCanvas(1,1)},console},{filename:file});
  return exports;
}
const objects=[];
const scene={scale:{width:1280,height:800},textures:{addCanvas(key,canvas){textures.set(key,canvas);}},add:{
  image(x,y,key){const o={x,y,key,origin:[.5,.5],depth:0,setOrigin(a,b=a){this.origin=[a,b];return this;},setDepth(d){this.depth=d;return this;}};objects.push(o);return o;},
  tileSprite(){return{setDepth(){return this;}};}
}};
const art=load(path.join(root,'src/rendering/art.ts'));
const chapter=load(path.join(root,'src/rendering/ChapterView.ts'));
const bakery=load(path.join(root,'src/rendering/BakeryView.ts'));
const land=load(path.join(root,'src/rendering/landscape.ts'));
art.createArt(scene);chapter.createChapterArt(scene);bakery.createBakeryArt(scene);art.createTerrain(scene);
const marketConfig=JSON.parse(fs.readFileSync(path.join(root,'src/content/chapter2.json'),'utf8'));
const bakeryConfig=JSON.parse(fs.readFileSync(path.join(root,'src/content/chapter3.json'),'utf8'));
land.createLand(scene,'land.market',marketConfig.area,2);
land.createLand(scene,'land.bakery',bakeryConfig.area,3);
for(const [key,canvas]of textures){
  const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  if(!pixels.some((n,i)=>i%4===3&&n))throw new Error('Empty texture: '+key);
}
const canvas=createCanvas(1600,1160),c=canvas.getContext('2d');
c.fillStyle='#eef7e3';c.fillRect(0,0,1600,1160);
function text(copy,x,y,size=18,color='#435d48',weight='normal'){
  c.fillStyle=color;c.font=weight+' '+size+'px "Microsoft YaHei", sans-serif';c.fillText(copy,x,y);
}
text('FARM & FLOW',56,56,13,'#8d9577','bold');
text('田园小掌柜  /  明亮立体 2.5D',54,112,38,'#3e5947','bold');
text('真实模型烘焙 · 圆润倒角 · 球面光照 · 鲜明色彩 · 柔和投影',56,151,18,'#7c876e');
text('游戏使用的模型烘焙素材 · 非浏览器截图',1160,56,14,'#889078');
const colors=['#8bd64b','#24b6a3','#fff9e4','#ffc632','#ef5547','#f76c9e'];
colors.forEach((color,i)=>{c.fillStyle=color;c.beginPath();c.roundRect(56+i*85,177,68,12,6);c.fill();});
function card(x,y,w,h,title,subtitle){
  c.fillStyle='#ffffff';c.beginPath();c.roundRect(x,y,w,h,18);c.fill();
  c.strokeStyle='#d3e6ba';c.lineWidth=1;c.stroke();
  text(title,x+22,y+32,17,'#4a624b','bold');text(subtitle,x+22,y+54,12,'#8c947c');
}
function image(key,x,y,scale=1){
  const a=textures.get(key);if(!a)throw new Error('Missing texture '+key);
  c.drawImage(a,x-a.width*scale/2,y-a.height*scale/2,a.width*scale,a.height*scale);
}
card(40,222,480,300,'01  鸡蛋农场','红瓦立体鸡舍 / 蓝绿条纹鲜蛋摊');
image('building.coop',210,384,.83);image('building.counter',413,403,.58);
card(540,222,490,300,'02  乡间集市','亮橙礼盒摊 / 湖蓝批发货车');
image('building.gift-stall',678,390,.8);image('vehicle.wholesale',900,412,.65);
card(1050,222,510,300,'03  烘焙工坊','糖果粉烘焙摊 / 蓝顶风车 / 橙色烤炉');
image('building.cake-stall',1161,401,.64);image('building.mill',1335,385,.68);image('building.oven',1485,419,.55);
card(40,542,480,260,'草木与季节','球面树冠、立体花丛与饱满玉米');
image('environment.pine',123,690,.85);image('environment.garden',260,742,1.15);
image('crop.corn',361,690,.85);image('crop.wheat',445,701,.85);
card(540,542,490,260,'小小农场居民','角色分工与清楚的货物轮廓');
image('actor.player.0.0',609,694,.85);image('actor.harvest.0.0',691,694,.85);image('actor.clerk.0.0',773,694,.85);
image('animal.chicken',872,716,.85);image('resource.gift-box',950,698,1);
image('resource.egg',876,760,.65);image('resource.flour',922,755,.8);image('resource.cake',976,759,.8);
card(1050,542,510,260,'材质与色彩','倒角高光、深浅面与方向性投影');
image('building.pack-table',1200,690,.72);image('vehicle.harvester',1426,706,.88);
card(40,822,1520,290,'三片相连的田园','鲜绿色草地 / 有厚度的地块 / 深色土壤垄沟 / 金色小路');
for(const [key,x]of [['land.farm',291],['land.market',800],['land.bakery',1300]])image(key,x,981,.32);
text('2026.11  ·  3D MODELS / ORTHOGRAPHIC SPRITES',58,1140,12,'#8c9479');
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'art-volume-20261107.png'),canvas.toBuffer('image/png'));
// A composition check using the real game projection, positions, sizes and anchors.
// This is deliberately labelled as an offline composition, never a playtest screenshot.
const sceneCanvas=createCanvas(1440,960),sc=sceneCanvas.getContext('2d');
const project=(x,z)=>({x:(x-z)*34,y:(x+z)*18});
const drawables=[];
function place(key,x,y,scale=1,originX=.5,originY=.5,depth=y){drawables.push({key,x,y,scale,originX,originY,depth});}
sc.fillStyle=sc.createPattern(textures.get('land.meadow'),'repeat');sc.fillRect(0,0,1440,960);
for(const item of objects.filter(o=>['land.farm','land.road'].includes(o.key)))place(item.key,item.x,item.y,1,0,0,item.depth);
for(const [x,z,scale]of [[0,2,.8],[0,8,.75],[0,15,.86],[0,22,.7],[5.5,27,.68],[5.5,34,.8],[27.5,27,.75],[43,5,.8],[43,17,.9],[10,38,.75],[19,38,.8],[5,-1,.7],[12,-1,.8],[20,-1,.7]]){
  const p=project(x,z);place('environment.pine',p.x,p.y,scale,.5,.93);
}
for(const [x,z,scale]of [[8,-.5,.8],[16,-.5,.7],[24,-.5,.8],[6,21.8,.8],[27.5,22,.8]]){const p=project(x,z);place('environment.garden',p.x,p.y,scale,.5,.8);}
const cp=project(11,4.5);place('building.coop',cp.x,cp.y,.91,.5,190/300,cp.y+10);
for(let i=0;i<6;i++){const row=(i%2)*2;place('animal.chicken',cp.x-25+i*15-row*7,cp.y-15+i*7.9+row*3.7,.4,.5,.9,cp.y+15);}
for(let i=0;i<48;i++){const p=project(16.6+i%6*1.3,2.5+Math.floor(i/6)*.96);place('crop.corn',p.x,p.y,.52,.5,.95);}
for(let i=0;i<30;i++){const p=project(8.6+i%6*.75,7.4+Math.floor(i/6)*.65);place('resource.egg',p.x,p.y,.61,.5,.85,p.y+1);}
for(const [x,z]of [[9.5,13.5],[21.5,17.5]]){const p=project(x,z);place('building.counter',p.x,p.y,.83,.5,176/230,p.y+10);}
for(const [key,x,z]of [['actor.player.0.0',15,11],['actor.harvest.2.0',19,10.5],['actor.harvest.3.1',16,12],['actor.clerk.0.1',13,13],['actor.customer2.0.0',21,20.2]]){const p=project(x,z);place(key,p.x,p.y,.59,.5,100/110,p.y+10);}
const tr=project(23,7);place('vehicle.harvester',tr.x,tr.y,.8,.5,.8,tr.y+11);
sc.save();sc.translate(530,40);sc.scale(.95,.95);
for(const d of drawables.sort((a,b)=>a.depth-b.depth)){const source=textures.get(d.key);sc.drawImage(source,d.x-source.width*d.scale*d.originX,d.y-source.height*d.scale*d.originY,source.width*d.scale,source.height*d.scale);}
sc.restore();
sc.fillStyle='#fffef1';sc.beginPath();sc.roundRect(30,28,335,112,20);sc.fill();
sc.fillStyle='#187f70';sc.font='bold 27px "Microsoft YaHei"';sc.fillText('田园小掌柜 · 立体 2.5D',50,72);
sc.fillStyle='#4c7665';sc.font='14px "Microsoft YaHei"';sc.fillText('游戏素材离线合成 · 非浏览器截图',50,105);
fs.writeFileSync(path.join(out,'farm-volume-scene-20261107.png'),sceneCanvas.toBuffer('image/png'));
console.log(JSON.stringify({textures:textures.size,volumeSprites:Object.keys(volumeFrames).length,nonEmpty:true,output:path.join(out,'art-volume-20261107.png'),scene:path.join(out,'farm-volume-scene-20261107.png')}));

// All three actual plot positions, for a map-composition review.
for(const item of objects.filter(o=>['land.market','land.bakery'].includes(o.key)))place(item.key,item.x,item.y,1,0,0,item.depth);
for(const b of marketConfig.buildings){const p=project(b.center.x,b.center.z);const key=b.id==='pack_table'?'building.pack-table':b.id==='gift_stall'?'building.gift-stall':'vehicle.wholesale';place(key,p.x,p.y,.9,.5,b.id==='pack_table'?130/190:b.id==='gift_stall'?176/230:165/230,p.y+8);}
for(const b of bakeryConfig.buildings){const p=project(b.center.x,b.center.z);place('building.'+(b.id==='cake_stall'?'cake-stall':b.id),p.x,p.y,.9,.5,b.id==='mill'?178/240:b.id==='oven'?154/210:176/230,p.y+8);}
for(let i=0;i<25;i++){const p=project(bakeryConfig.field.x+.5+i%5*1.1,bakeryConfig.field.z+.5+Math.floor(i/5)*1.1);place('crop.wheat',p.x,p.y,.58,.5,.95);}
for(const [key,x,z]of [['actor.clerk.0.1',15,20],['actor.clerk.2.1',23,20],['actor.harvest.1.1',11,26],['actor.customer2.0.0',21,36.1],['actor.customer2.0.0',37,17.8]]){const p=project(x,z);place(key,p.x,p.y,.59,.5,100/110,p.y+10);}
const compact=createCanvas(1800,1080),cc=compact.getContext('2d');cc.fillStyle='#eef7e3';cc.fillRect(0,0,1800,1080);
cc.save();cc.translate(740,125);cc.scale(.66,.66);
for(const d of drawables.sort((a,b)=>a.depth-b.depth)){const source=textures.get(d.key);cc.drawImage(source,d.x-source.width*d.scale*d.originX,d.y-source.height*d.scale*d.originY,source.width*d.scale,source.height*d.scale);}
cc.restore();
cc.fillStyle='#185f54';cc.font='bold 38px "Microsoft YaHei"';cc.fillText('紧凑三地 · 农场 / 集市 / 烘焙',58,68);
cc.fillStyle='#567568';cc.font='18px "Microsoft YaHei"';cc.fillText('烘焙工坊移至农场南侧，共用联络路；鲜明立体 2.5D 美术保持一致',60,105);
function badge(copy,x,z){const p=project(x,z),sx=740+p.x*.66,sy=125+p.y*.66;cc.font='bold 21px "Microsoft YaHei"';const width=cc.measureText(copy).width+32;cc.fillStyle='#fffbed';cc.beginPath();cc.roundRect(sx-width/2,sy-20,width,42,12);cc.fill();cc.fillStyle='#246454';cc.fillText(copy,sx-width/2+16,sy+8);}
badge('01 鸡蛋农场',13,0);badge('02 乡间集市',34,1);badge('03 烘焙工坊',9,37.5);
cc.fillStyle='#567568';cc.font='17px "Microsoft YaHei"';cc.fillText('实际游戏素材与地图坐标离线合成 · 非浏览器截图',60,1035);
fs.writeFileSync(path.join(out,'compact-map-20261107.png'),compact.toBuffer('image/png'));
