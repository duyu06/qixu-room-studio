import assert from 'node:assert/strict';
import {createProject} from '../site/src/studio-model.js';
import {cfdSurfaceStl} from '../site/src/studio-cfd-stl.js';
const doc=createProject();
const data=cfdSurfaceStl(doc);
const header=new DataView(data);
const triangles=header.getUint32(80,true);
assert.ok(triangles>12,'walls and openings should yield multiple mesh boxes');
assert.equal(data.byteLength,84+triangles*50);
const empty=createProject();empty.walls=[];empty.openings=[];empty.furniture=[];
assert.equal(new DataView(cfdSurfaceStl(empty)).getUint32(80,true),0);
doc.furniture.push({id:'f1',type:'table',x:0,z:0,width:1,depth:.6,height:.8,rotation:Math.PI/4});
assert.equal(new DataView(cfdSurfaceStl(doc)).getUint32(80,true),triangles+12);
const only=createProject();only.walls=[];only.openings=[];
only.furniture=[{id:'box',type:'table',x:0,z:0,width:2,depth:1,height:1,rotation:0}];
const mesh=new DataView(cfdSurfaceStl(only));
for(let t=0;t<mesh.getUint32(80,true);t++){
 const o=84+t*50;
 const n=[mesh.getFloat32(o,true),mesh.getFloat32(o+4,true),mesh.getFloat32(o+8,true)];
 const v=[mesh.getFloat32(o+12,true),mesh.getFloat32(o+16,true)-.5,mesh.getFloat32(o+20,true)];
 assert.ok(n.reduce((total,c,i)=>total+c*v[i],0)>0,'all faces point outside the solid');
}
console.log('CFD obstacle STL triangle counts and binary bounds passed');
