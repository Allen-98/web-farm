import { availableCash, incomeAccount } from './finance.ts';
import config from '../content/chapter2.json' with { type: 'json' };
import { inventoryUsed, transferItems, collectCash } from './economy.ts';
import type { World, Goal } from './world.ts';
import type { Inventory, Vec2, Item } from './contracts.ts';

export { config as chapterConfig };
export interface ChapterState {
  input: Inventory; output: Inventory; stock: Inventory;
  progress: number; retailTime: number; pendingCash: number;
  truck: { loaded: number; cooldown: number; pendingCash: number; delivered: number };
  packed: number; retailSold: number; wholesaleSold: number;
}
const store=(capacity:number):Inventory=>({capacity,items:{corn:0,egg:0,gift:0,wheat:0,flour:0,cake:0}});
export const createChapter=():ChapterState=>({input:store(config.recipe.inputCapacity),output:store(config.recipe.outputCapacity),stock:store(config.retail.capacity),progress:0,retailTime:0,pendingCash:0,truck:{loaded:0,cooldown:0,pendingCash:0,delivered:0},packed:0,retailSold:0,wholesaleSold:0});
export const has=(w:World,id:string):boolean=>w.upgrades.some(u=>u.id===id&&u.unlocked);
export function eligible(w:World,id:string):boolean {
  return (id!=='wholesale'||w.chapter.retailSold>=4)&&(id!=='packer'||w.chapter.truck.delivered>=1);
}
const near=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z)<1;
export function chapterMode(w:World):string {
  const a=w.player,c=w.chapter,p=config.points;
  if(!has(w,'market_land'))return '';
  if(has(w,'pack_table')){
    if(a.bag.items.egg&&near(a.position,p.input))return 'pack-input';
    if(c.output.items.gift&&inventoryUsed(a.bag)<a.bag.capacity&&near(a.position,p.output))return 'pack-output';
  }
  if(has(w,'wholesale')&&a.bag.items.gift&&!c.truck.cooldown&&near(a.position,p.loading))return 'truck-load';
  if(has(w,'gift_stall')&&a.bag.items.gift&&near(a.position,p.supply))return 'gift-supply';
  if(c.pendingCash&&near(a.position,p.cash))return 'gift-cash';
  if(c.truck.pendingCash&&near(a.position,p.truckCash))return 'truck-cash';
  return '';
}
type Fx=(item:Item|'cash',amount:number,from:Vec2,to:Vec2)=>void;
export function chapterInteract(w:World,mode:string,n:number,fx:Fx):void {
  const a=w.player,c=w.chapter,p=config.points;
  if(mode==='pack-input')fx('egg',transferItems(a.bag,c.input,'egg',n),a.position,p.input);
  if(mode==='pack-output')fx('gift',transferItems(c.output,a.bag,'gift',n),p.output,a.position);
  if(mode==='gift-supply')fx('gift',transferItems(a.bag,c.stock,'gift',n),a.position,p.supply);
  if(mode==='truck-load'){
    const amount=Math.min(n,a.bag.items.gift,config.wholesale.boxes-c.truck.loaded);
    a.bag.items.gift-=amount;c.truck.loaded+=amount;fx('gift',amount,a.position,p.loading);
  }
  if(mode==='gift-cash'||mode==='truck-cash'){
    const source=mode==='gift-cash'?c:c.truck,pile={cash:source.pendingCash};
    const amount=collectCash(pile,incomeAccount(w),n);source.pendingCash=pile.cash;w.stats.collected+=amount;fx('cash',amount,mode==='gift-cash'?p.cash:p.truckCash,a.position);
  }
}
export function updateChapter(w:World,dt:number,fx:Fx):void {
  const c=w.chapter,r=config.recipe,t=c.truck;
  if(has(w,'pack_table')&&c.input.items.egg>=r.eggs&&inventoryUsed(c.output)<c.output.capacity){
    c.progress+=dt;
    if(c.progress>=r.seconds){c.progress=0;c.input.items.egg-=r.eggs;c.output.items.gift++;c.packed++;fx('gift',1,config.points.input,config.points.output);}
  }
  if(has(w,'gift_stall')&&c.stock.items.gift){
    c.retailTime+=dt;
    if(c.retailTime>=config.retail.seconds){c.retailTime=0;c.stock.items.gift--;c.retailSold++;c.pendingCash+=config.retail.price;w.stats.earned+=config.retail.price;fx('cash',config.retail.price,config.points.supply,config.points.cash);}
  }
  t.cooldown=Math.max(0,t.cooldown-dt);
  if(has(w,'wholesale')&&t.loaded===config.wholesale.boxes&&!t.cooldown){
    t.loaded=0;t.delivered++;c.wholesaleSold+=config.wholesale.boxes;t.pendingCash+=config.wholesale.price;w.stats.earned+=config.wholesale.price;t.cooldown=config.wholesale.returnSeconds;fx('cash',config.wholesale.price,config.points.loading,config.points.truckCash);
  }
}
export function chapterGoal(w:World):Omit<Goal,'stage'>|null {
  if(!has(w,'walk_clerk'))return null;
  const c=w.chapter,p=config.points,a=w.player;
  const result=(title:string,detail:string,target:Vec2)=>({title,detail,target});
  const next=w.upgrades.slice(0,17).find(u=>!u.unlocked&&u.requires.every(id=>has(w,id))&&eligible(w,u.id));
  if(next&&availableCash(w)<next.cost-next.paid){
    const piles=[...w.stations.filter(s=>s.enabled).map(s=>({cash:s.pendingCash,at:s.id==='car_counter'?{x:13,z:14}:{x:24,z:16}})),{cash:c.pendingCash,at:p.cash},{cash:c.truck.pendingCash,at:p.truckCash}].sort((a,b)=>b.cash-a.cash);
    if(piles[0].cash)return result('领取收入，继续扩建',`下一步：${next.label??next.id} · 还差 $${Math.max(0,next.cost-next.paid-availableCash(w))}`,piles[0].at);
  }
  if(!has(w,'pack_table'))return next?result(config.upgrades.find(u=>u.id===next.id)?.label??'建设新集市',`还需 $${next.cost-next.paid} · 点击前往`,next.position):null;
  if(a.bag.items.corn)return result('先把玉米送回料槽','腾出背包，准备生产礼盒',{x:15,z:5});
  if(a.bag.items.egg&&a.bag.items.egg<24&&w.ground.items.egg&&near(a.position,{x:12.8,z:9.4}))return result('多装一批鸡蛋','先装够一批，再送去包装台',{x:12.8,z:9.4});
  if(a.bag.items.gift&&a.bag.items.gift<8&&c.output.items.gift&&near(a.position,p.output))return result('多取一些礼盒','成批搬运，减少往返',p.output);
  if(a.bag.items.gift){
    if(has(w,'wholesale')&&!c.truck.cooldown)return result('把礼盒装上批发货车',`本车 ${c.truck.loaded} / ${config.wholesale.boxes} 盒 · 装满赚 $${config.wholesale.price}`,p.loading);
    if(has(w,'gift_stall'))return result('给礼盒摊补货',`已售 ${c.retailSold} 盒 · 每盒 $${config.retail.price}`,p.supply);
  }
  if(a.bag.items.egg)return result('把鸡蛋送进包装台',`${config.recipe.eggs} 枚鸡蛋 → 1 盒 · 输入库存 ${c.input.items.egg}`,p.input);
  if(c.output.items.gift)return result('取走包装好的礼盒',`已有 ${c.output.items.gift} 盒 · 走近自动装入背包`,p.output);
  if(c.input.items.egg<12)return result('收集鸡蛋，制作礼盒','原来的柜台继续营业 · 礼盒需要 6 枚鸡蛋',{x:12.8,z:9.4});
  if(c.truck.pendingCash)return result('领取批发货款',`已完成 ${c.truck.delivered} 车 · 有 $${c.truck.pendingCash} 等待领取`,p.truckCash);
  if(c.pendingCash)return result('领取礼盒摊收入',`有 $${c.pendingCash} 等待领取`,p.cash);
  return result(has(w,'packer')?'集市自动经营中':'包装台正在制作礼盒',has(w,'packer')?`批发已发车 ${c.truck.delivered} 次 · 可继续搬货加速`:'先售出 4 盒解锁货车，完成首车解锁包装工',p.output);
}
