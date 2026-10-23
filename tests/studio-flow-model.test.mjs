import assert from 'node:assert/strict';
import {evaluateVentilation} from '../site/src/studio-flow-model.js';
const w={id:'w',a:[0,-2],b:[0,2]};
const d={width:8,depth:6,wallHeight:2.8,walls:[w],furniture:[],openings:[
 {id:'a',kind:'door',wallId:'w',t:.3,width:1,height:2},
 {id:'b',kind:'window',wallId:'w',t:.7,width:1,height:1.5}]};
const base=evaluateVentilation(d,{pressurePa:5});
assert.equal(base.available,true);
assert.ok(base.flowM3s>0);
assert.equal(evaluateVentilation(d,{pressurePa:0}).flowM3s,0);
assert.equal(evaluateVentilation(d,{pressurePa:5,openings:{a:0}}).available,false);
const less=evaluateVentilation(d,{pressurePa:5,openings:{a:.5}});
assert.ok(less.available&&less.flowM3s<base.flowM3s);
assert.ok(evaluateVentilation(d,{pressurePa:20}).flowM3s>base.flowM3s);
assert.match(base.note,/未求解/);
console.log('Reduced-order ventilation boundary test passed');
