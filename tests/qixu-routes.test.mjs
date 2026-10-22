import assert from 'node:assert/strict';
import {PAGES,PERSONAL_PROJECT_KEY,LEGACY_PROJECT_KEY,demoId,projectStorageKey,
  renderLink,studioLink} from '../site/src/qixu-routes.js';
assert.equal(PAGES.length,4);
assert.equal(new Set(PAGES.map(p=>p.key)).size,4);
assert.equal(projectStorageKey(null),PERSONAL_PROJECT_KEY);
assert.equal(projectStorageKey('sunlit'),'qixu-studio-demo-sunlit-v1');
assert.equal(projectStorageKey('arbitrary'),PERSONAL_PROJECT_KEY);
assert.equal(renderLink('compact'),'./photoreal.html?template=compact');
assert.equal(renderLink('../bad'),'./photoreal.html');
assert.equal(studioLink('family'),'./studio.html?template=family&view=3d');
assert.equal(studioLink(undefined),'./studio.html');
assert.equal(demoId('compact'),'compact');
assert.equal(demoId('broken'),null);
assert.equal(LEGACY_PROJECT_KEY,'qixu-blueprint-v6');
console.log('Unified Qixu navigation and data keys validated');
