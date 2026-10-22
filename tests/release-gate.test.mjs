import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const site='site';
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const script=fs.readFileSync(path.join(site,'src/blueprint-addon.js'),'utf8');
assert.ok(html.includes('type="module" src="./src/main.js"'));
assert.ok(html.includes('theme-color'));
for (const asset of ['styles.css','feng-v3.css','v4.css','v7.css','v8.css',
  'src/main.js','src/blueprint-addon.js','src/image-integrity.js',
  'src/airflow-solver.js','src/ventilation-v8.js','src/solar-model.js','src/cfd-export.js']){
  assert.ok(fs.existsSync(path.join(site,asset)),asset+' missing');
}
assert.ok(fs.existsSync(path.join(site,'photoreal.html')));
assert.ok(script.includes('validateFloorplanFile'));
assert.ok(script.includes('删除本机保存'));
assert.ok(script.includes('recognizeKnownK4('));
assert.ok(!script.includes('const ref=img.width===474&&img.height===514'));
console.log('Commercial P0 static route, required assets, privacy and classifier gate passed');
