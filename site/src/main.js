import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BAGUA, FIVE_ELEMENTS, SHENG, KE, roomTips, fieldVector, directionRecord } from './feng-model.js';
import { findWalkway, calculateClearanceRatio } from './space-model.js';
import { HistoryJournal } from './history-model.js';

// 栖序 Space Atelier — all geometry is procedural; no remote furniture assets or AI key required.
// One photograph is NOT enough for a metrically accurate room scan. Upload builds an editable
// reference scene using extracted colors and a photo projection, not real photogrammetry.

const $ = (id) => document.getElementById(id);
const initial = { width: 4.8, depth: 4.2, height: 2.8, wall: '#eee8dd', floor: 'wood', room: 'living', light: 'day', north: 180, sunHour:12, daylight:85, lampPower:65, lightKelvin:3200, windowWidth:1.6, windowPosition:-20 };
const state = { ...initial, items: [], selected: null, overlays: false, grid: false, unfolded: false, photoMapped: false, hasPhoto: false, fengTab: 'practical', layoutIteration: 0, sunOverlay: true, snap: true, sunlightCoverage: 0, flowVisible: true, flowHeat: false, flowSpeed:100, flowDensity:180, flowMode:'qi', chosenBagua:0, chosenElement:'木', routeVisible:true };
const catalog = [
  {type:'sofa', name:'双人沙发', icon:'▱', w:2.1, d:0.88},
  {type:'table', name:'茶几', icon:'▤', w:1.25, d:0.68},
  {type:'bed', name:'双人床', icon:'▥', w:1.9, d:2.25},
  {type:'desk', name:'书桌', icon:'▣', w:1.45, d:0.7},
  {type:'chair', name:'单椅', icon:'♧', w:0.65, d:0.66},
  {type:'plant', name:'绿植', icon:'♣', w:0.48, d:0.48},
  {type:'lamp', name:'落地灯', icon:'♧', w:0.36, d:0.36},
  {type:'rug', name:'地毯', icon:'▦', w:2.0, d:1.5},
  {type:'cabinet', name:'收纳柜', icon:'▥', w:1.3, d:0.48},
  {type:'screen', name:'折叠屏风', icon:'▤', w:1.55, d:0.24},
  {type:'dining', name:'餐桌', icon:'◯', w:1.25, d:1.25},
  {type:'mirror', name:'穿衣镜', icon:'◇', w:0.55, d:0.35}
];
const shapeCatalog = Object.fromEntries(catalog.map(i=>[i.type,i]));
const fengDirections = [
  {key:'北',symbol:'坎',element:'水',meaning:'传统中象征事业与流动'},
  {key:'东北',symbol:'艮',element:'土',meaning:'传统中象征学习与沉静'},
  {key:'东',symbol:'震',element:'木',meaning:'传统中象征生发与成长'},
  {key:'东南',symbol:'巽',element:'木',meaning:'传统中象征生长与丰足'},
  {key:'南',symbol:'离',element:'火',meaning:'传统中象征光明与表达'},
  {key:'西南',symbol:'坤',element:'土',meaning:'传统中象征安定与关系'},
  {key:'西',symbol:'兑',element:'金',meaning:'传统中象征愉悦与交流'},
  {key:'西北',symbol:'乾',element:'金',meaning:'传统中象征秩序与支持'}
];
let scene, renderer, camera, orbit, sun, warmLight, hemi, solarVector = new THREE.Vector3();
let roomGroup, floorMesh, photoMesh, photoTexture, gridMesh, fengGroup, selectionHelper, daylightGroup;
let wallParts = [], floorMaterial, wallMaterial, foregroundFloor, windowBounds = null;
let nextId = 1, down = null, toastTimer, cameraTween;
let flowGroup=null, flowParticles=null, flowLines=null, flowHeatPlane=null, flowSeeds=[], flowPositions=null, flowColors=null, flowLinePositions=null;
let frameLast=0, knowledgeCache='';
const STORAGE_KEY='qixu-space-studio-v4.autosave';
const journal=new HistoryJournal(40);
let saveDelay=null, restoring=false, walkLine=null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
const dragHit = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
let dragStarted = false;

const clamp = (n,a,b)=> Math.max(a,Math.min(b,n));
const deg = r=>r*180/Math.PI;
const rad = d=>d*Math.PI/180;
const el = (tag,cl,content)=>{const x=document.createElement(tag);if(cl)x.className=cl;if(content!==undefined)x.textContent=content;return x;};
const material = (color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const cream='#F8F3E8', leather='#A17E62', wood='#A27C5D', darkWood='#655043', sage='#687A68', dark='#53544A', gold='#AC9071';

function toast(msg){const node=$('toast');node.textContent=msg;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2700)}
function niceBox(parent,w,h,d,c,x,y,z,r=.06,extra={}){
  const geo=new RoundedBoxGeometry(Math.max(w,.015),Math.max(h,.015),Math.max(d,.015),3,Math.min(r,w/3,h/3,d/3));
  const mesh=new THREE.Mesh(geo,typeof c==='string'?material(c):c);
  mesh.position.set(x,y,z);mesh.castShadow=extra.shadow!==false;mesh.receiveShadow=true;
  parent.add(mesh);return mesh;
}
function cylinder(parent,top,bottom,h,color,x,y,z,sides=24){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,sides),typeof color==='string'?material(color):color);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function sphere(parent,r,color,x,y,z){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,15,10),typeof color==='string'?material(color):color);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh}
function leg4(g,w,d,y,height,c,size=.04){for(const x of [-w/2+.12,w/2-.12])for(const z of [-d/2+.12,d/2-.12])niceBox(g,size,height,size,c,x,y,z,.015)}

function makeObject(type){
  const g=new THREE.Group();
  if(type==='sofa'){
    leg4(g,2.08,.84,.135,.27,darkWood,.065);
    niceBox(g,2.06,.23,.88,leather,0,.36,0,.1);
    niceBox(g,2.06,.53,.19,'#C4AF97',0,.70,-.39,.085);
    for(const x of [-.51,.51]){
      niceBox(g,.94,.18,.66,'#E2D4C3',x,.53,.08,.075);
      niceBox(g,.91,.43,.12,'#D7C5AE',x,.75,-.25,.05);
    }
    niceBox(g,.18,.38,.90,'#C6B298',-1,.57,0,.07);niceBox(g,.18,.38,.90,'#C6B298',1,.57,0,.07);
    niceBox(g,.30,.26,.09,'#9BA891',-.72,.8,-.19,.05);
  }else if(type==='table'){
    const top=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.07,48),material('#B58F70'));top.scale.z=.58;top.position.y=.40;top.castShadow=true;top.receiveShadow=true;g.add(top);
    for(const x of [-.36,.36])for(const z of [-.17,.17])cylinder(g,.035,.035,.37,darkWood,x,.20,z);
    cylinder(g,.11,.11,.013,'#E9E0D3',.22,.45,-.07);
  }else if(type==='bed'){
    niceBox(g,1.89,.25,2.22,'#B7A48F',0,.28,0,.08);
    niceBox(g,1.82,.20,1.9,'#ECE8DC',0,.52,.07,.09);
    niceBox(g,1.82,.09,1.26,'#C3C6B4',0,.67,.39,.07);
    niceBox(g,1.87,.73,.16,darkWood,0,.66,-1.08,.07);
    niceBox(g,.72,.15,.36,'#F9F9F3',-.46,.68,-.75,.05);
    niceBox(g,.72,.15,.36,'#F9F9F3',.46,.68,-.75,.05);
    leg4(g,1.9,2.25,.09,.18,darkWood);
  }else if(type==='desk'){
    niceBox(g,1.42,.07,.68,'#B68A64',0,.76,0,.025);
    leg4(g,1.38,.65,.365,.73,'#4A544F',.038);
    niceBox(g,.55,.37,.035,'#383D3A',0,1.05,-.23,.02);
    niceBox(g,.50,.30,.018,'#C3D1CB',0,1.06,-.203,.01);
    niceBox(g,.034,.20,.034,'#555C56',0,.88,-.23,.01);
    niceBox(g,.35,.018,.18,'#E9DECC',.15,.80,.10,.008);
  }else if(type==='chair'){
    niceBox(g,.56,.14,.55,'#C5A688',0,.46,0,.06);
    niceBox(g,.55,.55,.12,'#B59A80',0,.83,-.25,.06);
    leg4(g,.55,.55,.23,.44,darkWood,.04);
  }else if(type==='plant'){
    cylinder(g,.15,.11,.25,'#BDA58B',0,.17,0);cylinder(g,.02,.02,.74,'#657052',0,.57,0);
    for(let i=0;i<8;i++){let a=i*2.399, y=.52+(i%4)*.16,dist=.16+(i%3)*.043;sphere(g,.17,i%3===0?'#637A53':'#869D70',Math.cos(a)*dist,y,Math.sin(a)*dist)}
    sphere(g,.15,'#76945F',0,1.20,0);
  }else if(type==='lamp'){
    cylinder(g,.18,.18,.045,dark,0,.04,0);cylinder(g,.019,.019,1.48,'#666052',0,.78,0);
    cylinder(g,.14,.24,.38,new THREE.MeshStandardMaterial({color:'#F5E7CF',roughness:.95,emissive:'#AE8E62',emissiveIntensity:.16}),0,1.52,0);
  }else if(type==='rug'){
    niceBox(g,2,.028,1.50,'#D6C7B0',0,.015,0,.014,{shadow:false});
    niceBox(g,1.85,.030,1.35,'#E9DEC9',0,.022,0,.014,{shadow:false});
    for(const z of [-.55,.55])niceBox(g,1.75,.008,.008,'#C1B49D',0,.044,z,.004,{shadow:false});
  }else if(type==='cabinet'){
    niceBox(g,1.29,.88,.47,'#B68C69',0,.54,0,.035);leg4(g,1.28,.45,.057,.12,darkWood,.05);
    for(const x of [-.31,.31]){
      niceBox(g,.57,.70,.01,'#C19E7D',x,.56,.244,.004);
      niceBox(g,.035,.12,.027,'#D8C7B0',x<0?-.07:.07,.56,.266,.009);
    }
    niceBox(g,.36,.035,.16,'#E9E2D5',-.23,1.00,0,.01);
  }else if(type==='screen'){
    for(let i=-1;i<=1;i++){
      const p=niceBox(g,.49,1.69,.042,'#C3AF90',i*.5,.89,Math.abs(i)*.055,.02);
      niceBox(g,.42,1.53,.05,'#DFD4BC',i*.5,.89,Math.abs(i)*.055+.01,.012);
      niceBox(g,.03,1.73,.056,'#796852',i*.5-.235,.89,Math.abs(i)*.055,.01);
    }
  }else if(type==='dining'){
    cylinder(g,.64,.64,.066,'#AF8868',0,.75,0,42);
    cylinder(g,.08,.10,.66,darkWood,0,.4,0);
    cylinder(g,.37,.37,.06,darkWood,0,.055,0);
    for(let a=0;a<4;a++){let t=a*Math.PI/2;const x=Math.cos(t)*.92,z=Math.sin(t)*.92;
      const chairGroup=new THREE.Group();chairGroup.position.set(x,0,z);chairGroup.rotation.y=-t-Math.PI/2;g.add(chairGroup);
      niceBox(chairGroup,.36,.08,.35,'#E0D1B9',0,.42,0,.045);
      niceBox(chairGroup,.36,.42,.06,'#A68C72',0,.68,-.16,.025);
      leg4(chairGroup,.35,.35,.20,.40,'#665B4E',.026);
    }
  }else if(type==='mirror'){
    niceBox(g,.53,1.5,.04,'#BBA383',0,.87,0,.055);
    niceBox(g,.43,1.37,.018,new THREE.MeshStandardMaterial({color:'#A7C4CB',metalness:.65,roughness:.16}),0,.87,.031,.05);
    niceBox(g,.36,.035,.34,darkWood,0,.09,.12,.013);
  }
  return g;
}

