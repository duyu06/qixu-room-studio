import * as THREE from 'three';
import {furnitureMaterial} from './studio-materials.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Procedural furniture is a lightweight, legitimately redistributable placeholder,
// deliberately separate from licensed catalog/brand-specific 3D products.
const mat=(color,roughness=.78,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function part(parent,w,h,d,x,y,z,color,r=.025){
 if(w<=0||h<=0||d<=0)return;
 const radius=Math.max(.001,Math.min(r,w/3,h/3,d/3));
 const fabric=['#789387','#69867b','#607d72','#9db2a5','#a4b9ae','#b6baad','#9cac9d','#f3ede2','#ffffff','#e2d9cc','#d9cab6','#f1e4cb'].includes(color);
 const metal=['#d8c69e'].includes(color);
 const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,radius),furnitureMaterial(color,metal?'metal':fabric?'fabric':'wood'));
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 return mesh;
}
function pot(parent,r,h,y,color){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.95,r,h,12),mat(color,.9));
 mesh.position.y=y+h/2;mesh.castShadow=true;parent.add(mesh);
}
export function createProceduralFurniture(item){
 const group=new THREE.Group(),w=item.width,d=item.depth,h=item.height;
 const wood='#a89073',light='#f3ede2',linen='#d8d4ca';
 const legs=(height,wInset,dInset,r=.06)=>{
  for(const x of [-w/2+wInset,w/2-wInset])
   for(const z of [-d/2+dInset,d/2-dInset])
    part(group,r,height,r,x,height/2+.02,z,wood,.008);
 };
 switch(item.type){
  case 'sofa':{
   part(group,w*.98,h*.38,d*.89,0,h*.40,0,'#789387',.10);
   part(group,w*.98,h*.57,d*.16,0,h*.68,-d*.39,'#69867b',.065);
   for(const x of [-w*.44,w*.44])part(group,w*.10,h*.52,d*.75,x,h*.53,0,'#607d72',.045);
   for(const x of [-w*.26,w*.26])
    part(group,w*.39,h*.17,d*.59,x,h*.55,d*.06,'#9db2a5',.07);
   for(const x of [-w*.25,w*.25])part(group,w*.32,h*.21,d*.14,x,h*.80,-d*.25,'#a4b9ae',.055);
   legs(h*.17,w*.15,d*.16,.055);
   break;
  }
  case 'bed':{
   part(group,w,h*.34,d,0,h*.23,0,wood,.055);
   part(group,w*.95,h*.27,d*.93,0,h*.44,.03,light,.09);
   part(group,w,h*.73,d*.10,0,h*.48,-d*.46,wood,.035);
   part(group,w*.89,h*.075,d*.42,0,h*.62,d*.24,'#b6baad',.045);
   for(const x of [-w*.24,w*.24])
    part(group,w*.38,h*.11,d*.17,x,h*.67,-d*.31,'#ffffff',.045);
   part(group,w*.92,h*.045,d*.29,0,h*.59,d*.25,'#e2d9cc',.035);
   break;
  }
  case 'table':{
   legs(h*.89,w*.16,d*.18,.08);
   part(group,w,h*.11,d,0,h*.94,0,'#d2b58e',.055);
   part(group,w*.91,h*.018,d*.88,0,h*.996,0,'#e2c69e',.01);break;
  }
  case 'chair':{
   legs(h*.53,w*.16,d*.16,.052);
   part(group,w*.94,h*.13,d*.92,0,h*.55,0,wood,.035);
   part(group,w*.9,h*.4,d*.12,0,h*.76,-d*.4,'#9cac9d',.04);break;
  }
  case 'cabinet':{
   part(group,w,h*.94,d,0,h*.51,0,'#b29b7f',.032);
   part(group,w*.47,h*.8,.02,-w*.24,h*.55,d*.501,'#c7ad8f',.015);
   part(group,w*.47,h*.8,.02,w*.24,h*.55,d*.501,'#bea084',.015);
   part(group,.025,.13,.022,-w*.06,h*.55,d*.53,'#d8c69e',.004);
   part(group,.025,.13,.022,w*.06,h*.55,d*.53,'#d8c69e',.004);
   part(group,w*.92,h*.035,d*.87,0,h*.97,0,'#dbcaaf',.012);
   part(group,w*.9,h*.08,d*.91,0,h*.065,0,'#786958',.012);
   break;
  }
  case 'desk':{
   legs(h*.86,w*.13,d*.17,.047);
   part(group,w,h*.10,d,0,h*.91,0,wood,.025);
   part(group,w*.31,h*.17,d*.63,w*.31,h*.73,0,'#c1a488',.018);
   break;
  }
  case 'plant':{
   pot(group,Math.min(w,d)*.3,h*.33,.025,'#b5b0a3');
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.016,.02,h*.35,6),mat('#69806b'));
   stem.position.y=h*.48;group.add(stem);
   for(let i=0;i<7;i++){
    const angle=i*2.3999,layer=i%3;
    const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(Math.min(w,d)*(.24+layer*.03),1),
      mat(['#557d61','#719a77','#8daa84'][layer],.97));
    leaf.position.set(Math.cos(angle)*w*.19,h*(.53+layer*.14),Math.sin(angle)*d*.19);
    leaf.scale.set(.8,1.1,.7);leaf.castShadow=true;group.add(leaf);
   }
   break;
  }
  case 'rug':{
   part(group,w,Math.max(h,.025),d,0,Math.max(h,.025)/2+.022,0,'#d9cab6',.012);
   part(group,w*.88,.007,d*.86,0,Math.max(h,.025)+.027,0,'#f1e4cb',.004);
   break;
  }
  default:part(group,w,h,d,0,h/2+.03,0,linen,.04);
 }
 return group;
}
