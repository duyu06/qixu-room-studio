import assert from 'node:assert/strict';
import {calibrateFloorplan} from '../site/src/scale-calibration.js';
import {makeBlueprintPacket,validateBlueprintPacket} from '../site/src/blueprint-project.js';
const plan={w:8,d:6,crop:{left:0,right:800,top:0,bottom:600},walls:[[0,0,800,0]],
  furniture:[{x:2,z:1,dims:[1.2,.6,.8],angle:0}],
  ventilation:{door:{x:3,z:0},window:{x:-3,z:0}}};
const p=calibrateFloorplan(plan,[100,100],[500,100],8);
assert.equal(p.w,16);assert.equal(p.d,12);
assert.equal(p.furniture[0].x,4);assert.equal(p.furniture[0].z,2);
assert.deepEqual(p.furniture[0].dims,[1.2,.6,.8]);
assert.equal(p.ventilation.door.x,6);
assert.deepEqual(p.walls,plan.walls);
assert.equal(plan.w,8); // immutable operation
assert.equal(p.calibration.measuredByUser,true);
assert.equal(validateBlueprintPacket(makeBlueprintPacket(p,'data:image/jpeg;base64,aGVsbG8=')),null);
assert.throws(()=>calibrateFloorplan(plan,[100,100],[100,100],3));
assert.throws(()=>calibrateFloorplan(plan,[100,100],[900,100],3));
assert.throws(()=>calibrateFloorplan(plan,[100,100],[500,100],0));
assert.throws(()=>calibrateFloorplan(plan,[100,100],[500,100],1000));
console.log('Two-point measured scale and project round-trip tests passed');