function texturedFloor(kind){
  const cn=document.createElement('canvas');cn.width=768;cn.height=768;
  const c=cn.getContext('2d');
  if(kind==='wood'){
    c.fillStyle='#D4B99B';c.fillRect(0,0,768,768);
    let seed=41;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    for(let i=0;i<15;i++){
      const y=i*52;const tone=i%3;
      c.fillStyle=['#D8C09E','#CBAF8F','#D2B598'][tone];c.fillRect(0,y,768,50);
      c.fillStyle='#9F886F';c.globalAlpha=.16;c.fillRect(0,y,768,1);c.globalAlpha=1;
      for(let j=0;j<12;j++){
        c.fillStyle=`rgba(94,65,38,${.016+rnd()*.045})`;
        const x=rnd()*768;c.fillRect(x,y+3+rnd()*40,100+rnd()*360,.4+rnd());
      }
      c.fillStyle='#977D65';c.globalAlpha=.16;c.fillRect(i%2?270:520,y,1,50);c.globalAlpha=1;
    }
  }else if(kind==='stone'){
    c.fillStyle='#DAD8CD';c.fillRect(0,0,768,768);
    c.strokeStyle='#C5C5BE';c.lineWidth=2;
    for(let i=0;i<=768;i+=192){c.beginPath();c.moveTo(i,0);c.lineTo(i,768);c.moveTo(0,i);c.lineTo(768,i);c.stroke()}
    for(let i=0;i<130;i++){let x=(i*397)%768,y=(i*223)%768;c.fillStyle='rgba(140,143,130,.04)';c.fillRect(x,y,40,15)}
  }else{
    c.fillStyle='#D2D0C6';c.fillRect(0,0,768,768);
    for(let i=0;i<1800;i++){let x=(i*397)%768,y=(i*223)%768;c.fillStyle=i%3===0?'#c6c3b9':'#dad7cf';c.globalAlpha=.25;c.fillRect(x,y,2,2)}c.globalAlpha=1;
  }
  const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.repeat.set(state.width/3.4,state.depth/3.4);
  return tex;
}
function clearGroup(group){while(group.children.length){const child=group.children[0];group.remove(child);child.traverse?.(o=>{if(o.geometry)o.geometry.dispose(); if(o.material&&o.material!==wallMaterial&&o.material!==floorMaterial){const arr=Array.isArray(o.material)?o.material:[o.material];arr.forEach(m=>m.dispose?.())}})}}
function buildRoom(){
  if(roomGroup){scene.remove(roomGroup);clearGroup(roomGroup)}
  if(wallMaterial)wallMaterial.dispose();
  if(floorMaterial){floorMaterial.map?.dispose();floorMaterial.dispose()}
  roomGroup=new THREE.Group();roomGroup.name='editable-room';scene.add(roomGroup);
  const W=state.width,D=state.depth,H=state.height;
  floorMaterial=new THREE.MeshStandardMaterial({map:texturedFloor(state.floor),roughness:.93});
  wallMaterial=material(state.wall,.98);
  floorMesh=niceBox(roomGroup,W,.14,D,floorMaterial,0,-.085,0,.022,{shadow:false});
  floorMesh.name='room-floor';
  // The wall pivots allow true unfolding into a flattened 3D architectural model.
  wallParts=[];
  const createWall=(name,x,z,w,h,d,foldAxis,foldTarget,seeThrough=false)=>{
    const hinge=new THREE.Group();hinge.name=name;hinge.position.set(x,0,z);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),seeThrough?new THREE.MeshStandardMaterial({color:state.wall,roughness:.95,transparent:true,opacity:.14,depthWrite:false}):wallMaterial.clone());
    mesh.position.y=h/2;mesh.receiveShadow=true;mesh.castShadow=true;hinge.add(mesh);roomGroup.add(hinge);
    wallParts.push({hinge,foldAxis,foldTarget,seeThrough});return hinge;
  };
  // Construct a physical opening rather than overlaying a glass rectangle on a solid wall.
  // Direct sunlight can therefore cast a correctly positioned patch through the window.
  const back=new THREE.Group();back.name='back-wall';back.position.set(0,0,-D/2);roomGroup.add(back);  wallParts.push({hinge:back,foldAxis:'x',foldTarget:-Math.PI/2,seeThrough:false});
  const winW=Math.min(state.windowWidth,W-.6),winH=Math.min(1.25,H-1.19),sill=.93;
  const winX=clamp(state.windowPosition/100*(W/2),-W/2+winW/2+.15,W/2-winW/2-.15);
  const l=winX-winW/2,r=winX+winW/2;
  const panel=(w,h,x,y)=>{if(w>.005&&h>.005)niceBox(back,w,h,.10,wallMaterial,x,y,0,.008)};
  panel(l+W/2,H,(l-W/2)/2,H/2);
  panel(W/2-r,H,(r+W/2)/2,H/2);
  panel(winW,sill,winX,sill/2);
  panel(winW,H-sill-winH,winX,(H+sill+winH)/2);
  windowBounds={x:winX,left:l,right:r,bottom:sill,top:sill+winH,width:winW,height:winH};
  const left=createWall('left-wall',-W/2,0, .10,H,D,'z',Math.PI/2);
  createWall('right-ghost-wall',W/2,0,.10,H,D,'z',-Math.PI/2,true);
  // Render cutaway: front wall and ceiling are optically invisible, yet block direct sun
  // in the shadow map. This keeps the visual sunlight consistent with the window model.
  const hiddenShell=new THREE.MeshBasicMaterial({color:0xffffff,colorWrite:false,depthWrite:false,side:THREE.DoubleSide});
  const invisibleFront=new THREE.Mesh(new THREE.PlaneGeometry(W,H),hiddenShell);
  invisibleFront.position.set(0,H/2,D/2);invisibleFront.castShadow=true;roomGroup.add(invisibleFront);
  const invisibleCeiling=new THREE.Mesh(new THREE.PlaneGeometry(W,D),hiddenShell.clone());
  invisibleCeiling.rotation.x=-Math.PI/2;invisibleCeiling.position.set(0,H,.0);
  invisibleCeiling.castShadow=true;roomGroup.add(invisibleCeiling);
  niceBox(back,W,.105,.125,'#DCD3C5',0,.055,.018,.018,{shadow:false});
  niceBox(left,.125,.105,D,'#DCD3C5',.025,.055,0,.018,{shadow:false});
  // Built-in window illustration (non-structural) on the back wall.
  const frameColor='#E9E5DC';
  for(const xx of [l,r])niceBox(back,.06,winH+.08,.115,frameColor,xx,sill+winH/2,.013,.008,{shadow:false});
  for(const yy of [sill,sill+winH])niceBox(back,winW+.11,.063,.115,frameColor,winX,yy,.014,.008,{shadow:false});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(winW-.09,winH-.09),new THREE.MeshPhysicalMaterial({color:'#C4DDE2',roughness:.12,metalness:0,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));
  glass.position.set(winX,sill+winH/2,.055);glass.castShadow=false;back.add(glass);
  niceBox(back,.036,winH,.08,frameColor,winX,sill+winH/2,.076,.004,{shadow:false});
  niceBox(back,winW,.029,.08,frameColor,winX,sill+winH/2,.076,.004,{shadow:false});
  niceBox(back,winW+.21,.055,.24,'#DAD1C4',winX,sill-.04,.15,.01,{shadow:false});
  // Thin wall artwork.
  const artX=W*.28;
  niceBox(back,.72,.84,.035,'#BCA98A',artX,1.57,.002,.02,{shadow:false});
  niceBox(back,.65,.77,.045,'#E6D9C9',artX,1.57,.028,.012,{shadow:false});
  niceBox(back,.18,.44,.052,'#9CAB93',artX,1.54,.059,.025,{shadow:false});
  niceBox(back,.14,.2,.055,'#EAE3D3',artX+.19,1.42,.059,.02,{shadow:false});
  // Door location is marked on the front floor edge (no pretend doorway in a solid wall).
  const doorX=-W/2+Math.min(1.0,W*.22);
  const marker=niceBox(roomGroup,.87,.012,.038,'#BDA582',doorX,.01,D/2-.05,.005,{shadow:false});
  marker.name='entrance-threshold';
  if(state.hasPhoto&&photoTexture)buildPhotoPlane();
  buildOverlays();
  rebuildFlow();
  updateWallFolds(true);
  state.items.forEach(item=>clampItem(item));
  updateSelection();updateGuidance();syncDimensions();updateSolarSimulation();
}
function buildPhotoPlane(){
  if(!photoTexture)return;
  const W=state.width,H=state.height,D=state.depth;
  const aspect=photoTexture.image?.width/photoTexture.image?.height||1.5;
  let w=Math.min(W*.66,windowBounds?.width||W*.66),h=w/aspect;
  if(h>H*.70){h=H*.70;w=h*aspect}
  photoMesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:photoTexture,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
  photoMesh.position.set(windowBounds?.x||0,(windowBounds?.bottom||.93)+(windowBounds?.height||1.25)/2,-D/2+.095);
  photoMesh.visible=state.photoMapped;
  const back=wallParts[0].hinge;
  // Geometry is in wall hinge-local coordinates so the photo unfolds along with the wall.
  photoMesh.position.z=.112;
  back.add(photoMesh);
}
function makeFlatLabel(content){
  const cn=document.createElement('canvas');cn.width=360;cn.height=96;
  const cx=cn.getContext('2d');cx.clearRect(0,0,360,96);
  cx.fillStyle='#546a59';cx.font='bold 43px sans-serif';cx.textAlign='center';cx.fillText(content,180,63);
  const t=new THREE.CanvasTexture(cn);t.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(.77,.21),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  m.rotation.x=-Math.PI/2;return m;
}
function buildOverlays(){
  if(fengGroup){scene.remove(fengGroup);clearGroup(fengGroup)}
  fengGroup=new THREE.Group();scene.add(fengGroup);
  const radius=Math.max(.75,Math.min(state.width,state.depth)*.38);
  for(let i=0;i<8;i++){
    const start=Math.PI/2-i*Math.PI/4-Math.PI/8;
    const geom=new THREE.RingGeometry(radius*.57,radius,20,1,start+0.025,Math.PI/4-.05);
    const m=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color:i%2?'#A5B59D':'#D1B995',transparent:true,opacity:i===state.chosenBagua?.42:.12,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.021;fengGroup.add(m);
    const a=i*Math.PI/4;
    // Positions use +X = East and -Z = North, clockwise by sector.
    const label=makeFlatLabel(`${fengDirections[i].symbol}·${fengDirections[i].key}`);
    label.position.set(Math.sin(a)*radius*.80,.031,-Math.cos(a)*radius*.80);
    fengGroup.add(label);
  }
  fengGroup.rotation.y=-rad(state.north);fengGroup.visible=state.overlays;
  if(gridMesh){scene.remove(gridMesh);gridMesh.geometry.dispose();gridMesh.material.dispose()}
  gridMesh=new THREE.GridHelper(Math.max(state.width,state.depth)*1.15,Math.ceil(Math.max(state.width,state.depth)*2.4),'#A5A79B','#C3C4BB');
  gridMesh.position.y=.018;gridMesh.material.transparent=true;gridMesh.material.opacity=.25;gridMesh.visible=state.grid;scene.add(gridMesh);
}
function updateWallFolds(immediate=false){
  for(const wall of wallParts){
    const target=state.unfolded?wall.foldTarget:0;
    if(immediate){wall.hinge.rotation[wall.foldAxis]=target}else wall.goal=target;
  }
  $('scene-message').textContent=state.unfolded?'墙体展开模式':'自由编辑模式';
}
function updateRoomMaterials(){buildRoom()}
function addFurniture(type,x,z,{quiet=false,rotation=0,scale=1}={}){
  const cat=shapeCatalog[type];if(!cat)return null;
  const item={id:nextId++,type,name:cat.name,icon:cat.icon,group:makeObject(type),w:cat.w,d:cat.d,rotation,scale,widthScale:1,depthScale:1};
  item.group.position.set(x,0,z);item.group.rotation.y=rad(rotation);applyItemScale(item);
  item.group.userData.itemId=item.id;
  item.group.traverse(child=>{child.userData.itemId=item.id});
  scene.add(item.group);state.items.push(item);clampItem(item);
  if(!quiet){selectItem(item);toast(`已添加：${item.name} · 可拖动、旋转与改尺寸`)}
  else refreshFurnitureList();
  if(type==='lamp'&&sun)updateSolarSimulation();
  if(flowGroup)refreshFlowHeat();
  return item;
}
function removeItems(){for(const item of state.items){scene.remove(item.group);clearGroup(item.group)}state.items=[];state.selected=null;updateSelection();refreshFurnitureList()}
function resetPreset(type,quiet=false){
  state.room=type;state.layoutIteration=0;removeItems();
  const W=state.width,D=state.depth;
  if(type==='living'){
    addFurniture('rug',0,.25,{quiet:true});addFurniture('sofa',0,-D*.22,{quiet:true});addFurniture('table',0,.2,{quiet:true});
    addFurniture('plant',W*.38,-D*.30,{quiet:true});addFurniture('lamp',W*.35,D*.25,{quiet:true});
    addFurniture('cabinet',-W*.33,D*.28,{quiet:true,rotation:90});
  }else if(type==='bedroom'){
    addFurniture('rug',.15,.25,{quiet:true});addFurniture('bed',.25,-D*.10,{quiet:true});
    addFurniture('lamp',W*.36,-D*.30,{quiet:true});addFurniture('plant',-W*.33,-D*.34,{quiet:true});
    addFurniture('cabinet',-W*.30,D*.32,{quiet:true,rotation:90});
  }else{
    addFurniture('desk',0,-D*.32,{quiet:true});addFurniture('chair',0,-D*.09,{quiet:true});
    addFurniture('rug',.10,D*.25,{quiet:true});addFurniture('plant',W*.37,-D*.31,{quiet:true});
    addFurniture('lamp',W*.33,D*.32,{quiet:true});addFurniture('cabinet',-W*.35,D*.25,{quiet:true,rotation:90});
  }
  document.querySelectorAll('#room-presets button').forEach(b=>b.classList.toggle('active',b.dataset.room===type));
  applyArrangement(0,true);
  updateRoomKnowledge();updateGuidance();if(!quiet)toast(`已切换为${type==='living'?'客厅':type==='bedroom'?'卧室':'书房'}参考布局`);
}
function applyItemScale(item){item.group.scale.set(item.scale*item.widthScale,item.scale,item.scale*item.depthScale)}
function footprint(item){
  const w=item.w*item.scale*item.widthScale,d=item.d*item.scale*item.depthScale;
  const a=rad(item.rotation),c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
  return {w,d,ex:(w*c+d*s)/2,ez:(d*c+w*s)/2};
}
function clampItem(item){
  const {ex,ez}=footprint(item);
  const boundX=Math.max(0,state.width/2-ex-.06),boundZ=Math.max(0,state.depth/2-ez-.06);
  item.group.position.x=clamp(item.group.position.x,-boundX,boundX);
  item.group.position.z=clamp(item.group.position.z,-boundZ,boundZ);
}
function furnitureCorners(item){
  const {w,d}=footprint(item),a=rad(item.rotation),c=Math.cos(a),s=Math.sin(a);
  return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>[item.group.position.x+x*c+z*s,item.group.position.z-x*s+z*c]);
}
function furnitureCollision(a,b){
  if(a.type==='rug'||b.type==='rug')return false;
  const A=furnitureCorners(a),B=furnitureCorners(b);
  for(const c of [A,B])for(let j=0;j<2;j++){
    const edge=[c[j+1][0]-c[j][0],c[j+1][1]-c[j][1]];
    const ax=[-edge[1],edge[0]];
    const dot=p=>p[0]*ax[0]+p[1]*ax[1];
    const pa=A.map(dot),pb=B.map(dot);
    if(Math.max(...pa)<Math.min(...pb)+.01||Math.max(...pb)<Math.min(...pa)+.01)return false;
  }
  return true;
}
function layoutIssues(){
  const collisions=[];
  for(let i=0;i<state.items.length;i++)for(let j=i+1;j<state.items.length;j++){
    if(furnitureCollision(state.items[i],state.items[j]))collisions.push([state.items[i],state.items[j]]);
  }
  const doorX=-state.width/2+Math.min(1,state.width*.22),doorZ=state.depth/2-.08;
  const nearDoor=state.items.filter(i=>i.type!=='rug'&&Math.hypot(i.group.position.x-doorX,i.group.position.z-doorZ)<Math.max(.78,footprint(i).d/2+.55));
  return {collisions,nearDoor};
}
function refreshFurnitureList(){
  const target=$('furniture-list');if(!target)return;target.replaceChildren();
  for(const item of state.items){const b=el('button',item===state.selected?'furniture-row active':'furniture-row');
    b.type='button';b.append(el('span','',item.icon),el('span','',item.name),el('small','',`${directionOf(item.group.position.x,item.group.position.z)} · ${item.group.position.x.toFixed(1)}, ${item.group.position.z.toFixed(1)}`));
    b.addEventListener('click',()=>selectItem(item));target.append(b);
  }
  const issues=layoutIssues();const health=$('layout-health');
  if(health){health.textContent=issues.collisions.length?`注意：发现 ${issues.collisions.length} 组家具占地重叠，建议移动或调小尺寸。`:'当前未发现家具占地重叠（示意检测）';health.classList.toggle('warning',issues.collisions.length>0)}
}
function selectItem(item){state.selected=item;updateSelection()}
function setSelectionFromId(id){selectItem(state.items.find(i=>i.id===id)||null)}
function updateSelection(){
  const item=state.selected;
  $('nothing-selected').hidden=!!item;$('selected-properties').hidden=!item;
  $('selection-status').textContent=item?'编辑中':'未选择';
  if(selectionHelper){scene.remove(selectionHelper);selectionHelper.geometry?.dispose?.();selectionHelper.material?.dispose?.();selectionHelper=null}
  if(item){
    $('selected-name').textContent=item.name;$('selected-icon').textContent=item.icon;
    const xrange=$('object-x'),zrange=$('object-z');
    const {ex,ez,w,d}=footprint(item);
    xrange.min=(-Math.max(0,state.width/2-ex-.06)).toFixed(2);xrange.max=(Math.max(0,state.width/2-ex-.06)).toFixed(2);
    zrange.min=(-Math.max(0,state.depth/2-ez-.06)).toFixed(2);zrange.max=(Math.max(0,state.depth/2-ez-.06)).toFixed(2);
    xrange.value=item.group.position.x;zrange.value=item.group.position.z;
    $('object-x-value').textContent=`${item.group.position.x.toFixed(2)} m`;
    $('object-z-value').textContent=`${item.group.position.z.toFixed(2)} m`;
    $('object-rotation').value=item.rotation;$('object-rotation-value').textContent=`${item.rotation}°`;
    $('object-scale').value=Math.round(item.scale*100);$('object-scale-value').textContent=`${Math.round(item.scale*100)}%`;
    $('object-width').value=Math.round(item.widthScale*100);$('object-width-value').textContent=`${Math.round(item.widthScale*100)}%`;
    $('object-depth').value=Math.round(item.depthScale*100);$('object-depth-value').textContent=`${Math.round(item.depthScale*100)}%`;
    $('object-footprint').textContent=`实际占地：${w.toFixed(2)} × ${d.toFixed(2)} 米`;
    const dir=directionOf(item.group.position.x,item.group.position.z);
    $('selected-direction').textContent=dir==='中'?'位于房间中心':`传统方位：${dir}`;    selectionHelper=new THREE.BoxHelper(item.group,0xAC8E62);selectionHelper.material.transparent=true;selectionHelper.material.opacity=.72;scene.add(selectionHelper);
  }
  refreshFurnitureList();updateGuidance();refreshFlowHeat();
}
function directionOf(x,z){
  if(Math.hypot(x,z)<.38)return '中';
  let b=(deg(Math.atan2(x,-z))-state.north+360)%360;
  return fengDirections[Math.round(b/45)%8].key;
}
function setItemTransform(){const item=state.selected;if(!item)return;
  item.group.position.x=Number($('object-x').value);
  item.group.position.z=Number($('object-z').value);
  item.rotation=Number($('object-rotation').value);item.group.rotation.y=rad(item.rotation);
  item.scale=Number($('object-scale').value)/100;
  item.widthScale=Number($('object-width').value)/100;
  item.depthScale=Number($('object-depth').value)/100;
  applyItemScale(item);clampItem(item);
  selectionHelper?.update();updateSelection();
}
function duplicateSelected(){if(!state.selected)return;const src=state.selected;
  const clone=addFurniture(src.type,src.group.position.x+.35,src.group.position.z+.35,{rotation:src.rotation,scale:src.scale});
  clone.widthScale=src.widthScale;clone.depthScale=src.depthScale;applyItemScale(clone);clampItem(clone);updateSelection();toast('已复制家具，可以继续移动');
}
function deleteSelected(){if(!state.selected)return;const item=state.selected;state.selected=null;scene.remove(item.group);clearGroup(item.group);state.items=state.items.filter(i=>i!==item);updateSelection();toast(`已移除：${item.name}`)}

