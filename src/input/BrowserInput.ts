import type { Vec2 } from '../domain/contracts.ts';

export class BrowserInput {
  keys=new Set<string>();
  vector:Vec2={x:0,z:0};
  joystick:HTMLElement;
  stick:HTMLElement;
  enabled=true;
  pointer:number|null=null;
  start={x:0,y:0};
  dragging=false;
  floating=false;
  panLast={x:0,y:0};
  constructor(canvas:HTMLCanvasElement,onClick:(x:number,y:number)=>void,onPan?:(dx:number,dy:number)=>boolean){
    this.joystick=document.getElementById('joystick')!;this.stick=document.getElementById('stick')!;
    window.addEventListener('keydown',e=>{if(!this.enabled)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.reset());
    const begin=(e:PointerEvent,floating:boolean)=>{if(!this.enabled||this.pointer!==null||e.button!==0)return;e.preventDefault();this.pointer=e.pointerId;this.start={x:e.clientX,y:e.clientY};this.panLast={...this.start};this.dragging=!floating;this.floating=floating;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);};
    this.joystick.addEventListener('pointerdown',e=>{const r=this.joystick.querySelector('.joystick-ring')!.getBoundingClientRect();begin(e,false);this.start={x:r.left+r.width/2,y:r.top+r.height/2};});
    canvas.addEventListener('pointerdown',e=>begin(e,true));
    const move=(e:PointerEvent)=>{if(this.pointer!==e.pointerId||!this.enabled)return;const dx=e.clientX-this.start.x,dy=e.clientY-this.start.y;if(!this.dragging&&Math.hypot(dx,dy)<9)return;this.dragging=true;if(this.floating&&onPan?.(e.clientX-this.panLast.x,e.clientY-this.panLast.y)){this.panLast={x:e.clientX,y:e.clientY};this.vector={x:0,z:0};return;}if(this.floating){this.joystick.classList.add('floating');this.joystick.style.left=`${this.start.x-56}px`;this.joystick.style.top=`${this.start.y-55}px`;}
      const length=Math.hypot(dx,dy),scale=length>40?40/length:1;this.vector={x:dx/Math.max(40,length),z:dy/Math.max(40,length)};this.stick.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;};
    const end=(e:PointerEvent)=>{if(this.pointer!==e.pointerId)return;const click=this.floating&&!this.dragging&&this.enabled;this.resetPointer();if(click)onClick(e.clientX,e.clientY);};
    for(const element of [canvas,this.joystick]){element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',()=>this.resetPointer());element.addEventListener('lostpointercapture',()=>this.resetPointer());}
  }
  movement():Vec2{if(!this.enabled)return{x:0,z:0};const x=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft')),z=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));return x||z?{x,z}:this.vector;}
  resetPointer():void{this.pointer=null;this.vector={x:0,z:0};this.stick.style.transform='';this.joystick.classList.remove('floating');this.joystick.style.left='';this.joystick.style.top='';this.dragging=false;}
  reset():void{this.keys.clear();this.resetPointer();}
}
