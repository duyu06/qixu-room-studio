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

for(const page of ['index.html','photoreal.html']){
  const contents=fs.readFileSync(path.join(site,page),'utf8');
  assert.ok(contents.includes('./vendor/three/build/three.module.js'),page+' must use same-origin 3D runtime');
  assert.ok(!contents.includes('cdn.jsdelivr.net'),page+' must not require JS CDN');
  assert.ok(!contents.includes('esm.sh'),page+' must not require runtime transpilation CDN');
}
const v8=fs.readFileSync(path.join(site,'src/ventilation-v8.js'),'utf8');
assert.ok(v8.includes("../vendor/suncalc.js"));
for (const asset of ['vendor/three/build/three.core.js','vendor/three/build/three.module.js',
  'vendor/three/build/three.webgpu.js','vendor/three/build/three.tsl.js',
  'vendor/three/addons/controls/OrbitControls.js','vendor/pathtracer.js','vendor/suncalc.js']){
  assert.ok(fs.existsSync(path.join(site,asset)),asset+' missing');
}
console.log('Same-origin immutable Three.js / SunCalc / pathtracer assets verified');