function pointerRay(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(mouse,camera)}
function pick(e){pointerRay(e);const objs=state.items.map(i=>i.group);
  const hits=raycaster.intersectObjects(objs,true);
  return hits.length?state.items.find(i=>i.id===hits[0].object.userData.itemId):null;
}
function groundPoint(e,output){pointerRay(e);return raycaster.ray.intersectPlane(dragPlane,output)}
function onPointerDown(e){if(e.button!==0)return;
  const item=pick(e);
  down={x:e.clientX,y:e.clientY,item};dragStarted=false;
  if(item){selectItem(item);orbit.enabled=false;groundPoint(e,dragHit);dragOffset.subVectors(item.group.position,dragHit);renderer.domElement.setPointerCapture(e.pointerId)}
  else{selectItem(null)}
}
function onPointerMove(e){if(!down?.item)return;
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4)dragStarted=true;
  if(!dragStarted)return;
  if(groundPoint(e,dragHit)){
    const item=down.item;item.group.position.x=dragHit.x+dragOffset.x;item.group.position.z=dragHit.z+dragOffset.z;
    if(state.snap){item.group.position.x=Math.round(item.group.position.x*10)/10;item.group.position.z=Math.round(item.group.position.z*10)/10}
    clampItem(item);selectionHelper?.update();
    $('object-x').value=item.group.position.x;$('object-z').value=item.group.position.z;
    $('object-x-value').textContent=`${item.group.position.x.toFixed(2)} m`;
    $('object-z-value').textContent=`${item.group.position.z.toFixed(2)} m`;
    $('selected-direction').textContent=`传统方位：${directionOf(item.group.position.x,item.group.position.z)}`;
    $('viewport').classList.add('dragging');
  }
}
function onPointerUp(){if(dragStarted){updateSelection();updateGuidance()}down=null;dragStarted=false;orbit.enabled=true;$('viewport').classList.remove('dragging')}

