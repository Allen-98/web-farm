import map from '../content/map.json' with {type:'json'};
import market from '../content/chapter2.json' with {type:'json'};
import bakery from '../content/chapter3.json' with {type:'json'};
import type {Vec2} from './contracts.ts';

/** Regional entry points and walkable footprints share the content coordinates. */
export const REGION_CENTERS = {
  farm:{x:15,z:11},
  market:{x:market.area.x+4,z:market.area.z+10},
  bakery:{x:bakery.area.x+7,z:bakery.area.z+10}
};
export function withinMap(p:Vec2,marketOpen:boolean,bakeryOpen:boolean):boolean {
  const b=map.walkBounds;
  if(p.x>=b.minX&&p.x<=(marketOpen?market.bounds.maxX:b.maxX)&&p.z>=b.minZ&&p.z<=b.maxZ)return true;
  // South promenade joins both entrances; the unoccupied southeast remains outside the map.
  return bakeryOpen&&p.x>=bakery.area.x&&p.x<=bakery.area.x+bakery.area.width-.5&&p.z>=b.maxZ&&p.z<=bakery.area.z+bakery.area.height-.5;
}

/** Only the former eastern bakery moves; farm and market keep their familiar positions. */
export function fromLinearLayout(p:Vec2):Vec2 {
  return p.x>40.5?{x:p.x+(bakery.area.x-42),z:p.z+(bakery.area.z-1)}:{...p};
}
