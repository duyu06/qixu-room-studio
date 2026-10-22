export const MAX_GLB_BYTES=1024*1024;
export function validateGlbFile(file){
 if(!file||!file.name?.toLowerCase().endsWith('.glb'))return '请选择 GLB 文件';
 if(file.size<20||file.size>MAX_GLB_BYTES)return 'GLB 需在 20B–1MB 之间';
 return null;
}
export function decodeGlb(value){
 let bytes;
 if(typeof value==='string'){
  const m=value.match(/^data:(?:model\/gltf-binary|application\/octet-stream);base64,([A-Za-z0-9+/=]+)$/);
  if(!m)throw Error('无效 GLB 数据');
  bytes=Uint8Array.from(atob(m[1]),c=>c.charCodeAt(0));
 }else bytes=new Uint8Array(value);
 if(bytes.length<20||bytes.length>MAX_GLB_BYTES)throw Error('GLB 长度越界');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2)throw Error('仅支持 glTF 2.0 GLB');
 if(v.getUint32(8,true)!==bytes.length)throw Error('GLB 声明长度不匹配');
 if(v.getUint32(16,true)!==0x4e4f534a||v.getUint32(12,true)>bytes.length-20)throw Error('GLB JSON 块无效');
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