function kelvinRGB(temperature){
  let t=clamp(temperature,1000,40000)/100;
  let r=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592);
  let g=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492);
  let b=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;
  return new THREE.Color().setRGB(clamp(r,0,255)/255,clamp(g,0,255)/255,clamp(b,0,255)/255,THREE.SRGBColorSpace);
}
function makeLights(){
  hemi=new THREE.HemisphereLight(0xF9FCFF,0xBCB7A8,1.6);scene.add(hemi);
  sun=new THREE.DirectionalLight(0xFFF2E3,2.4);sun.position.set(0,15,-15);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=70;sun.shadow.bias=-.0001;sun.shadow.normalBias=.018;sun.shadow.radius=2;
  scene.add(sun);sun.target.position.set(0,.4,0);scene.add(sun.target);
  warmLight=new THREE.PointLight(0xFFC991,0,9);warmLight.position.set(0,2.45,0);scene.add(warmLight);
}
// Solar model is illustrative only: clear-sky northern hemisphere, approximate equinox.
// Compass bearing is calibrated manually: -Z scene rear = 0°, +X = clockwise 90°.
function calculateSunVector(){
  const hour=state.sunHour,phase=(hour-6)/12;
  const alt=Math.max(0,Math.sin(Math.PI*clamp(phase,0,1)))*rad(60);
  const az=rad(90+clamp(phase,0,1)*180+state.north);
  const vec=new THREE.Vector3(Math.sin(az)*Math.cos(alt),Math.sin(alt),-Math.cos(az)*Math.cos(alt));
  return {vec,alt};
}
function isSunlitAt(x,z,y=.04){
  if(state.sunHour<=6||state.sunHour>=18||state.daylight<5||!windowBounds)return false;
  const v=solarVector, W=state.width/2,D=state.depth/2,H=state.height;
  // A ray is exposed only if its FIRST room-boundary hit crosses the real back-wall window.
  const candidates=[];
  if(v.z<-.00001)candidates.push({side:'back',t:(-D-z)/v.z});
  if(v.z>.00001)candidates.push({side:'front',t:(D-z)/v.z});
  if(v.x<-.00001)candidates.push({side:'left',t:(-W-x)/v.x});
  if(v.x>.00001)candidates.push({side:'right',t:(W-x)/v.x});
  if(v.y>.00001)candidates.push({side:'ceiling',t:(H-y)/v.y});
  const hit=candidates.filter(c=>c.t>.00001).sort((a,b)=>a.t-b.t)[0];
  if(!hit||hit.side!=='back')return false;
  const hx=x+v.x*hit.t, hy=y+v.y*hit.t;
  return hx>windowBounds.left+.015&&hx<windowBounds.right-.015&&hy>windowBounds.bottom+.015&&hy<windowBounds.top-.015;
}
function updateSolarSimulation(){
  if(!scene||!sun||!renderer||!windowBounds)return;
  const {vec,alt}=calculateSunVector();solarVector.copy(vec);
  const alive=state.sunHour>6&&state.sunHour<18;
  const day=state.light==='day';
  sun.position.copy(vec).multiplyScalar(24);sun.target.position.set(0,.5,0);
  sun.intensity=day&&alive?(2.9*state.daylight/100*Math.max(.05,Math.sin(alt))):0;
  sun.color.set(state.sunHour<9||state.sunHour>16?'#FFD4A7':'#FFF4DE');
  hemi.intensity=day?(alive?.66+state.daylight/100*.95:.3):.29;
  const bulb=kelvinRGB(state.lightKelvin);
  warmLight.color.copy(bulb);warmLight.intensity=(state.lampPower/100)*(day?1.6:16);
  for(const item of state.items){
    if(item.type!=='lamp')continue;
    if(!item.bulb){item.bulb=new THREE.PointLight(bulb,0,4.2);item.bulb.position.set(0,1.45,0);item.group.add(item.bulb)}
    item.bulb.color.copy(bulb);item.bulb.intensity=state.lampPower/100*(day?1.0:4.3);
  }
  renderer.toneMappingExposure=day?1.16:.86;
  scene.background.set(day?(alive?'#edf0e8':'#d8d9d8'):'#d5d7d8');scene.fog.color.copy(scene.background);
  if(daylightGroup){scene.remove(daylightGroup);clearGroup(daylightGroup)}
  daylightGroup=new THREE.Group();scene.add(daylightGroup);
  const nx=15,nz=13,dx=state.width/nx,dz=state.depth/nz;
  let exposed=0,total=nx*nz;
  const geom=new THREE.PlaneGeometry(dx*.97,dz*.97);
  const glow=new THREE.MeshBasicMaterial({color:state.sunHour<10||state.sunHour>16?'#EFC078':'#F7DEA1',transparent:true,opacity:.27,depthWrite:false,side:THREE.DoubleSide});
  for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
    const x=-state.width/2+(ix+.5)*dx,z=-state.depth/2+(iz+.5)*dz;
    if(!isSunlitAt(x,z))continue;
    exposed++;const cell=new THREE.Mesh(geom,glow);cell.rotation.x=-Math.PI/2;cell.position.set(x,.028,z);daylightGroup.add(cell);
  }
  state.sunlightCoverage=Math.round(100*exposed/total);
  daylightGroup.visible=state.sunOverlay&&day&&alive;
  $('sun-coverage').textContent=`${day&&alive?state.sunlightCoverage:0}%`;
  const text=day&&!alive?'当前为夜间时刻，模拟无太阳直射。':!day?'正在查看室内人工照明。':
    state.sunlightCoverage>0?'浅金区域为估算的直射落点，真实遮挡以实测为准。':'当前模拟条件下，没有阳光穿过后墙窗洞。';
  $('sun-description').textContent=text;
  $('sun-hour-output').textContent=hourText(state.sunHour);
  $('sun-period').textContent=state.sunHour<10?'上午 · 柔光':state.sunHour<15?'午间 · 日光':state.sunHour<18?'傍晚 · 斜阳':'夜间 · 照明';
  $('daylight-output').textContent=`${state.daylight}%`;
  $('lamp-output').textContent=`${state.lampPower}%`;
  $('kelvin-output').textContent=`${state.lightKelvin} K`;
  $('window-width-output').textContent=`${windowBounds.width.toFixed(1)} m`;
  $('window-position-output').textContent=state.windowPosition===0?'居中':`${state.windowPosition<0?'偏左':'偏右'} ${Math.abs(state.windowPosition)}%`;
  document.querySelectorAll('#quick-times button').forEach(b=>b.classList.toggle('active',Number(b.dataset.hour)===state.sunHour));
  updateGuidance();
}
function hourText(h){return `${String(Math.floor(h)).padStart(2,'0')}:${h%1?'30':'00'}`}
function setLight(mode){state.light=mode;
  if(mode==='warm'){state.sunHour=20}else if(state.sunHour>=18){state.sunHour=12}
  $('sun-hour').value=state.sunHour;
  document.querySelectorAll('#light-modes button').forEach(b=>b.classList.toggle('active',b.dataset.light===mode));
  updateSolarSimulation();
}
function syncDimensions(){
  $('width-output').textContent=`${state.width.toFixed(1)} m`;
  $('depth-output').textContent=`${state.depth.toFixed(1)} m`;
  $('height-output').textContent=`${state.height.toFixed(1)} m`;
  $('viewport-dimensions').textContent=`${state.width.toFixed(1)} × ${state.depth.toFixed(1)} × ${state.height.toFixed(1)} m`;
}
function updateRangeFill(input){
  const mn=Number(input.min)||0,mx=Number(input.max)||100,pct=(Number(input.value)-mn)/(mx-mn)*100;
  input.style.background=`linear-gradient(90deg,#87947d 0%,#87947d ${pct}%,#e7e8e2 ${pct}%,#e7e8e2 100%)`;
}
function setCameraView(view){
  const r=Math.max(state.width,state.depth);
  let pos;
  if(view==='top')pos=new THREE.Vector3(.01,r*2.0,.015);
  else if(view==='front')pos=new THREE.Vector3(0,2.8,r*1.9);
  else pos=new THREE.Vector3(r*1.29,r*.99,r*1.48);
  cameraTween={start:camera.position.clone(),end:pos,t:0,startTarget:orbit.target.clone(),endTarget:new THREE.Vector3(0,.45,0)};
  document.querySelectorAll('#view-buttons button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  // in top view the unfolded walls are most legible.
}
function updateGuidance(){
  const root=$('feng-guidance');root.replaceChildren();
  const items=[];
  if(state.fengTab==='practical'){
    const W=state.width,D=state.depth;
    const {nearDoor:blocking,collisions}=layoutIssues();
    if(collisions.length)items.push(['!','家具重叠提醒',`检测到 ${collisions.length} 组家具外轮廓重叠。可以拖动、旋转或缩小家具，直到警告消失。`]);
    if(blocking.length)items.push(['○','门前预留通道',`门口附近有 ${blocking.map(i=>i.name).slice(0,2).join('、')}，建议留出约 0.8–0.9 米的净通行宽度。`]);
    else items.push(['✓','入口动线较清爽','门前暂未发现明显的家具占位，请结合真实门洞尺寸核对通道宽度。']);
    const sofas=state.items.filter(i=>i.type==='sofa');
    if(sofas.length){
      const s=sofas[0], dist=Math.min(W/2-Math.abs(s.group.position.x),D/2-Math.abs(s.group.position.z));
      items.push(['◈','沙发靠墙更安定',dist<1.0?'座位临近墙面。实际还要确认背后是否有窗户、柜门或过道。':'可考虑让沙发背部更接近实墙，同时保留窗户与通行空间。']);
    }
    const bed=state.items.find(i=>i.type==='bed');
    if(bed)items.push(['◇','床位与舒适性',`床位可自由移动和旋转。建议预留上下床通行距离，避免床头直对强光或暖气出风口；传统“靠实墙”是文化偏好，不是硬性装修规则。`]);
    const desk=state.items.find(i=>i.type==='desk');
    if(desk)items.push(['☼','桌面直射检查',isSunlitAt(desk.group.position.x,desk.group.position.z,.76)?'桌面可能遭遇直射光，建议选择侧向采光或使用可调窗帘减轻屏幕眩光。':'桌面暂未落入模拟直射区；仍需现场确认充足的漫射照明。']);
    const plants=state.items.filter(i=>i.type==='plant');
    if(plants.length)items.push(['☼','绿植与自然光',plants.some(i=>i.group.position.z<0)?'有绿植布置在靠近窗户一侧。注意实际光照方向和植物喜光程度。':'可以考虑靠窗摆放合适的植物，但应避免遮挡采光和过道。']);
    if(state.selected)items.push(['⌖','正在调整的物件',`${state.selected.name} 位于${directionOf(state.selected.group.position.x,state.selected.group.position.z)}向区域。方位随罗盘校准实时更新。`]);
    items.push(['△','装修中的现实约束','请以实测尺寸、承重结构、电路、防火和日常行动习惯为优先依据。']);
  }else if(state.fengTab==='light'){
    const sunlight=state.light==='day'&&state.sunHour>6&&state.sunHour<18;
    items.push(['☼','地面直射估算',sunlight?`当前时刻 ${hourText(state.sunHour)}，有约 ${state.sunlightCoverage}% 的地面采样点能通过模拟窗洞看到太阳。黄色落点会随时间、方向和窗宽变化。`:'夜间或人工灯模式下不计算日光直射；可以切回自然日光预设，调节时刻和罗盘方向。']);
    if(state.selected){const pos=state.selected.group.position;
      items.push(['◉',`${state.selected.name} 的采光`,sunlight?(isSunlitAt(pos.x,pos.z,.3)?'物件中心处在模拟直射区域，可能受眩光和紫外线影响；请核对实际窗帘需求。':'物件中心目前未落入直接日照区域；仍可能得到环境散射光。'):'当前以人工照明为主，建议避免灯具直射眼睛。']);
    }
    items.push(['⌖','朝向联动','先用罗盘校准真实北方。调整北向后，模拟太阳方向、窗户直射落点和方位象征都会一起更新。']);
    items.push(['△','重要边界','仅模拟一面墙的窗洞、近似太阳轨迹和无遮挡晴天。不等于光照强度、真实日照时长或建筑采光合规测算。']);
  }else{
    if(state.selected){
      const d=directionOf(state.selected.group.position.x,state.selected.group.position.z);
      const rec=fengDirections.find(v=>v.key===d);
      items.push(['⌖',`${state.selected.name} · ${d==='中'?'中宫':d+'位'}`,rec?`${rec.symbol}卦，五行属${rec.element}；${rec.meaning}。这仅是传统象征，并非效果承诺。`:'中宫在传统八卦中象征空间中心，优先保持灵活通行。']);    }else items.push(['⌖','先选择一件家具','点击场景中的家具，查看它相对罗盘的传统方位与文化象征。']);
    items.push(['◈','北 · 坎 / 水','传统上对应流动与事业等象征，并不表示北边摆放某个物件就能改变运势。']);
    items.push(['✧','东 · 震 / 木','传统上关联生长。摆放绿植时，更应看真实日照和植物养护需求。']);
    items.push(['☼','南 · 离 / 火','传统中象征明亮。现代设计中请优先保证充足且舒适的照明。']);
  }
  for(const [icon,title,body] of items){
    const card=el('div','feng-item');const head=el('div');head.append(el('span','feng-icon',icon),el('b','',title));card.append(head,el('p','',body));root.append(card);
  }
}
function updateCompass(){
  $('north-value').textContent=`${state.north}°`;
  $('needle').style.transform=`rotate(${state.north}deg)`;
  $('compass-line').style.transform=`rotate(${state.north}deg)`;
  const label=state.north===0?'场景后方':`相对场景后方偏转 ${state.north}°`;
  $('compass-heading').textContent=`北向：${label}`;
  if(fengGroup)fengGroup.rotation.y=-rad(state.north);
  if(flowGroup)refreshFlowHeat();
  updateBaguaKnowledge();updateSelection();updateSolarSimulation();
}
function saveBlob(contents,name,type){const b=contents instanceof Blob?contents:new Blob([contents],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}
function projectSnapshot(){
  return {
    schema:'qixu-room-v4',notice:'The artistic flow and daylight model are illustrative. Uploaded photos are not embedded.',
    room:{width:state.width,depth:state.depth,height:state.height,wall:state.wall,floor:state.floor,roomType:state.room,light:state.light,north:state.north,sunHour:state.sunHour,daylight:state.daylight,lampPower:state.lampPower,lightKelvin:state.lightKelvin,windowWidth:state.windowWidth,windowPosition:state.windowPosition},
    items:state.items.map(i=>({type:i.type,x:Number(i.group.position.x.toFixed(3)),z:Number(i.group.position.z.toFixed(3)),rotation:i.rotation,scale:i.scale,widthScale:i.widthScale,depthScale:i.depthScale})),
    flow:{visible:state.flowVisible,heat:state.flowHeat,speed:state.flowSpeed,density:state.flowDensity,mode:state.flowMode,bagua:state.chosenBagua,element:state.chosenElement,route:state.routeVisible}
  };
}
function saveProject(){
  saveBlob(JSON.stringify(projectSnapshot(),null,2),'栖序-V4-空间方案.json','application/json');toast('方案已导出为 JSON 文件');
}
function scheduleAutoSave(){
  if(restoring)return;
  clearTimeout(saveDelay);
  const badge=$('save-notice');if(badge)badge.textContent='正在保存到本机…';
  saveDelay=setTimeout(()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(projectSnapshot()));if(badge)badge.textContent='已自动保存到本机';}
    catch(err){console.warn('Local save unavailable:',err);if(badge)badge.textContent='本地存储不可用 · 请导出 JSON';}
  },500);
}
function refreshHistoryButtons(){
  $('undo-edit').disabled=!journal.canUndo;
  $('redo-edit').disabled=!journal.canRedo;
}
function checkpoint(){
  if(restoring||!scene||!state.items)return;
  journal.commit(projectSnapshot());refreshHistoryButtons();scheduleAutoSave();
}
function navigateHistory(dir){
  const data=dir<0?journal.undo():journal.redo();
  if(!data)return;
  try{applyProjectData(data,{quiet:true});refreshHistoryButtons();scheduleAutoSave();toast(dir<0?'已撤销上一步':'已重做上一步');}
  catch(e){console.error(e);toast('历史版本恢复失败');}
}
function applyProjectData(data,{quiet=false}={}){
  const prior=restoring;restoring=true;
  try{
    if(!['qixu-room-v1','qixu-room-v2','qixu-room-v3','qixu-room-v4'].includes(data?.schema)||!data.room||!Array.isArray(data.items))throw new Error('不是有效的栖序方案文件');
    const room=data.room;
    const numberIn=(n,lo,hi,dflt)=>Number.isFinite(Number(n))?clamp(Number(n),lo,hi):dflt;
    state.width=numberIn(room.width,3,8,4.8);
    state.depth=numberIn(room.depth,2.5,7,4.2);
    state.height=numberIn(room.height,2.3,4,2.8);
    state.wall=/^#[0-9a-fA-F]{6}$/.test(room.wall)?room.wall:initial.wall;
    state.floor=['wood','stone','cement'].includes(room.floor)?room.floor:'wood';
    state.room=['living','bedroom','study'].includes(room.roomType)?room.roomType:'living';
    state.north=numberIn(room.north,0,345,initial.north);
    for(const [k,lo,hi] of [['sunHour',6,20],['daylight',0,100],['lampPower',0,100],['lightKelvin',2700,6500],['windowWidth',.8,2.4],['windowPosition',-70,70]])state[k]=numberIn(room[k],lo,hi,initial[k]);
    for(const [key,id] of [['sunHour','sun-hour'],['daylight','daylight-strength'],['lampPower','lamp-power'],['lightKelvin','light-kelvin'],['windowWidth','window-width'],['windowPosition','window-position']])$(id).value=state[key];
    ['width','depth','height'].forEach(k=>$(`room-${k}`).value=state[k]);
    document.querySelectorAll('#room-presets button').forEach(b=>b.classList.toggle('active',b.dataset.room===state.room));
    document.querySelectorAll('#floor-materials button').forEach(b=>b.classList.toggle('active',b.dataset.floor===state.floor));
    document.querySelectorAll('#wall-palette .swatch').forEach(b=>b.classList.toggle('selected',b.dataset.color.toLowerCase()===state.wall.toLowerCase()));
    $('north-degrees').value=state.north;
    removeItems();buildRoom();
    for(const obj of data.items.slice(0,100)){
      if(!shapeCatalog[obj?.type])continue;
      const item=addFurniture(obj.type,numberIn(obj.x,-4,4,0),numberIn(obj.z,-4,4,0),{
        quiet:true,rotation:numberIn(obj.rotation,0,359,0),scale:numberIn(obj.scale,.65,1.4,1)
      });
      item.widthScale=numberIn(obj.widthScale,.6,1.6,1);item.depthScale=numberIn(obj.depthScale,.6,1.6,1);
      applyItemScale(item);clampItem(item);
    }
    state.light=room.light==='warm'?'warm':'day';
    document.querySelectorAll('#light-modes button').forEach(b=>b.classList.toggle('active',b.dataset.light===state.light));
    if(data.flow){const f=data.flow;state.flowVisible=f.visible!==false;state.flowHeat=!!f.heat;state.flowSpeed=numberIn(f.speed,0,200,100);state.flowDensity=numberIn(f.density,60,360,180);state.flowMode=['qi','wuxing','route'].includes(f.mode)?f.mode:'qi';state.chosenBagua=numberIn(f.bagua,0,7,0);state.chosenElement=FIVE_ELEMENTS.some(e=>e.name===f.element)?f.element:'木';state.routeVisible=f.route!==false;}
    $('walkway-overlay').checked=state.routeVisible;
    syncFlowUI();rebuildFlow();updateCompass();updateSolarSimulation();refreshFurnitureList();refreshWalkway();
    document.querySelectorAll('input[type="range"]').forEach(updateRangeFill);
    if(!quiet)toast(`已导入方案（${state.items.length} 件设计元素）`);
  }finally{restoring=prior;}
}
function importProject(file){
  if(!file)return;
  if(file.size>2*1024*1024){toast('方案文件不能超过 2 MB');return;}
  file.text().then(raw=>{
    let data;try{data=JSON.parse(raw)}catch{throw new Error('无法解析 JSON 文件');}
    applyProjectData(data);checkpoint();
  }).catch(e=>{console.warn(e);toast(e.message||'导入失败');});
}
function saveScreenshot(){
  try{renderer.render(scene,camera);renderer.domElement.toBlob(b=>{if(b){saveBlob(b,'栖序-3D空间效果图.png','image/png');toast('效果图已保存')}else toast('截图失败，请稍后重试')},'image/png')}catch(e){console.error(e);toast('截图未成功，请检查浏览器权限')}
}
const patterns={
  living:[
    {sofa:[0,-.29,0],table:[0,.05,0],rug:[0,.11,0],cabinet:[-.36,.32,90],plant:[.37,-.31,0],lamp:[.35,.31,0]},
    {sofa:[-.20,-.27,0],table:[-.16,.06,0],rug:[-.06,.12,0],cabinet:[.32,.30,0],plant:[.38,-.32,0],lamp:[-.39,.3,0]},
    {sofa:[-.29,-.08,90],table:[.01,.04,0],rug:[.06,.05,0],cabinet:[.32,.28,90],plant:[.36,-.32,0],lamp:[-.36,-.31,0]}
  ],
  bedroom:[
    {bed:[.07,-.13,0],rug:[.15,.20,0],cabinet:[-.36,.31,90],plant:[-.34,-.3,0],lamp:[.34,-.3,0]},
    {bed:[-.20,-.12,0],rug:[.14,.25,0],cabinet:[.33,.29,90],plant:[-.38,-.29,0],lamp:[.36,-.25,0]},
    {bed:[.03,-.09,90],rug:[.05,.28,0],cabinet:[-.32,.33,0],plant:[.34,-.31,0],lamp:[-.36,-.30,0]}
  ],
  study:[
    {desk:[0,-.35,0],chair:[0,-.12,0],rug:[.1,.25,0],cabinet:[-.35,.31,90],plant:[.37,-.3,0],lamp:[.33,.29,0]},
    {desk:[-.32,-.24,90],chair:[-.10,-.24,90],rug:[.12,.2,0],cabinet:[.30,.29,0],plant:[.34,-.32,0],lamp:[-.31,.31,0]},
    {desk:[.20,-.30,0],chair:[.20,-.10,0],rug:[-.10,.17,0],cabinet:[-.34,.29,90],plant:[.37,.33,0],lamp:[-.36,-.31,0]}
  ]
};
function selectLayoutButton(n){document.querySelectorAll('#layout-variants button').forEach(b=>b.classList.toggle('active',Number(b.dataset.layout)===n))}
function applyArrangement(n,quiet=false){
  state.layoutIteration=n;const pattern=patterns[state.room][n]||patterns[state.room][0];
  const seen=new Set();
  for(const item of state.items){if(seen.has(item.type))continue;seen.add(item.type);
    const p=pattern[item.type];if(!p)continue;
    item.group.position.x=p[0]*state.width;item.group.position.z=p[1]*state.depth;
    item.rotation=p[2];item.group.rotation.y=rad(item.rotation);clampItem(item);
  }
  selectLayoutButton(n);updateSelection();updateGuidance();
  if(!quiet)toast(['已应用通透动线布局','已应用靠墙参考布局','已应用交流围合布局'][n]);
}
function shuffledLayout(){applyArrangement((state.layoutIteration+1)%3)}

