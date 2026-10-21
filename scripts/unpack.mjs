import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root=process.cwd();
const payload='.qixu-v4.br.b64';
if(!fs.existsSync(payload)) { console.log('No archive to restore'); process.exit(0); }
const packed=Buffer.from(fs.readFileSync(payload,'utf8').trim(),'base64');
const files=JSON.parse(zlib.brotliDecompressSync(packed).toString('utf8'));
for(const [name,content] of Object.entries(files)){
  if(name.startsWith('/')||name.split('/').includes('..')) throw new Error('Unsafe path '+name);
  const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content,'utf8');
}
fs.unlinkSync(payload);
fs.rmSync('scripts/unpack.mjs');
fs.rmSync('.github/workflows/bootstrap.yml');
console.log('Restored '+Object.keys(files).length+' source files');
