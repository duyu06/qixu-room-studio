import {cpSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const source='node_modules/web-ifc',dest='site/vendor/ifc';
mkdirSync(dest,{recursive:true});
for(const filename of ['web-ifc-api.js','web-ifc.wasm']){
 const sourceFile=join(source,filename);
 if(!existsSync(sourceFile))throw Error('Missing web-ifc distribution: '+sourceFile);
 cpSync(sourceFile,join(dest,filename));
}
const lic=['LICENSE.md','LICENSE'].map(f=>join(source,f)).find(existsSync);
if(lic)cpSync(lic,join(dest,'LICENSE.txt'));
writeFileSync(join(dest,'VERSION.txt'),'web-ifc@0.0.78\n');
console.log('Vendored self-hosted web-ifc ESM and WASM.');
