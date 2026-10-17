import config from '../content/chapter3.json' with {type:'json'};
import { inventoryUsed, transferItems } from './economy.ts';
import { has } from './chapter2.ts';
import { incomeAccount } from './finance.ts';
import type { World, Actor, Goal, Crop } from './world.ts';
import type { Inventory, Item, Vec2 } from './contracts.ts';
export {config as bakeryConfig};
export const emptyItems=()=>({corn:0,egg:0,gift:0,wheat:0,flour:0,cake:0});
const store=(capacity:number):Inventory=>({capacity,items:emptyItems()});
export interface BakeryState {
  crops:Crop[];millInput:Inventory;flour:Inventory;ovenFlour:Inventory;ovenEgg:Inventory;cakes:Inventory;stock:Inventory;
  millTime:number;ovenTime:number;saleTime:number;pendingCash:number;
  harvested:number;milled:number;baked:number;sold:number;
}
export function createBakery():BakeryState {return {crops:Array.from({length:25},(_,id)=>({id,position:{x:config.field.x+.5+(id%5)*1.1,z:config.field.z+.5+Math.floor(id/5)*1.1},readyAt:0,reservedBy:null})),millInput:store(120),flour:store(60),ovenFlour:store(60),ovenEgg:store(60),cakes:store(36),stock:store(60),millTime:0,ovenTime:0,saleTime:0,pendingCash:0,harvested:0,milled:0,baked:0,sold:0};}
const near=(a:Vec2,b:Vec2,r=1)=>Math.hypot(a.x-b.x,a.z-b.z)<r;
export function harvestWheat(w:World,crop:Crop,actor:Actor):boolean {
  if(crop.readyAt>w.time||inventoryUsed(actor.bag)>=actor.bag.capacity)return false;
  crop.readyAt=w.time+config.field.regrowSeconds;actor.bag.items.wheat++;w.bakery.harvested++;return true;
}
export function bakeryMode(w:World):string {
  const a=w.player,b=w.bakery,p=config.points;
  if(has(w,'mill')&&a.bag.items.wheat&&near(a.position,p.millInput))return 'mill-input';
  if(has(w,'mill')&&b.flour.items.flour&&inventoryUsed(a.bag)<a.bag.capacity&&near(a.position,p.flourOutput))return 'flour-output';
  if(has(w,'oven')){
    if(a.bag.items.flour&&near(a.position,p.flourInput))return 'flour-input';
    if(a.bag.items.egg&&near(a.position,p.eggInput))return 'oven-egg';
    if(b.cakes.items.cake&&inventoryUsed(a.bag)<a.bag.capacity&&near(a.position,p.cakeOutput))return 'cake-output';
  }
  if(has(w,'cake_stall')&&a.bag.items.cake&&near(a.position,p.cakeSupply))return 'cake-supply';
  if(b.pendingCash&&near(a.position,p.cash))return 'cake-cash';
  if(has(w,'wheat_field')&&!a.bag.items.egg&&!a.bag.items.flour&&!a.bag.items.cake&&!a.bag.items.gift&&(!w.navigationTarget||(w.navigationTarget.x>=43&&w.navigationTarget.x<=49&&w.navigationTarget.z<9))&&b.crops.some(c=>c.readyAt<=w.time&&near(a.position,c.position,1.15)))return 'wheat-harvest';
  return '';
}
type Fx=(item:Item|'cash',n:number,from:Vec2,to:Vec2)=>void;
export function bakeryInteract(w:World,mode:string,n:number,fx:Fx):void {
  const a=w.player,b=w.bakery,p=config.points;
  const routes:Record<string,[Inventory,Inventory,Item,Vec2]>={
    'mill-input':[a.bag,b.millInput,'wheat',p.millInput],
    'flour-output':[b.flour,a.bag,'flour',p.flourOutput],
    'flour-input':[a.bag,b.ovenFlour,'flour',p.flourInput],
    'oven-egg':[a.bag,b.ovenEgg,'egg',p.eggInput],
    'cake-output':[b.cakes,a.bag,'cake',p.cakeOutput],
    'cake-supply':[a.bag,b.stock,'cake',p.cakeSupply]
  };
  const route=routes[mode];if(route){const[from,to,item,at]=route;fx(item,transferItems(from,to,item,n),from===a.bag?a.position:at,to===a.bag?a.position:at);}
  if(mode==='wheat-harvest')for(const crop of b.crops.filter(c=>c.readyAt<=w.time&&near(a.position,c.position,1.15)).slice(0,n))if(harvestWheat(w,crop,a))fx('wheat',1,crop.position,a.position);
  if(mode==='cake-cash'){const amount=Math.min(n,b.pendingCash);b.pendingCash-=amount;incomeAccount(w).cash+=amount;w.stats.collected+=amount;fx('cash',amount,p.cash,a.position);}
}
export function updateBakery(w:World,dt:number,fx:Fx):void {
  const b=w.bakery,p=config.points;
  if(has(w,'mill')&&b.millInput.items.wheat>=config.mill.wheat&&inventoryUsed(b.flour)<b.flour.capacity){b.millTime+=dt;if(b.millTime>=config.mill.seconds){b.millTime=0;b.millInput.items.wheat-=config.mill.wheat;b.flour.items.flour++;b.milled++;fx('flour',1,p.millInput,p.flourOutput);}}
  if(has(w,'oven')&&b.ovenFlour.items.flour>=config.oven.flour&&b.ovenEgg.items.egg>=config.oven.egg&&inventoryUsed(b.cakes)<b.cakes.capacity){b.ovenTime+=dt;if(b.ovenTime>=config.oven.seconds){b.ovenTime=0;b.ovenFlour.items.flour-=config.oven.flour;b.ovenEgg.items.egg-=config.oven.egg;b.cakes.items.cake++;b.baked++;fx('cake',1,p.eggInput,p.cakeOutput);}}
  if(has(w,'cake_stall')&&b.stock.items.cake){b.saleTime+=dt;if(b.saleTime>=config.retail.seconds){b.saleTime=0;b.stock.items.cake--;b.sold++;b.pendingCash+=config.retail.price;w.stats.earned+=config.retail.price;fx('cash',config.retail.price,p.cakeSupply,p.cash);}}
}
export function bakeryGoal(w:World):Omit<Goal,'stage'>|null {
  if(!has(w,'bakery_land'))return null;
  const a=w.player,b=w.bakery,p=config.points;
  const result=(title:string,detail:string,target:Vec2)=>({title,detail,target});
  if(a.bag.items.corn)return result('先把玉米送回料槽','腾出背包，准备烘焙',{x:15,z:5});
  if(a.bag.items.gift)return result('先把礼盒送去集市','两条加工线共用鸡舍，原来的生意继续营业',{x:31.5,z:16});
  if(a.bag.items.cake)return result('把蛋糕送到摊位',`已售 ${b.sold} 个 · 每个 $${config.retail.price}`,p.cakeSupply);
  if(a.bag.items.wheat){
    const crop=b.crops.find(c=>c.readyAt<=w.time&&near(a.position,c.position,1.5));
    if(a.bag.items.wheat<18&&crop)return result('多收一批小麦','先装够 18 份，再送进磨坊',crop.position);
    return result('把小麦送进磨坊','3 份小麦 → 1 袋面粉',p.millInput);
  }
  if(a.bag.items.flour)return result('把面粉送进烤炉','每个蛋糕需要 2 袋面粉和 2 枚鸡蛋',p.flourInput);
  if(a.bag.items.egg){if(a.bag.items.egg<12&&w.ground.items.egg&&near(a.position,{x:12.8,z:9.4},1.2))return result('多取一批农场鸡蛋','第一章的鸡蛋也能用于烘焙',{x:12.8,z:9.4});return result('给烤炉送鸡蛋','与包装台共用第一章鸡舍的产出',p.eggInput);}
  if(b.cakes.items.cake)return result('取出刚烤好的蛋糕','走近取货区自动装入背包',p.cakeOutput);
  if(has(w,'oven')&&b.ovenEgg.items.egg<4)return result('去农场取烘焙用鸡蛋','原店员和运蛋员也会跨区供货',{x:12.8,z:9.4});
  if(has(w,'oven')&&b.flour.items.flour)return result('取走磨好的面粉',`已有 ${b.flour.items.flour} 袋`,p.flourOutput);
  if(has(w,'mill')&&b.millInput.items.wheat>=12)return result('磨坊正在研磨','招聘麦农和烘焙师可自动运转',p.flourOutput);
  const crop=b.crops.filter(c=>c.readyAt<=w.time).sort((x,y)=>Math.hypot(x.position.x-a.position.x,x.position.z-a.position.z)-Math.hypot(y.position.x-a.position.x,y.position.z-a.position.z))[0];
  return result('收割成熟的小麦','走过成熟小麦自动收割',crop?.position??{x:46,z:5});
}
