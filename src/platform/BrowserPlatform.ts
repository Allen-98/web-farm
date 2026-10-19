import { validateWorld, CONFIG_VERSION, map, migrateWorld, UPGRADE_SPECS } from '../domain/world.ts';
import type { World } from '../domain/world.ts';

const SAVE_KEY='farm-and-flow.save.v1';
export class BrowserPlatform {
  audio:AudioContext|null=null;
  muted=true;
  lastNote=0;
  storageAvailable=true;
  loadFailed=false;
  migratedFrom:string|null=null;
  load():World|null{
    try{
      const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
      const envelope=JSON.parse(raw);
      if(envelope.schemaVersion!==1||![CONFIG_VERSION,'farm-v1.0','farm-v2.0','farm-v3.0','farm-v3.1'].includes(envelope.configVersion)||envelope.configVersion!==envelope.world?.version)throw new Error('Unsupported saved progress');
      const migrated=envelope.configVersion!==CONFIG_VERSION;
      const w=migrateWorld(envelope.world as World);
      if(migrated){const suffix=envelope.configVersion==='farm-v1.0'?'v1-before-chapter2':envelope.configVersion==='farm-v2.0'?'v2-before-chapter3':envelope.configVersion==='farm-v3.1'?'v3.1-before-orders':'v3-before-capacity';const key=`${SAVE_KEY}.backup.${suffix}`;if(!localStorage.getItem(key))localStorage.setItem(key,raw);this.migratedFrom=envelope.configVersion;}
      w.events=[];w.player.path=[];w.navigationTarget=null;
      for(const u of w.upgrades){const p=map.investmentZones.find(z=>z.upgradeId===u.id);if(p)u.position={x:p.x,z:p.z};u.label=UPGRADE_SPECS.find(spec=>spec.id===u.id)?.label??u.label;}
      for(const a of w.workers){a.path=[];a.targetCrop=null;}
      for(const c of w.crops)c.reservedBy=null;
      return w;
    }catch{this.loadFailed=true;return null;}
  }
  save(w:World):boolean{
    if(this.loadFailed)return false;
    try{validateWorld(w);const payload=JSON.stringify({schemaVersion:1,configVersion:CONFIG_VERSION,world:{...w,events:[]}});localStorage.setItem(`${SAVE_KEY}.pending`,payload);localStorage.setItem(SAVE_KEY,payload);localStorage.removeItem(`${SAVE_KEY}.pending`);return true;}catch{this.storageAvailable=false;return false;}
  }
  clear():void{this.loadFailed=false;try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(`${SAVE_KEY}.pending`);}catch{this.storageAvailable=false;}}
  toggleAudio():boolean{this.muted=!this.muted;if(!this.muted){this.audio??=new AudioContext();void this.audio.resume();}return !this.muted;}
  play(kind:string):void{
    if(this.muted||!this.audio||this.audio.state!=='running'||this.audio.currentTime-this.lastNote<.07)return;
    const a=this.audio,t=a.currentTime,o=a.createOscillator(),g=a.createGain();this.lastNote=t;o.type='sine';o.frequency.setValueAtTime(kind==='build'?783:kind==='cash'?880:kind==='egg'?620:430,t);o.frequency.exponentialRampToValueAtTime(kind==='build'?1046:kind==='cash'?1320:340,t+.1);g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+.16);
  }
}
