import assert from 'node:assert/strict';
import {createProject,validateProject} from '../site/src/studio-model.js';
const d=createProject();d.walls[0].wallType='exterior';d.walls[0].thickness=.24;
d.walls[1].wallType='partition';d.walls[1].thickness=.1;
assert.equal(validateProject(d),null);
d.walls[1].wallType='invalid';assert.match(validateProject(d),/墙体类型/);
console.log('Wall types verified');
