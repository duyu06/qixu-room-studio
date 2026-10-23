// Binary STL solids for OpenFOAM snappyHexMesh preparation.
// Wall segments are generated from actual door/window-cut wall pieces.
import {wallPieces} from './studio-model.js';
const faces=[[0,2,3],[0,3,1],[4,5,7],[4,7,6],[0,4,6],[0,6,2],
 [1,3,7],[1,7,5],[0,1,5],[0,5,4],[2,6,7],[2,7,3]];
function box(vertices,center,dims,yaw){
 const [cx,cy,cz]=center,[wx,hy,dz]=dims,c=Math.cos(yaw),s=Math.sin(yaw);
 if(![...center,...dims,yaw].every(Number.isFinite)||Math.min(...dims)<=0)throw Error('障碍物尺寸无效');
 const pts=[];
 for(const x of [-wx/2,wx/2])for(const y of [-hy/2,hy/2])for(const z of [-dz/2,dz/2])
  pts.push([cx+x*c+z*s,cy+y,cz-x*s+z*c]);
 // Outward-facing solid normals are required for robust mesh classification.
 for(const f of faces)vertices.push(pts[f[0]],pts[f[2]],pts[f[1]]);
}
export function cfdSurfaceStl(doc){
 const triangles=[];
 for(const wall of doc.walls){
  const dx=wall.b[0]-wall.a[0],dz=wall.b[1]-wall.a[1],len=Math.hypot(dx,dz);
  if(len<.2)continue;
  const yaw=-Math.atan2(dz,dx);
  const cos=Math.cos(yaw),sin=Math.sin(yaw);
  for(const p of wallPieces(doc,wall)){
   const local=(p.start+p.end)/2;
   const cx=wall.a[0]+local*cos,cz=wall.a[1]-local*sin;
   box(triangles,[cx,(p.bottom+p.top)/2,cz],[p.end-p.start,p.top-p.bottom,doc.thickness],yaw);
  }
 }
 for(const f of doc.furniture){
  if(f.type==='rug'||f.height<.1)continue;
  box(triangles,[f.x,f.height/2,f.z],[f.width,f.height,f.depth],-f.rotation);
 }
 const count=triangles.length/3;if(count>100000)throw Error('STL 几何过于复杂');
 const output=new ArrayBuffer(84+count*50),view=new DataView(output);
 const header=new TextEncoder().encode('Qixu Studio approximate walls and furniture solid STL; meters');
 new Uint8Array(output).set(header.slice(0,80));
 view.setUint32(80,count,true);let offset=84;
 for(let i=0;i<triangles.length;i+=3){
  const a=triangles[i],b=triangles[i+1],c=triangles[i+2];
  const u=b.map((x,k)=>x-a[k]),v=c.map((x,k)=>x-a[k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const mag=Math.hypot(...n)||1;
  for(const val of [...n.map(x=>x/mag),...a,...b,...c]){view.setFloat32(offset,val,true);offset+=4;}
  view.setUint16(offset,0,true);offset+=2;
 }
 return output;
}
