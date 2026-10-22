// Qixu Studio P2: planar wall graph, enclosed rooms and collision diagnostics.
// Geometry is 2D metric; not a certified architectural CAD/structural solver.
const EPS=1e-6;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const signedArea=p=>p.reduce((a,v,i)=>a+cross(v,p[(i+1)%p.length]),0)/2;
function intersections(a,b,c,d){
  const r=sub(b,a),s=sub(d,c),det=cross(r,s);
  if(Math.abs(det)<EPS)return [];
  const t=cross(sub(c,a),s)/det,u=cross(sub(c,a),r)/det;
  if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS)return [[Math.max(0,Math.min(1,t)),Math.max(0,Math.min(1,u))]];
  return [];
}
function pointOnSegment(p,a,b){
  const dir=sub(b,a),sq=dot(dir,dir);
  if(sq<EPS)return null;
  const t=dot(sub(p,a),dir)/sq;
  if(t< -EPS||t>1+EPS||dist(p,lerp(a,b,Math.max(0,Math.min(1,t))))>0.002)return null;
  return Math.max(0,Math.min(1,t));
}
export function calculateRooms(walls){
  if(!Array.isArray(walls)||walls.length>450)return [];
  const valid=walls.filter(w=>w.a&&w.b&&dist(w.a,w.b)>.01);
  if(valid.length<3)return [];
  const stops=valid.map(()=>[0,1]);
  for(let i=0;i<valid.length;i++){
    for(let j=i+1;j<valid.length;j++){
      const a=valid[i],b=valid[j];
      for(const [t,u]of intersections(a.a,a.b,b.a,b.b)){stops[i].push(t);stops[j].push(u);}
      for(const p of [b.a,b.b]){const t=pointOnSegment(p,a.a,a.b);if(t!==null)stops[i].push(t);}
      for(const p of [a.a,a.b]){const t=pointOnSegment(p,b.a,b.b);if(t!==null)stops[j].push(t);}
    }
  }
  const verts=new Map(),edges=new Map();
  const id=p=>{const key=p.map(x=>Math.round(x*10000)).join(':');if(!verts.has(key))verts.set(key,{p:[...p],near:new Set()});return key;};
  for(let i=0;i<valid.length;i++){
    const w=valid[i],ts=[...new Set(stops[i].map(t=>Math.round(t*1e6)/1e6))].sort((a,b)=>a-b);
    for(let j=0;j<ts.length-1;j++){
      const a=lerp(w.a,w.b,ts[j]),b=lerp(w.a,w.b,ts[j+1]);
      if(dist(a,b)<.008)continue;
      const u=id(a),v=id(b);
      if(u===v)continue;
      const edge=[u,v].sort().join('|');if(edges.has(edge))continue;
      edges.set(edge,1);verts.get(u).near.add(v);verts.get(v).near.add(u);
    }
  }
  const neighbors=new Map();
  for(const [key,v]of verts)neighbors.set(key,[...v.near].sort((a,b)=>{
    const p=verts.get(a).p,q=verts.get(b).p;
    return Math.atan2(p[1]-v.p[1],p[0]-v.p[0])-
           Math.atan2(q[1]-v.p[1],q[0]-v.p[0]);
  }));
  const visited=new Set(),faces=[],limit=edges.size*2+4;
  for(const [u,v]of edges.values().length?[]:[]){/* no-op: face start below */}
  for(const [start,v]of verts)for(const next of neighbors.get(start)){
    const first=start+'>'+next;if(visited.has(first))continue;
    let a=start,b=next,ring=[],closed=false;
    for(let steps=0;steps<limit;steps++){
      const code=a+'>'+b;if(visited.has(code))break;
      visited.add(code);ring.push(verts.get(a).p);
      const around=neighbors.get(b),index=around.indexOf(a);
      if(index<0)break;
      const n=around[(index-1+around.length)%around.length];
      a=b;b=n;
      if(a===start&&b===next){closed=true;break;}
    }
    if(!closed||ring.length<3)continue;
    const area=signedArea(ring);
    if(area<=.05)continue; // negative is exterior face
    let cx=0,cy=0;
    for(let i=0;i<ring.length;i++){
      const p=ring[i],q=ring[(i+1)%ring.length],factor=cross(p,q);
      cx+=(p[0]+q[0])*factor;cy+=(p[1]+q[1])*factor;
    }
    const centroid=[cx/(6*area),cy/(6*area)];
    faces.push({id:'room-'+faces.length,polygon:ring,area:Number(area.toFixed(3)),centroid,
      label:'空间 '+(faces.length+1)});
  }
  return faces.sort((a,b)=>b.area-a.area);
}
export function pointInPolygon(p,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>p[1])!==(b[1]>p[1]) &&
       p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
