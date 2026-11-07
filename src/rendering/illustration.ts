/** Shared colors for vivid, rounded 2.5D farm models and their fallback illustrations. */
type C = CanvasRenderingContext2D;
export const PALETTE = {
  meadow: '#72bf47', grass: '#8bd64b', grassLight: '#b7ee6d', grassDark: '#4ca53c',
  ink: '#245456', cream: '#fff9e4', sage: '#24b6a3', gold: '#ffc632',
  clay: '#ef5547', wood: '#d68b39', soil: '#ad6a32', path: '#f0cd80',
} as const;
export const WORLD_TEXT = {
  fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif', fontSize: '12px',
  color: PALETTE.cream, stroke: '#4d6448', strokeThickness: 2,
};
export function oval(c:C,x:number,y:number,rx:number,ry:number,color:string,angle=0):void {
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();
}
export function poly(c:C,points:number[][],color:string):void {
  c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
export function stroke(c:C,points:number[][],color:string,width=2):void {
  c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
export function box(c:C,x:number,y:number,w:number,d:number,h:number,top:string,left:string,right:string):void {
  poly(c,[[x-w,y],[x,y+d],[x,y+d-h],[x-w,y-h]],left);
  poly(c,[[x,y+d],[x+w,y],[x+w,y-h],[x,y+d-h]],right);
  poly(c,[[x-w,y-h],[x,y-d-h],[x+w,y-h],[x,y+d-h]],top);
}
export function flower(c:C,x:number,y:number,color='#fff7dc',size=3):void {
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;oval(c,x+Math.cos(a)*size,y+Math.sin(a)*size,size*.75,size*.85,color);}
  oval(c,x,y,size*.7,size*.7,'#e8b95e');
}
export function planter(c:C,x:number,y:number):void {
  oval(c,x+3,y+3,15,5,'#425e4920');poly(c,[[x-11,y-15],[x+11,y-15],[x+8,y+1],[x-8,y+1]],'#bd7f61');
  stroke(c,[[x-12,y-15],[x+12,y-15]],'#e4ac80',4);
  for(const [dx,dy]of [[-7,-18],[5,-23],[0,-17]]){oval(c,x+dx,y+dy,8,5,'#799963',-.4);}
  flower(c,x-7,y-23,'#fff3ce',2.5);flower(c,x+5,y-28,'#efc4a6',3);
}
/** All stalls share their footprint and awning rhythm; accent identifies their trade. */
export function marketStall(c:C,label:string,accent:string,shade:string):void {
  oval(c,153,199,119,21,'#425e4924');
  for(const x of [47,246]){stroke(c,[[x,76],[x,195]],'#88664b',8);stroke(c,[[x-2,78],[x-2,188]],'#d4b181',2);}
  box(c,150,176,116,43,34,'#efd7ab','#bb966d','#a78058');
  for(let i=1;i<8;i++){const x=34+i*14.5;stroke(c,[[x,142+i*5.4],[x,174+i*5.4]],'#9e785337',1.5);}
  stroke(c,[[35,146],[150,190],[265,146]],'#ffe4b8',3);
  poly(c,[[20,65],[149,17],[280,65],[150,115]],'#fff0cc');
  // Parallel stripes stop at the diamond edges instead of crossing the silhouette.
  for(let i=0;i<8;i++){
    const t=i/8,u=(i+1)/8;
    poly(c,[[20+129*t,65-48*t],[20+129*u,65-48*u],[150+130*u,115-50*u],[150+130*t,115-50*t]],i%2?'#fff0cc':accent);
  }
  poly(c,[[20,65],[150,115],[150,126],[20,76]],shade);
  poly(c,[[150,115],[280,65],[280,76],[150,126]],accent);
  stroke(c,[[21,64],[149,16],[279,64]],'#fff5dc',2);
  for(let i=0;i<8;i++)oval(c,28+i*15.4,79+i*5.8,8,5,i%2?'#f6e5bf':accent);
  c.fillStyle='#6a4c3522';c.beginPath();c.roundRect(109,72,88,26,5);c.fill();
  c.fillStyle='#fff7df';c.beginPath();c.roundRect(106,68,88,26,5);c.fill();
  stroke(c,[[110,71],[190,71]],'#fffdf1',1);
  c.fillStyle='#5a6549';c.font='bold 13px "Microsoft YaHei", sans-serif';c.textAlign='center';c.fillText(label,150,86);
  for(const x of [113,187])oval(c,x,81,1.5,1.5,'#b79b6b');
  planter(c,39,190);
}
