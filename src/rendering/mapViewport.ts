import {project} from './projection.ts';
import type {Vec2} from '../domain/contracts.ts';

export const MIN_ZOOM=.57,MAX_ZOOM=1.8;
export function clampZoom(zoom:number):number{return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom));}
/** Keep buildings readable; explore the rest of the map by panning. */
export function overviewFrame(_width:number,height:number,focus:Vec2){
  const p=project(focus);
  const top=height<500?80:210,bottom=height<500?75:145;
  return {zoom:MIN_ZOOM,x:p.x,y:p.y+(height/2-(top+height-bottom)/2)/MIN_ZOOM};
}