function readPhoto(file){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('请上传 JPG、PNG 或 WebP 照片');return}
  if(file.size>15*1024*1024){toast('图片请小于 15 MB');return}
  const objectURL=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    // Main-thread pixel sampling: color extraction only, no fictional depth inference.
    const cn=document.createElement('canvas'),cw=96,ch=Math.max(32,Math.round(96*img.naturalHeight/img.naturalWidth));
    cn.width=cw;cn.height=ch;const ctx=cn.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,cw,ch);
    const image=ctx.getImageData(0,0,cw,ch).data;
    const mean=(a,b)=>{let r=0,g=0,bl=0,count=0;for(let y=Math.floor(a*ch);y<Math.ceil(b*ch);y+=2)for(let x=0;x<cw;x+=2){const k=(y*cw+x)*4;r+=image[k];g+=image[k+1];bl+=image[k+2];count++}return [r/count,g/count,bl/count]};
    const top=mean(.04,.43),bottom=mean(.6,.94);
    const normalize=([r,g,b],minimum=.69)=>{
      let c=new THREE.Color(`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
      const col=new THREE.Color(c);
      col.lerp(new THREE.Color('#F5F0E6'),.56);
      const hsl={};col.getHSL(hsl);hsl.l=Math.max(minimum,Math.min(.90,hsl.l));hsl.s=Math.min(.21,hsl.s);col.setHSL(hsl.h,hsl.s,hsl.l);
      return `#${col.getHexString()}`;
    };
    const picked=normalize(top);
    state.wall=picked;state.hasPhoto=true;
    $('analysis-card').hidden=false;
    $('photo-preview').hidden=false;
    $('photo-preview').style.backgroundImage=`url('${objectURL}')`;
    $('upload-main').textContent='更换空间照片';$('upload-help').textContent=`${file.name.slice(0,26)} · ${(file.size/1024/1024).toFixed(1)} MB`;
    const palette=$('palette-swatches');palette.replaceChildren();
    for(const c of [picked,normalize(bottom,.58),'#d5bfa0','#a8b6a4']){const sw=el('i');sw.style.background=c;palette.append(sw)}
    // Avoid race when uploading multiple images; the old texture is disposed after swapping.
    const oldTexture=photoTexture;
    photoTexture=new THREE.Texture(img);photoTexture.colorSpace=THREE.SRGBColorSpace;photoTexture.needsUpdate=true;
    oldTexture?.dispose();
    $('photo-map').disabled=false;state.photoMapped=true;$('photo-map').checked=true;
    document.querySelectorAll('#wall-palette .swatch').forEach(e=>e.classList.remove('selected'));
    updateRoomMaterials();
    toast('照片已导入：提取配色，并创建可编辑的三维参考房间');
    checkpoint();
    // Keep URL for preview; release previous URLs in the next browser session.
  };
  img.onerror=()=>{URL.revokeObjectURL(objectURL);toast('无法解析图片，请更换照片')};
  img.src=objectURL;
}

