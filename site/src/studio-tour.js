// Simple walkable-eye-height navigation collision for the edited geometry.
// Wall gaps are passable only where a genuine ground-level door opening exists.
// This is a preview collision model; not fire egress or accessibility compliance.
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function canWalkAt(doc,x,z,radius=.23){
 if(!doc||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<=0)return false;
 if(Math.abs(x)>doc.width/2-radius||Math.abs(z)>doc.depth/2-radius)return false;
 for(const f of doc.furniture){
   const a=f.rotation||0,c=Math.cos(a),s=Math.sin(a),dx=x-f.x,dz=z-f.z;
   const rx=dx*c+dz*s,rz=-dx*s+dz*c;
   if(Math.abs(rx)<f.width/2+radius&&Math.abs(rz)<f.depth/2+radius)return false;
 }
 for(const wall of doc.walls){
   const dx=wall.b[0]-wall.a[0],dz=wall.b[1]-wall.a[1],L=Math.hypot(dx,dz);
   if(L<.01)continue;
   const t=Math.max(0,Math.min(1,((x-wall.a[0])*dx+(z-wall.a[1])*dz)/(L*L)));
   const q=[wall.a[0]+dx*t,wall.a[1]+dz*t];
   if(dist(q,[x,z])>doc.thickness/2+radius)continue;
   const open=doc.openings.some(o=>o.wallId===wall.id&&o.kind==='door'&&o.sill===0&&o.height>=1.8&&
       Math.abs(t*L-o.t*L)<o.width/2-radius-.01);
   if(!open)return false;
 }
 return true;
}
export function findWalkStart(doc){
 const candidates=[[0,0]];
 for(let radius=0;radius<Math.max(doc.width,doc.depth)/2;radius+=.45){
   for(let i=0;i<24;i++){
     const a=i*Math.PI/12;candidates.push([Math.cos(a)*radius,Math.sin(a)*radius]);
   }
 }
 return candidates.find(p=>canWalkAt(doc,p[0],p[1]))||null;
}
