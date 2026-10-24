// Planar L/T junctions: endpoints that meet another wall endpoint or centerline.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function wallJunctions(doc,{tolerance=.018}={}){
 const walls=doc.walls||[],points=[];
 for(const w of walls)for(const side of ['a','b'])points.push([...w[side]]);
 const junctions=[];
 for(const point of points){
  if(junctions.some(j=>distance([j.x,j.z],point)<tolerance))continue;
  const joining=walls.filter(w=>{
   const dx=w.b[0]-w.a[0],dz=w.b[1]-w.a[1],d2=dx*dx+dz*dz;
   if(d2<1e-8)return false;
   const t=((point[0]-w.a[0])*dx+(point[1]-w.a[1])*dz)/d2;
   const projection=[w.a[0]+Math.max(0,Math.min(1,t))*dx,w.a[1]+Math.max(0,Math.min(1,t))*dz];
   return t>=-tolerance/Math.sqrt(d2)&&t<=1+tolerance/Math.sqrt(d2)&&distance(point,projection)<tolerance;
  });
  if(joining.length<2)continue;
  junctions.push({x:point[0],z:point[1],thickness:Math.max(...joining.map(w=>w.thickness??doc.thickness)),height:Math.min(...joining.map(w=>w.height??doc.wallHeight)),count:joining.length});
 }
 return junctions;
}