function setupEvents(){
  for(const i of catalog){const button=el('button','catalog-item');button.type='button';button.innerHTML=`<span class="catalog-icon">${i.icon}</span><span>${i.name}</span>`;
    button.title=`添加${i.name}`;button.addEventListener('click',()=>addFurniture(i.type,0,.20));$('catalog').append(button)}
  for(const id of ['room-width','room-depth','room-height']){
    $(id).addEventListener('input',()=>{state[id.replace('room-','')]=Number($(id).value);buildRoom();updateRangeFill($(id))});
  }
  document.querySelectorAll('#room-presets button').forEach(b=>b.addEventListener('click',()=>resetPreset(b.dataset.room)));
  document.querySelectorAll('#wall-palette .swatch').forEach(b=>b.addEventListener('click',()=>{
    state.wall=b.dataset.color;document.querySelectorAll('#wall-palette .swatch').forEach(s=>s.classList.toggle('selected',s===b));
    buildRoom();
  }));
  document.querySelectorAll('#floor-materials button').forEach(b=>b.addEventListener('click',()=>{
    state.floor=b.dataset.floor;document.querySelectorAll('#floor-materials button').forEach(s=>s.classList.toggle('active',s===b));buildRoom();
  }));
  document.querySelectorAll('#light-modes button').forEach(b=>b.addEventListener('click',()=>setLight(b.dataset.light)));
  $('sun-hour').addEventListener('input',e=>{state.sunHour=Number(e.target.value);if(state.sunHour<18)state.light='day';document.querySelectorAll('#light-modes button').forEach(b=>b.classList.toggle('active',b.dataset.light===state.light));updateSolarSimulation();updateRangeFill(e.target)});
  document.querySelectorAll('#quick-times button').forEach(b=>b.addEventListener('click',()=>{$('sun-hour').value=b.dataset.hour;$('sun-hour').dispatchEvent(new Event('input'))}));
  for(const [id,key] of [['daylight-strength','daylight'],['lamp-power','lampPower'],['light-kelvin','lightKelvin']])$(id).addEventListener('input',e=>{state[key]=Number(e.target.value);updateSolarSimulation();updateRangeFill(e.target)});
  for(const [id,key] of [['window-width','windowWidth'],['window-position','windowPosition']])$(id).addEventListener('input',e=>{state[key]=Number(e.target.value);buildRoom();updateRangeFill(e.target)});
  document.querySelectorAll('#layout-variants button').forEach(b=>b.addEventListener('click',()=>applyArrangement(Number(b.dataset.layout))));
  document.querySelectorAll('#view-buttons button').forEach(b=>b.addEventListener('click',()=>setCameraView(b.dataset.view)));
  $('unfold-walls').addEventListener('change',e=>{state.unfolded=e.target.checked;updateWallFolds()});
  $('feng-overlay').addEventListener('change',e=>{state.overlays=e.target.checked;fengGroup.visible=state.overlays});  $('flow-overlay').addEventListener('change',e=>{state.flowVisible=e.target.checked;syncFlowUI()});
  $('flow-heat').addEventListener('change',e=>{state.flowHeat=e.target.checked;syncFlowUI();refreshFlowHeat()});
  $('flow-speed').addEventListener('input',e=>{state.flowSpeed=Number(e.target.value);syncFlowUI()});
  $('flow-density').addEventListener('input',e=>{state.flowDensity=Number(e.target.value);rebuildFlow();syncFlowUI()});
  document.querySelectorAll('#flow-modes button').forEach(b=>b.addEventListener('click',()=>{state.flowMode=b.dataset.flowMode;syncFlowUI();rebuildFlow()}));
  $('sun-overlay').addEventListener('change',e=>{state.sunOverlay=e.target.checked;if(daylightGroup)daylightGroup.visible=state.sunOverlay&&state.light==='day'});
  $('snap-grid').addEventListener('change',e=>{state.snap=e.target.checked});
  $('show-grid').addEventListener('change',e=>{state.grid=e.target.checked;gridMesh.visible=state.grid});
  $('photo-map').addEventListener('change',e=>{state.photoMapped=e.target.checked;if(photoMesh)photoMesh.visible=state.photoMapped});
  for(const id of ['object-x','object-z','object-rotation','object-scale','object-width','object-depth'])$(id).addEventListener('input',setItemTransform);
  $('delete-object').addEventListener('click',deleteSelected);
  $('duplicate-object').addEventListener('click',duplicateSelected);
  $('rotate-object').addEventListener('click',()=>{if(!state.selected)return;state.selected.rotation=(state.selected.rotation+45)%360;state.selected.group.rotation.y=rad(state.selected.rotation);clampItem(state.selected);updateSelection()});
  $('north-degrees').addEventListener('input',e=>{state.north=Number(e.target.value);updateCompass();updateRangeFill(e.target)});
  document.querySelectorAll('#feng-tabs button').forEach(b=>b.addEventListener('click',()=>{
    state.fengTab=b.dataset.feng;document.querySelectorAll('#feng-tabs button').forEach(t=>t.classList.toggle('active',t===b));updateGuidance();
  }));
  $('undo-edit').addEventListener('click',()=>navigateHistory(-1));
  $('redo-edit').addEventListener('click',()=>navigateHistory(1));
  $('walkway-overlay').addEventListener('change',e=>{state.routeVisible=e.target.checked;if(walkLine)walkLine.visible=state.routeVisible;});
  $('export-project').addEventListener('click',saveProject);
  $('import-project').addEventListener('click',()=>$('project-file').click());
  $('project-file').addEventListener('change',e=>{importProject(e.target.files?.[0]);e.target.value=''});
  $('save-image').addEventListener('click',saveScreenshot);
  $('reset-scene').addEventListener('click',()=>resetPreset(state.room));
  $('shuffle-layout').addEventListener('click',shuffledLayout);
  $('photo-input').addEventListener('change',e=>{readPhoto(e.target.files?.[0]);e.target.value=''});
  const dz=$('dropzone');
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('dragging')});
  dz.addEventListener('dragleave',()=>dz.classList.remove('dragging'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('dragging');readPhoto(e.dataTransfer.files?.[0])});
  renderer.domElement.addEventListener('pointerdown',onPointerDown);
  renderer.domElement.addEventListener('pointermove',onPointerMove);
  renderer.domElement.addEventListener('pointerup',onPointerUp);
  renderer.domElement.addEventListener('pointercancel',onPointerUp);
  window.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName?.toLowerCase();if(['input','textarea'].includes(tag))return;
    if(e.key==='Delete'||e.key==='Backspace'){if(state.selected){e.preventDefault();deleteSelected()}}
    if(e.key.toLowerCase()==='r'&&state.selected){state.selected.rotation=(state.selected.rotation+15)%360;state.selected.group.rotation.y=rad(state.selected.rotation);clampItem(state.selected);updateSelection()}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(delta&&state.selected){e.preventDefault();const step=e.shiftKey?.02:.10;
      state.selected.group.position.x+=delta[0]*step;state.selected.group.position.z+=delta[1]*step;
      clampItem(state.selected);updateSelection();}
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();navigateHistory(e.shiftKey?1:-1);return;}
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='y'){e.preventDefault();navigateHistory(1);return;}
    if(e.key==='Escape')selectItem(null);
  });
  document.querySelectorAll('input[type="range"]').forEach(updateRangeFill);
  setupFengKnowledge();syncFlowUI();
  // Checkpoints occur at completed actions: sliders are saved on release,
  // drag movement only on pointer-up, keyboard nudges after the key handler.
  document.addEventListener('change',e=>{if(e.target.matches('input,select'))checkpoint();});
  document.addEventListener('click',e=>{
    if(e.target.closest('button:not(#undo-edit):not(#redo-edit):not(#export-project):not(#import-project), .furniture-row'))checkpoint();
  });
  renderer.domElement.addEventListener('pointerup',()=>{if(!restoring)checkpoint();});
  window.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','r','R','Delete','Backspace'].includes(e.key))checkpoint();});
}



