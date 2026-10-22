import { cpSync, mkdirSync, readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

// Build at CI time only. Committed output is self-contained and served by Render's
// existing staticPublishPath=site configuration, no Render dashboard changes.
const dest='site/vendor';
mkdirSync(dest,{recursive:true});
mkdirSync(join(dest,'three/build'),{recursive:true});
mkdirSync(join(dest,'three/addons/controls'),{recursive:true});
const srcBuild='node_modules/three/build';
for(const name of readdirSync(srcBuild).filter(x=>x.endsWith('.js'))){
  cpSync(join(srcBuild,name),join(dest,'three/build',name));
}
cpSync('node_modules/three/examples/jsm/controls/OrbitControls.js',join(dest,'three/addons/controls/OrbitControls.js'));
await build({
  entryPoints:['tools/pathtracer-entry.js'],bundle:true,platform:'browser',format:'esm',
  target:'es2022',outfile:join(dest,'pathtracer.js'),minify:true,
  external:['three','three/*'],
  legalComments:'eof'
});
await build({
  entryPoints:['suncalc'],bundle:true,platform:'browser',
  format:'esm',target:'es2022',outfile:join(dest,'suncalc.js'),minify:true,
  legalComments:'eof'
});
for(const lib of ['three','three-gpu-pathtracer','suncalc']){
  const dir=join('node_modules',lib);
  const names=['LICENSE','LICENSE.md','LICENSE.txt'];
  const path=names.map(n=>join(dir,n)).find(existsSync);
  if(path){mkdirSync(join(dest,'licenses'),{recursive:true});
    cpSync(path,join(dest,'licenses',lib+'.txt'));}
}
writeFileSync(join(dest,'VERSIONS.json'),JSON.stringify({
  three:'0.186.1',suncalc:'2.1.1',pathtracer:'0.0.27',
  note:'Generated from locked npm dependency graph. Review licenses before redistribution.'
},null,2)+'\n');
console.log('Same-origin Three.js assets created:',readdirSync(dest));
