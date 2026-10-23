import * as THREE from 'three';
// Deterministic local textures: no external network dependencies or license uncertainty.
function patterned(kind){
 const c=document.createElement('canvas');c.width=c.height=256;
 const x=c.getContext('2d');x.fillStyle=kind==='wood'?'#d9bd96':'#e6e3d9';x.fillRect(0,0,256,256);
 for(let i=0;i<90;i++){
   const p=(i*71)%256;
   x.strokeStyle=kind==='wood'?'rgba(94,65,35,.10)':'rgba(90,90,80,.045)';
   x.lineWidth=i%7===0?2:1;x.beginPath();
   if(kind==='wood'){x.moveTo(p,0);x.bezierCurveTo(p+5,80,p-4,170,p+2,256);}
   else{x.moveTo(0,p);x.lineTo(256,p);}
   x.stroke();
 }
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(kind==='wood'?3:2,kind==='wood'?3:2);
 return t;
}
export function floorMaterial(color){
 const wood=['#ded4c3','#bda58a'].includes(String(color).toLowerCase());
 const m=new THREE.MeshStandardMaterial({color,roughness:wood?.78:.88,metalness:0});
 if(wood){m.map=patterned('wood');m.color.set('#ffffff');}return m;
}
export function wallMaterial(color){return new THREE.MeshStandardMaterial({color,roughness:.94,metalness:0});}
export function furnitureMaterial(color,kind='wood'){
 const roughness={fabric:.96,wood:.65,metal:.3,glass:.12,stone:.55}[kind]??.8;
 return new THREE.MeshStandardMaterial({color,roughness,metalness:kind==='metal'?.72:0});
}
