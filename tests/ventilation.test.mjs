import assert from 'node:assert/strict';
import { PressureFlow2D } from '../site/src/airflow-solver.js';

const base={w:8,d:6,crop:{left:0,top:0,right:800,bottom:600},
  walls:[],furniture:[],door:{x:3,z:0},window:{x:-3,z:0}};
const flow=new PressureFlow2D(base,60);
const left=flow.velocity(2.2,0);
assert.ok(left.x<-.05, 'Door high pressure must push air towards the low pressure window');
assert.equal(flow.blocked(0,0),false);
assert.equal(flow.velocity(100,100).speed,0);
assert.equal(flow.port[flow.id(flow.indexAt(3,0).i,flow.indexAt(3,0).j)],1,'Inlet must be marked');
const barrier=new PressureFlow2D({...base,walls:[[400,0,400,250],[400,350,400,600]]},60);
assert.equal(barrier.blocked(0,2),true,'Solid interior wall must block the solver');
assert.equal(barrier.blocked(0,0),false,'Door gap should stay open');
assert.equal(barrier.velocity(0,2).speed,0,'Air cannot flow inside the wall');
const target=barrier.trace(0,2,1);
assert.equal(target.blocked,true);
const obstruction=new PressureFlow2D({...base,furniture:[{x:0,z:0,dims:[1.5,1.1],angle:0}]},60);
assert.equal(obstruction.blocked(0,0),true,'Furniture must modify obstacle mask');
assert.ok(obstruction.velocity(1.5,0).speed>=0);
console.log('V8 pressure boundary, wall gap, solid/no-through, furniture tests OK');
