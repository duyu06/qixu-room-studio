import assert from 'node:assert/strict';
import {snapFurniture,alignFurniture,snapFurnitureToWalls,distributeFurniture} from '../site/src/studio-alignment.js';
const project={furniture:[
 {id:'a',x:1,z:1,width:1,depth:.6},
 {id:'b',x:3,z:3,width:1.5,depth:1},
 {id:'c',x:4,z:4,width:.8,depth:.8}
]};
let result=snapFurniture(project,'a',3.08,3.07);
assert.equal(result.x,3);assert.equal(result.z,3);
assert.equal(result.guides.length,2);
result=snapFurniture(project,'a',-1,-1);assert.equal(result.guides.length,0);
assert.equal(snapFurniture(project,'not-found',4,5).x,4);
const before=project.furniture[0].x;
alignFurniture(project,['a','b'],'x','center');
assert.equal(project.furniture[0].x,project.furniture[1].x);
assert.notEqual(project.furniture[0].x,before);
assert.throws(()=>alignFurniture(project,['a'],'x','center'),/两件/);
console.log('Furniture alignment and edge snap tests passed');

const wallDoc={thickness:.12,walls:[{id:'w1',a:[-3,-2],b:[-3,2]},{id:'w2',a:[-3,-2],b:[3,-2]}],furniture:[{id:'sofa',x:-2,z:0,width:1,depth:.8,rotation:0}]};
const horizontal=snapFurnitureToWalls(wallDoc,'sofa',-2.42,0);
assert.ok(Math.abs(horizontal.x-(-2.41))<.00001);
assert.equal(horizontal.guides[0].wallId,'w1');
const vertical=snapFurnitureToWalls(wallDoc,'sofa',0,-1.5);
assert.ok(Math.abs(vertical.z-(-1.51))<.00001);
assert.equal(vertical.guides[0].wallId,'w2');
assert.equal(snapFurnitureToWalls(wallDoc,'sofa',0,0).guides.length,0);

const equal={furniture:[{id:'a',x:0,z:0},{id:'b',x:7,z:1},{id:'c',x:2,z:2},{id:'d',x:9,z:3}]};
distributeFurniture(equal,['a','b','c','d'],'x');
assert.equal(equal.furniture.find(f=>f.id==='c').x,3);
assert.equal(equal.furniture.find(f=>f.id==='b').x,6);
assert.throws(()=>distributeFurniture(equal,['a','b'],'x'),/三件/);
