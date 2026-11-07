import type Phaser from 'phaser';
import frames from '../content/volume-art.json';
import {VOLUME_SOURCES} from './volumeSources.ts';

type Frame={page:number;x:number;y:number;width:number;height:number};
const FRAMES=frames as Record<string,Frame>;
export function preloadVolumeArt(scene:Phaser.Scene):void {
  VOLUME_SOURCES.forEach((url,page)=>scene.load.image('volume.atlas.'+page,url));
}
export function releaseVolumeArt(scene:Phaser.Scene):void {
  // The final logical textures own their canvases; discard the temporary source atlases.
  VOLUME_SOURCES.forEach((_,page)=>{
    const key='volume.atlas.'+page;if(scene.textures.exists(key))scene.textures.remove(key);
  });
}
/** Retain the original logical sizes and ground anchors used by gameplay. */
export function paintVolume(scene:Phaser.Scene,key:string,c:CanvasRenderingContext2D,w:number,h:number):boolean {
  const frame=FRAMES[key];
  if(!frame||!scene.textures.exists('volume.atlas.'+frame.page))return false;
  const source=scene.textures.get('volume.atlas.'+frame.page).getSourceImage() as HTMLImageElement;
  c.drawImage(source,frame.x,frame.y,frame.width,frame.height,0,0,w,h);
  return true;
}
