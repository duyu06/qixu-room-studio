import assert from 'node:assert/strict';
import {connectedLayout, partitionSections, clampToArea, inferArea} from '../site/src/connected-layout.js';
for (const width of [3,4.8,8]) for (const depth of [2.5,4.2,7]) {
  const plan=connectedLayout(width,depth);
  const {study,living,bedroom}=plan.areas;
  assert.equal(study.maxX,living.minX);
  assert.equal(living.maxX,bedroom.minX);
  assert.equal(plan.totalWidth,plan.maxX-plan.minX);
  assert(plan.doorway.width>0&&plan.doorway.height>1.8);
  const segments=partitionSections(depth,plan.doorway);
  assert.equal(segments.length,2);
  assert(Math.abs(segments[1].from-segments[0].to-plan.doorway.width)<1e-10);
  for(const area of Object.values(plan.areas)){
    const p=clampToArea(area,area.minX-100,99,.3,.25);
    assert(p.x>=area.minX+.3&&p.x<=area.maxX-.3);
    assert(p.z<=depth/2-.25);
    assert.equal(inferArea(plan,area.centerX),area.id);
  }
}
console.log('PASS — adjacent rooms share partitions; continuous footprint and accessible door gaps');
