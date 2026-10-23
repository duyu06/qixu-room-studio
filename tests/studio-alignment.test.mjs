import assert from 'node:assert/strict';
import {snapFurniture,alignFurniture} from '../site/src/studio-alignment.js';
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
