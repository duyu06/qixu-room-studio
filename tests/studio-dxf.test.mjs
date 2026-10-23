import assert from 'node:assert/strict';
import {parseDxf,exportDxf} from '../site/src/studio-dxf.js';
const source=[
'0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC',
'0','SECTION','2','ENTITIES',
'0','LINE','8','WALLS','10','0','20','0','11','5000','21','0',
'0','LWPOLYLINE','90','4','70','1','10','0','20','0',
'10','5000','20','0','10','5000','20','3000','10','0','20','3000',
'0','ENDSEC','0','EOF'].join('\n');
const {project,units}=parseDxf(source);
assert.equal(units,'mm');assert.equal(project.schema,'qixu-studio');
assert.ok(project.walls.length>=5);
assert.ok(Math.abs(project.walls[0].b[0]-project.walls[0].a[0])===5);
const round=exportDxf(project);
const restored=parseDxf(round);
assert.equal(restored.units,'m');
assert.equal(restored.project.walls.length,project.walls.length);
assert.throws(()=>parseDxf(source.replace('$INSUNITS','$UNKNOWN')),/单位/);
assert.throws(()=>parseDxf('0\nEOF','m'),/没有找到/);
const bulge=source.replace(['10','0','20','0','10','5000'].join('\n'),['10','0','20','0','42','0.5','10','5000'].join('\n'));
const curved=parseDxf(bulge);
assert.ok(curved.project.walls.length>project.walls.length,'bulged polyline must be tessellated');
assert.equal(curved.project.walls[0].layer,'WALLS');
console.log('DXF import/export meters, units, arc tessellation and layers passed');

const onlyWalls=parseDxf(source,'auto',{layers:['WALLS']});
assert.deepEqual(onlyWalls.layers.sort(),['0','WALLS']);
assert.equal(onlyWalls.project.walls.length,1,'selected CAD layer must exclude unrelated polylines');
assert.throws(()=>parseDxf(source,'auto',{layers:['NOT_FOUND']}),/没有找到/);
