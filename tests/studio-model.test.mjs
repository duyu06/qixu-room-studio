import assert from 'node:assert/strict';
import {createProject,validateProject,addWall,addOpening,wallPieces,
 setOpeningDimension,deleteObject,addFurniture,importLegacy} from '../site/src/studio-model.js';
const d=createProject();
assert.equal(validateProject(d),null);
const center=d.walls[4];
const p=wallPieces(d,center);
assert.ok(p.some(x=>x.bottom>=2), 'Lintel should remain above door');
assert.ok(!p.some(x=>x.start<3.1&&x.end>3.7&&x.bottom===0&&x.top===2.8),
  'Do not fill the door with a solid full wall');
const wall=addWall(d,[-4,0],[-1,0]);
const open=addOpening(d,'window',wall.id,.5,1);
assert.equal(open.kind,'window');
assert.throws(()=>addOpening(d,'door',wall.id,.5,.9),/冲突/);
assert.throws(()=>setOpeningDimension(d,open,{height:2.5}),/边界/);
assert.equal(open.height,1.25);
const f=addFurniture(d,'sofa');assert.equal(f.type,'sofa');
assert.equal(deleteObject(d,f.id),true);
assert.equal(deleteObject(d,wall.id),true);
assert.ok(!d.openings.some(x=>x.id===open.id));
const old={plan:{w:10,d:8,crop:{left:0,right:500,top:0,bottom:400},
  walls:[[0,0,500,0]],furniture:[]},image:'data:image/jpeg;base64,aGVsbG8='};
const migrated=importLegacy(old);
assert.equal(migrated.walls[0].a[0],-5);
assert.equal(migrated.walls[0].b[0],5);
assert.equal(validateProject(migrated),null);
console.log('Professional studio wall openings, furniture and migration validated');