const rotatedCorners=f=>{
  const hx=f.width/2,hz=f.depth/2,c=Math.cos(f.rotation||0),s=Math.sin(f.rotation||0);
  return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]]
    .map(([x,z])=>[f.x+x*c-z*s,f.z+x*s+z*c]);
};
function satOverlap(a,b){
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
    const d=sub(polygon[(i+1)%polygon.length],polygon[i]),axis=[-d[1],d[0]];
    const proj=p=>dot(p,axis),as=a.map(proj),bs=b.map(proj);
    if(Math.max(...as)<=Math.min(...bs)+EPS||Math.max(...bs)<=Math.min(...as)+EPS)return false;
  }
  return true;
}
function distancePointToSegment(p,a,b){
  const v=sub(b,a),sq=dot(v,v);if(sq<EPS)return dist(p,a);
  const t=Math.max(0,Math.min(1,dot(sub(p,a),v)/sq));return dist(p,lerp(a,b,t));
}
export function furnitureDiagnostics(doc){
  const errors=[],furn=doc.furniture||[];
  for(let i=0;i<furn.length;i++){
    const f=furn[i],corners=rotatedCorners(f);
    if(corners.some(p=>Math.abs(p[0])>doc.width/2+EPS||Math.abs(p[1])>doc.depth/2+EPS))
      errors.push({type:'boundary',id:f.id,reason:'家具超出画布尺寸'});
    for(let j=0;j<i;j++)if(satOverlap(corners,rotatedCorners(furn[j])))
      errors.push({type:'overlap',id:f.id,other:furn[j].id,reason:'家具与另一件家具重叠'});
    for(const w of doc.walls||[]){
      const thick=doc.thickness/2;
      if(corners.some((p,k)=>distancePointToSegment(p,w.a,w.b)<thick-.004) ||
         [w.a,w.b].some(p=>pointInPolygon(p,corners)) ||
         corners.some((p,k)=>{
           const q=corners[(k+1)%4];
           return intersections(p,q,w.a,w.b).length>0;
         }))errors.push({type:'wall',id:f.id,wallId:w.id,reason:'家具与墙体相交'});
    }
  }
  return errors;
}
export function materialTakeoff(doc){
  const rooms=calculateRooms(doc.walls),gross=(doc.walls||[]).reduce((n,w)=>n+dist(w.a,w.b)*doc.wallHeight,0);
  const openings=(doc.openings||[]).reduce((n,o)=>n+o.width*o.height,0);
  const area=Math.max(0,gross-openings);
  const counts={};for(const f of doc.furniture||[])counts[f.type]=(counts[f.type]||0)+1;
  return {rooms,totalFloorAreaM2:Number(rooms.reduce((n,r)=>n+r.area,0).toFixed(2)),
    grossWallAreaM2:Number(gross.toFixed(2)),openingAreaM2:Number(openings.toFixed(2)),
    netWallAreaM2:Number(area.toFixed(2)),wallLengthM:Number((doc.walls||[]).reduce((n,w)=>n+dist(w.a,w.b),0).toFixed(2)),
    wallThicknessM:doc.thickness,furnitureCounts:counts,estimated:true};
}
export function suggestLayout(doc,types=['sofa','table','bed']){
  const catalog={sofa:[2.2,.88,.8],bed:[1.8,2,.6],table:[1.45,.9,.76],
    chair:[.52,.54,.84],desk:[1.25,.6,.75]};
  const result=[],rooms=calculateRooms(doc.walls).filter(r=>r.area>4).sort((a,b)=>b.area-a.area);
  for(const type of types){
    if(!catalog[type]||!rooms.length)continue;
    const [width,depth,height]=catalog[type];
    let found=null;
    for(const room of rooms){
      const center=room.centroid;
      for(let ring=0;ring<6&&!found;ring++)for(let i=0;i<16&&!found;i++){
        const a=i*Math.PI/8,r=ring*.45;
        const x=Math.round((center[0]+Math.cos(a)*r)*10)/10;
        const z=Math.round((center[1]+Math.sin(a)*r)*10)/10;
        const candidate={id:'suggested-'+type,x,z,width,depth,height,rotation:0,type};
        if(rotatedCorners(candidate).every(p=>pointInPolygon(p,room.polygon)) &&
           !furnitureDiagnostics({...doc,furniture:[...doc.furniture,...result,candidate]})
             .some(issue=>issue.id===candidate.id)){found=candidate;}
      }
      if(found)break;
    }
    if(found)result.push(found);
  }
  return result;
}
