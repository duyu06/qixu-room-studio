import * as THREE from 'three';
// Deterministic local textures: no external network dependencies or license uncertainty.
function patterned(kind){
 const c=document.createElement('canvas');c.width=c.height=256;
 const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,256,256);
 if(kind==='wood'){
   x.fillStyle='#d9bd96';x.fillRect(0,0,256,256);
   for(let i=0;i<90;i++){
     const p=(i*71)%256;x.strokeStyle='rgba(94,65,35,.15)';
     x.lineWidth=i%7===0?2:1;x.beginPath();x.moveTo(p,0);
     x.bezierCurveTo(p+5,80,p-4,170,p+2,256);x.stroke();
   }
 }else if(kind==='tile'){
   x.fillStyle='#e6e2da';x.fillRect(0,0,256,256);
   x.strokeStyle='#c4bfb6';x.lineWidth=5;
   for(let i=0;i<=256;i+=128){x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();
    x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke();}
 }else{
   x.fillStyle='#cfcfcb';x.fillRect(0,0,256,256);
   for(let i=0;i<45;i++){
    x.strokeStyle=i%3===0?'rgba(85,83,78,.20)':'rgba(255,255,255,.3)';
    x.lineWidth=i%5===0?2:1;x.beginPath();
    const y=(i*59)%256;x.moveTo(-20,y);
    x.bezierCurveTo(90,y+12,170,y-17,276,y+3);x.stroke();
   }
 }
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(3,3);t.anisotropy=4;
 return t;
}
export function floorMaterial(color,kind='auto'){
 const selected=kind==='auto'?(['#ded4c3','#bda58a'].includes(String(color).toLowerCase())?'wood':'stone'):kind;
 const texture=patterned(selected);
 return new THREE.MeshStandardMaterial({map:texture,color:selected==='wood'?0xffffff:color,
   roughness:selected==='stone'?.7:selected==='tile'?.52:.8,metalness:0});
}
export function wallMaterial(color,kind='paint'){
 const mat=new THREE.MeshStandardMaterial({color,roughness:kind==='plaster'?.98:kind==='wallpaper'?.88:.94,metalness:0});
 if(kind==='wallpaper'||kind==='plaster'){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  x.fillStyle='#ffffff';x.fillRect(0,0,128,128);
  for(let i=0;i<240;i++){
   const px=(i*47)%128,py=(i*83)%128;
   x.fillStyle=kind==='wallpaper'?'rgba(85,87,70,.045)':'rgba(100,95,85,.065)';
   x.fillRect(px,py,kind==='wallpaper'?2:1,kind==='wallpaper'?8:2);
  }
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(3,2);tex.colorSpace=THREE.SRGBColorSpace;
  mat.map=tex;
 }
 return mat;
}
export function furnitureMaterial(color,kind='wood'){
 const roughness={fabric:.96,wood:.65,metal:.3,glass:.12,stone:.55}[kind]??.8;
 return new THREE.MeshStandardMaterial({color,roughness,metalness:kind==='metal'?.72:0});
}