// Decorative three-dimensional flow field. It is not a real wind or magnetic field.
function flowObstacles(){return state.items.filter(i=>!['rug','lamp','mirror'].includes(i.type)).map(i=>{const f=footprint(i);return {x:i.group.position.x,z:i.group.position.z,w:f.ex*2,d:f.ez*2};});}
function flowRoom(){return {width:state.width,depth:state.depth,windowX:windowBounds?.x||0};}
function flowColor(x,z){
  if(state.flowMode==='route')return new THREE.Color('#83C7C0');
  if(state.flowMode==='wuxing')return new THREE.Color(BAGUA[Math.round(((Math.atan2(x,-z)*180/Math.PI-state.north+720)%360)/45)%8].color);
  const a=(z/state.depth+.5);
  return new THREE.Color(a<.45?'#8BD5C7':'#C2B68E');
}
function releaseFlow(){
  if(!flowGroup)return;
  scene.remove(flowGroup);
  flowGroup.traverse(o=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});
  flowGroup=null;flowParticles=null;flowLines=null;flowHeatPlane=null;
}
function rebuildFlow(){
  if(!scene||!windowBounds)return;
  releaseFlow();
  flowGroup=new THREE.Group();flowGroup.name='cultural-flow-not-measured';scene.add(flowGroup);
  const N=Math.max(60,Math.min(360,state.flowDensity));
  flowPositions=new Float32Array(N*3);flowColors=new Float32Array(N*3);
  flowLinePositions=new Float32Array(N*6);flowSeeds=[];
  const room=flowRoom();
  for(let i=0;i<N;i++){
    const fraction=((i*0.61803398875)+.37)%1;
    const x=(fraction-.5)*room.width*.87;
    const z=(((i*.75487766)+.1)%1-.5)*room.depth*.89;
    flowSeeds.push({x,z,y:.19+((i*.436897)+.13)%1*1.12,phase:(i*.2175)%1});
    flowPositions[i*3]=x;flowPositions[i*3+1]=flowSeeds[i].y;flowPositions[i*3+2]=z;
    const c=flowColor(x,z);c.toArray(flowColors,i*3);
    flowLinePositions.set([x,flowSeeds[i].y,z,x,flowSeeds[i].y,z],i*6);
  }
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(flowPositions,3).setUsage(THREE.DynamicDrawUsage));geom.setAttribute('color',new THREE.BufferAttribute(flowColors,3).setUsage(THREE.DynamicDrawUsage));
  flowParticles=new THREE.Points(geom,new THREE.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.9,sizeAttenuation:true,depthWrite:false,blending:THREE.NormalBlending}));
  flowParticles.frustumCulled=false;flowGroup.add(flowParticles);
  const linesGeom=new THREE.BufferGeometry();linesGeom.setAttribute('position',new THREE.BufferAttribute(flowLinePositions,3).setUsage(THREE.DynamicDrawUsage));
  flowLines=new THREE.LineSegments(linesGeom,new THREE.LineBasicMaterial({color:'#88AEA0',transparent:true,opacity:.25,depthWrite:false}));flowLines.frustumCulled=false;flowGroup.add(flowLines);
  buildFlowHeat();refreshWalkway();syncFlowUI();
}
function buildFlowHeat(){
  if(flowHeatPlane){flowGroup.remove(flowHeatPlane);flowHeatPlane.geometry.dispose();flowHeatPlane.material.dispose();flowHeatPlane=null;}
  const cols=36,rows=30,W=state.width,D=state.depth;
  const geo=new THREE.PlaneGeometry(W,D,cols,rows);geo.rotateX(-Math.PI/2);
  const colors=[];
  const pos=geo.attributes.position;
  const obstacles=flowObstacles();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),d=Math.hypot(x,z);
    const at=flowColor(x,z);
    let strength=.15+.45*(1-Math.min(1,d/Math.max(W,D)));
    for(const o of obstacles){const q=((x-o.x)/Math.max(.3,o.w*.62))**2+((z-o.z)/Math.max(.3,o.d*.62))**2;strength-=.34*Math.exp(-q);}
    at.multiplyScalar(.68+Math.max(0,strength)*.32);colors.push(at.r,at.g,at.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.30,depthWrite:false});
  flowHeatPlane=new THREE.Mesh(geo,mat);flowHeatPlane.position.y=.041;flowHeatPlane.visible=state.flowVisible&&state.flowHeat;flowHeatPlane.name='artistic-direction-heatmap';flowGroup.add(flowHeatPlane);
}
function refreshFlowHeat(){if(flowGroup)buildFlowHeat();refreshWalkway();}
function routeObstacles(){
  return state.items.map(item=>{
    const f=footprint(item);
    return {type:item.type,x:item.group.position.x,z:item.group.position.z,w:f.w,d:f.d,rotation:item.rotation};
  });
}
function refreshWalkway(){
  if(!scene||!windowBounds)return;
  if(walkLine){scene.remove(walkLine);walkLine.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()});walkLine=null;}
  const route=findWalkway({width:state.width,depth:state.depth,windowX:windowBounds.x},routeObstacles(),{clearance:.20});
  const free=calculateClearanceRatio({width:state.width,depth:state.depth},routeObstacles());
  const node=$('walkway-result');
  if(node){
    node.classList.toggle('warning',!route.ok);
    node.textContent=route.ok?`示意动线畅通 · 约 ${route.length.toFixed(1)} m · 可用地面 ${free}%`:`入口到窗侧通行受阻 · 可用地面 ${free}% · 试着移动家具`;
  }
  if(!route.ok||!route.points.length)return;
  const pts=route.points.map(p=>new THREE.Vector3(p.x,.083,p.z));
  if(pts.length===1)return;
  walkLine=new THREE.Group();walkLine.name='illustrative-walkway-not-egress';
  const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal',.35);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(16,pts.length*4),.028,5,false),new THREE.MeshBasicMaterial({color:0x2C9C9C,transparent:true,opacity:.92,depthWrite:false}));
  walkLine.add(tube);
  for(const point of [pts[0],pts[pts.length-1]]){
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:0x2C9C9C}));marker.position.copy(point);walkLine.add(marker);
  }
  walkLine.visible=state.routeVisible;
  scene.add(walkLine);
}
function animateFlow(dt){
  flowGroup.visible=state.flowVisible;
  if(!state.flowVisible||!flowParticles||dt===0||state.flowSpeed===0)return;
  const room=flowRoom(),obstacles=flowObstacles(),N=flowSeeds.length;
  const speed=dt*state.flowSpeed/100*.72;
  for(let i=0;i<N;i++){
    const p=flowSeeds[i];const x0=p.x,z0=p.z;
    const v=fieldVector(p.x,p.z,room,obstacles);
    p.x+=v.x*speed;p.z+=v.z*speed;
    // Fade-out/reset loop, with deterministic seeding to avoid jumping outside the room.
    if(p.z<-room.depth/2+.13||Math.abs(p.x)>room.width/2-.1){
      const u=((i*.61803398875)+performance.now()*.00013)%1;
      p.x=clamp(-room.width/2+Math.min(1,room.width*.22)+(u-.5)*room.width*.85,-room.width/2+.14,room.width/2-.14);
      p.z=room.depth/2-.16-(u*.7);
    }
    const y=p.y+Math.sin(performance.now()*.0006+i*.9)*.03;
    flowPositions.set([p.x,y,p.z],i*3);
    flowLinePositions.set([x0,y,z0,p.x,y,p.z],i*6);
    flowColor(p.x,p.z).toArray(flowColors,i*3);
  }
  flowParticles.geometry.attributes.position.needsUpdate=true;
  flowParticles.geometry.attributes.color.needsUpdate=true;
  flowLines.geometry.attributes.position.needsUpdate=true;
}
function syncFlowUI(){
  $('flow-overlay').checked=state.flowVisible;$('flow-heat').checked=state.flowHeat;
  $('flow-speed').value=state.flowSpeed;$('flow-density').value=state.flowDensity;
  $('flow-speed-output').textContent=(state.flowSpeed/100).toFixed(1)+'×';
  $('flow-density-output').textContent=state.flowDensity+' 个';
  document.querySelectorAll('#flow-modes button').forEach(b=>b.classList.toggle('active',b.dataset.flowMode===state.flowMode));
  $('field-visual-indicator').classList.toggle('off',!state.flowVisible);
  if(flowGroup)flowGroup.visible=state.flowVisible;
  if(flowHeatPlane)flowHeatPlane.visible=state.flowVisible&&state.flowHeat;
  updateRangeFill($('flow-speed'));updateRangeFill($('flow-density'));
}
function setupFengKnowledge(){
  const root=$('bagua-selector');root.replaceChildren();
  BAGUA.forEach((d,i)=>{
    const button=el('button','');button.type='button';button.dataset.bagua=String(i);
    const symbol=el('b','',d.glyph),label=el('small','',d.direction+' · '+d.trigram);
    button.append(symbol,label);button.addEventListener('click',()=>{state.chosenBagua=i;state.overlays=true;$('feng-overlay').checked=true;if(fengGroup){fengGroup.visible=true;for(let j=0;j<8;j++){const wedge=fengGroup.children[j*2];if(wedge?.material)wedge.material.opacity=j===i?.42:.12;}}updateBaguaKnowledge()});root.append(button);
  });
  const eroot=$('element-selector');eroot.replaceChildren();
  FIVE_ELEMENTS.forEach(d=>{const button=el('button','',d.name);button.type='button';button.dataset.element=d.name;
    button.addEventListener('click',()=>{state.chosenElement=d.name;updateElementKnowledge();});eroot.append(button)});
  updateBaguaKnowledge();updateElementKnowledge();updateRoomKnowledge();
}
function updateBaguaKnowledge(){
  const chosen=BAGUA[state.chosenBagua]||BAGUA[0];
  document.querySelectorAll('#bagua-selector button').forEach(b=>b.classList.toggle('active',Number(b.dataset.bagua)===state.chosenBagua));
  const root=$('bagua-detail');root.replaceChildren();
  const head=el('div','detail-head');head.append(el('h4','',chosen.glyph+' '+chosen.direction+' · '+chosen.trigram+'卦'),el('span','tag',chosen.element+' · '+chosen.image));root.append(head);  root.append(el('p','',chosen.meaning),el('p','',chosen.placement),el('p','safety','现实提醒：'+chosen.tip));
}
function updateElementKnowledge(){
  const d=FIVE_ELEMENTS.find(x=>x.name===state.chosenElement)||FIVE_ELEMENTS[0];
  document.querySelectorAll('#element-selector button').forEach(b=>b.classList.toggle('active',b.dataset.element===d.name));
  const root=$('element-detail');root.replaceChildren();
  root.append(el('b','',`${d.name} · ${d.feature}`),el('div','',`视觉设计例子：${d.examples}`));
  const partners=SHENG.filter(pair=>pair[0]===d.name).map(pair=>pair[1]);
  const restrain=KE.filter(pair=>pair[0]===d.name).map(pair=>pair[1]);
  root.append(el('div','relations',`传统五行：${d.name}生${partners[0]}、${d.name}克${restrain[0]}（象征关系，不是设计结果预测）`));
  root.append(el('div','',`实用提醒：${d.care}`));
}
function updateRoomKnowledge(){
  const key=state.room;
  if(key===knowledgeCache)return;
  knowledgeCache=key;
  const node=$('knowledge-list');node.replaceChildren();
  const list=[...(roomTips[key]||[]),
    ['后天八卦与先天八卦','本工具展示常见后天八卦的方位对应：坎北、离南、震东、兑西、巽东南、乾西北、坤西南、艮东北。不同流派与应用不应简单混用。'],
    ['五行的相生相克','传统相生：木→火→土→金→水→木；相克：木→土→水→火→金→木。用于帮助理解文化符号，不代表物理作用机制。'],
    ['九宫与飞星流派','九宫是另一种空间划分方式；飞星、择日等流派需要更完整的建筑方向和年代信息，本实验室不自动推断吉凶。'],
    ['为什么不是地磁场','地磁场需使用磁场传感器与标定设备测量。屏幕上的粒子轨迹只是人为设定的演示模型，不能用于健康、安全或吉凶判断。']];
  for(const [title,body] of list){const details=el('details','');details.append(el('summary','',title),el('p','',body));node.append(details)}
}

