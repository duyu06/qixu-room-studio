import assert from 'node:assert/strict';
import { BAGUA,FIVE_ELEMENTS,SHENG,KE,directionIndex,directionRecord,fieldVector,roomTips } from '../site/src/feng-model.js';
assert.equal(BAGUA.length,8);
assert.deepEqual(BAGUA.map(v=>v.direction),['北','东北','东','东南','南','西南','西','西北']);
assert.deepEqual(BAGUA.map(v=>v.trigram),['坎','艮','震','巽','离','坤','兑','乾']);
assert.deepEqual(FIVE_ELEMENTS.map(v=>v.name),['木','火','土','金','水']);
assert.equal(SHENG.length,5);assert.equal(KE.length,5);
for(const [a,b] of SHENG) assert(FIVE_ELEMENTS.some(v=>v.name===a)&&FIVE_ELEMENTS.some(v=>v.name===b));
for(const [a,b] of KE) assert(FIVE_ELEMENTS.some(v=>v.name===a)&&FIVE_ELEMENTS.some(v=>v.name===b));
assert.equal(directionIndex(0,-2,0),0);
assert.equal(directionIndex(2,0,0),2);
assert.equal(directionIndex(0,-2,180),4);
assert.equal(directionIndex(0,2,0),4);
assert.equal(directionRecord(0,0,0),null);
assert.equal(directionRecord(1,0,0)?.trigram,'震');
const room={width:5,depth:4,windowX:0};
const base=fieldVector(0,0,room);
assert(base.z<0);
for(const point of [[0,0],[2,0],[-2,1],[1,-1]]){
 const v=fieldVector(...point,room);assert(Math.abs(Math.hypot(v.x,v.z)-1)<1e-8);
}
const obstructed=fieldVector(.2,0,room,[{x:0,z:0,w:1,d:1}]);
assert(Math.abs(obstructed.x-base.x)>.1,'Furniture changes artistic flow path');
for(const kind of ['living','bedroom','study'])assert(roomTips[kind].length>=3);
console.log('PASS — 21+ cultural-direction, five-element, field, obstacle and room-knowledge validations.');
