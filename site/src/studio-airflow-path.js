// 2D route visualisation around wall segments; not a fluid dynamics solver.
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function blocked(a,b,wall,openings,clearance=.04){
 const ax=wall.a[0],ay=wall.a[1],rx=wall.b[0]-ax,ry=wall.b[1]-ay;
 const sx=b[0]-a[0],sy=b[1]-a[1],den=rx*sy-ry*sx;
 if(Math.abs(den)<1e-9)return false;
 const qx=a[0]-ax,qy=a[1]-ay;
 const t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
 if(t<0||t>1||u<0||u>1)return false;
 return !openings.some(o=>o.wallId===wall.id&&Math.abs(t-o.t)*Math.hypot(rx,ry)<o.width/2-clearance);
}
export function airflowRoute(doc,{spacing=.32}={}){
 const openings=doc.openings.filter(o=>['door','window'].includes(o.kind)&&doc.walls.some(w=>w.id===o.wallId));
 if(openings.length<2)return null;
 const position=o=>{const w=doc.walls.find(w=>w.id===o.wallId);return [w.a[0]+(w.b[0]-w.a[0])*o.t,w.a[1]+(w.b[1]-w.a[1])*o.t];};
 const start=position(openings[0]),goal=position(openings.at(-1));
 const cols=Math.ceil(doc.width/spacing)+1,rows=Math.ceil(doc.depth/spacing)+1;
 if(cols*rows>25000)return null;
 const point=(x,y)=>[-doc.width/2+x*doc.width/(cols-1),-doc.depth/2+y*doc.depth/(rows-1)];
 const closest=p=>[Math.max(0,Math.min(cols-1,Math.round((p[0]+doc.width/2)*(cols-1)/doc.width))),
  Math.max(0,Math.min(rows-1,Math.round((p[1]+doc.depth/2)*(rows-1)/doc.depth)))];
 const a=closest(start),b=closest(goal),key=(x,y)=>y*cols+x;
 const startId=key(...a),goalId=key(...b),parent=new Int32Array(cols*rows).fill(-1),queue=new Int32Array(cols*rows);
 let head=0,tail=1;queue[0]=startId;parent[startId]=startId;
 const directions=[[1,0],[-1,0],[0,1],[0,-1]];
 while(head<tail){
  const id=queue[head++];if(id===goalId)break;
  const x=id%cols,y=Math.floor(id/cols),p=point(x,y);
  for(const [dx,dy] of directions){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
   const nid=key(nx,ny);if(parent[nid]!==-1)continue;
   const q=point(nx,ny);
   if(doc.walls.some(w=>blocked(p,q,w,openings)))continue;
   parent[nid]=id;queue[tail++]=nid;
  }
 }
 if(parent[goalId]===-1)return null;
 const route=[];for(let id=goalId;id!==startId;id=parent[id])route.push(point(id%cols,Math.floor(id/cols)));
 route.push(point(...a));route.reverse();route[0]=start;route[route.length-1]=goal;
 const simplified=[route[0]];
 for(let i=1;i<route.length-1;i++){
  const p=route[i-1],q=route[i],r=route[i+1];
  if(Math.abs((q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]))>1e-5)simplified.push(q);
 }
 simplified.push(goal);
 return simplified;
}
