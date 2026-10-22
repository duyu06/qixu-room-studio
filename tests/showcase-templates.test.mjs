import assert from 'node:assert/strict';
import {SHOWCASE_TEMPLATES,makeShowcaseTemplate} from '../site/src/showcase-templates.js';
import {validateProject,wallPieces} from '../site/src/studio-model.js';
import {materialTakeoff} from '../site/src/studio-geometry.js';
assert.equal(SHOWCASE_TEMPLATES.length,3);
for(const item of SHOWCASE_TEMPLATES){
 const project=makeShowcaseTemplate(item.slug);
 assert.equal(validateProject(project),null);
 assert.ok(project.walls.length>=5);
 assert.ok(project.openings.some(o=>o.kind==='door'));
 assert.ok(project.openings.some(o=>o.kind==='window'));
 assert.ok(project.furniture.length>=7);
 assert.ok(project.openings.every(o=>project.walls.some(w=>w.id===o.wallId)));
 for(const w of project.walls)assert.ok(wallPieces(project,w).length>0);
 const metrics=materialTakeoff(project);
 assert.ok(metrics.totalFloorAreaM2>0);
 const restored=JSON.parse(JSON.stringify(project));
 assert.equal(validateProject(restored),null);
}
assert.throws(()=>makeShowcaseTemplate('nonexistent'),/未知/);
console.log('Investor demo templates: furniture, wall openings and data integrity pass');
