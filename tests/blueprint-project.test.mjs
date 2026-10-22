import assert from 'node:assert/strict';
import {makeBlueprintPacket,validateBlueprintPacket,MAX_PROJECT_FILE_BYTES} from '../site/src/blueprint-project.js';
const image='data:image/jpeg;base64,aGVsbG8=';
const plan={w:7,d:6,crop:{left:0,right:800,top:0,bottom:600},
  walls:[[0,0,800,0]],furniture:[{x:0,z:0,dims:[1.2,.6,.8],angle:0}]};
const packet=makeBlueprintPacket(plan,image);
assert.equal(validateBlueprintPacket(packet),null);
assert.equal(validateBlueprintPacket(JSON.parse(JSON.stringify(packet))),null);
assert.ok(MAX_PROJECT_FILE_BYTES>=12*1024*1024);
assert.ok(validateBlueprintPacket({...packet,image:'https://evil.example/plan.jpg'}));
assert.ok(validateBlueprintPacket({...packet,plan:{...plan,w:Infinity}}));
assert.ok(validateBlueprintPacket({...packet,plan:{...plan,furniture:[{x:Infinity,z:0,dims:[1,1,1]}]}}));
assert.ok(validateBlueprintPacket({...packet,plan:{...plan,walls:[[1,2,Number.NaN,3]]}}));
console.log('Full floorplan project export/import data contract passes');