function animate(now=0){
  requestAnimationFrame(animate);
  const dt=Math.min(.04,Math.max(0,(now-frameLast)/1000));frameLast=now;
  if(flowGroup)animateFlow(dt);
  if(cameraTween){
    cameraTween.t=Math.min(1,cameraTween.t+.055);
    const a=1-Math.pow(1-cameraTween.t,3);
    camera.position.lerpVectors(cameraTween.start,cameraTween.end,a);
    orbit.target.lerpVectors(cameraTween.startTarget,cameraTween.endTarget,a);
    if(cameraTween.t>=1)cameraTween=null;
  }
  for(const w of wallParts){if(w.goal===undefined)continue;
    w.hinge.rotation[w.foldAxis]+=(w.goal-w.hinge.rotation[w.foldAxis])*.16;
    if(Math.abs(w.goal-w.hinge.rotation[w.foldAxis])<.001){w.hinge.rotation[w.foldAxis]=w.goal;delete w.goal}
  }
  orbit.update();renderer.render(scene,camera);
}
function boot(){
  scene=new THREE.Scene();scene.background=new THREE.Color('#eff0ea');scene.fog=new THREE.Fog('#eff0ea',12,29);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  $('viewport').prepend(renderer.domElement);
  const width=$('viewport').clientWidth,height=$('viewport').clientHeight;
  camera=new THREE.PerspectiveCamera(42,width/height,.1,100);camera.position.set(7.2,5.9,8.4);
  orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.48,0);
  orbit.enableDamping=true;orbit.dampingFactor=.09;
  orbit.minDistance=3.5;orbit.maxDistance=18;
  orbit.minPolarAngle=.1;orbit.maxPolarAngle=Math.PI*.49;
  orbit.screenSpacePanning=false;orbit.enablePan=true;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),material('#E8EAE4',.96));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.16;floor.receiveShadow=true;scene.add(floor);foregroundFloor=floor;
  makeLights();buildRoom();resetPreset('living',true);setupEvents();updateCompass();setLight('day');
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved){applyProjectData(JSON.parse(saved),{quiet:true});$('save-notice').textContent='已恢复上次本地方案';}
  }catch(e){console.warn('Unable to restore local project:',e);$('save-notice').textContent='未恢复旧方案 · 可导入 JSON';}
  checkpoint();
  window.addEventListener('pagehide',()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(projectSnapshot()))}catch{}});

  const resize=()=>{const w=$('viewport').clientWidth,h=$('viewport').clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
  resize();new ResizeObserver(resize).observe($('viewport'));
  $('scene-loading').hidden=true;
  animate();
}
try{boot()}catch(err){console.error(err);$('scene-loading').hidden=true;$('fatal').hidden=false;}