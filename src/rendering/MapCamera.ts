import type {FarmScene} from './FarmScene.ts';
import {clampZoom,overviewFrame,MIN_ZOOM,MAX_ZOOM} from './mapViewport.ts';
import {unlocked} from '../domain/world.ts';

export class MapCamera {
  overview=false;
  normalZoom:number;
  signature='';
  constructor(private scene:FarmScene){this.normalZoom=scene.scale.width<600?.86:scene.scale.width<1000?1:1.1;this.follow();}
  follow():void {
    this.overview=false;const s=this.scene;
    s.cameras.main.setZoom(this.normalZoom).startFollow(s.actors.get('player')!.root,true,.09,.09,0,s.scale.height<600?35:65);
    this.present();
  }
  toggle():void{if(this.overview)this.follow();else this.fit();}
  fit():void {
    this.overview=true;const s=this.scene,w=s.ports.world(),maxX=unlocked(w,'bakery_land')?60.5:unlocked(w,'market_land')?40.5:25;
    const f=overviewFrame(s.scale.width,s.scale.height,w.player.position);
    s.cameras.main.stopFollow().setZoom(f.zoom).centerOn(f.x,f.y);
    this.signature=`${s.scale.width}/${s.scale.height}/${maxX}`;this.present();
  }
  zoomBy(factor:number):void {
    const c=this.scene.cameras.main;c.setZoom(clampZoom(c.zoom*factor));
    if(!this.overview)this.normalZoom=c.zoom;
    this.present();
  }
  pan(dx:number,dy:number):boolean {
    if(!this.overview)return false;
    const c=this.scene.cameras.main;c.scrollX-=dx/c.zoom;c.scrollY-=dy/c.zoom;return true;
  }
  resize():void {if(this.overview)this.fit();else this.follow();}
  update():void {
    const s=this.scene,w=s.ports.world(),maxX=unlocked(w,'bakery_land')?60.5:unlocked(w,'market_land')?40.5:25;
    if(this.overview&&this.signature!==`${s.scale.width}/${s.scale.height}/${maxX}`)this.fit();
  }
  present():void {
    const zoom=this.scene.cameras.main.zoom;
    document.getElementById('zoom-level')!.textContent=`${Math.round(zoom*100)}%`;
    document.getElementById('map-overview')!.textContent=this.overview?'跟随':'总览';
    document.getElementById('map-overview')!.setAttribute('aria-pressed',String(this.overview));
    document.getElementById('map-tip')!.hidden=!this.overview;
    (document.getElementById('zoom-in')as HTMLButtonElement).disabled=zoom>=MAX_ZOOM;
    (document.getElementById('zoom-out')as HTMLButtonElement).disabled=zoom<=MIN_ZOOM;
  }
}
