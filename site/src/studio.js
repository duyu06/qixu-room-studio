import * as THREE from 'three';
import {createProceduralFurniture} from './studio-procedural-furniture.js';
import {floorMaterial,wallMaterial} from './studio-materials.js';
import {makeAirflowOverlay} from './studio-airflow.js';
import {snapFurniture} from './studio-alignment.js';
import {evaluateVentilation} from './studio-flow-model.js';
import {buildCfdJob} from './studio-cfd-job.js';
import {cfdSurfaceStl} from './studio-cfd-stl.js';
import {projectStorageKey,PERSONAL_PROJECT_KEY} from './qixu-routes.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {calculateRooms,materialTakeoff,furnitureDiagnostics,suggestLayout} from './studio-geometry.js';
import {parseDxf,exportDxf} from './studio-dxf.js';
import {canWalkAt,findWalkStart} from './studio-tour.js';
import {SHOWCASE_TEMPLATES,makeShowcaseTemplate} from './showcase-templates.js';
import {FURNITURE,createProject,validateProject,snapPosition,nearestWall,addWall,
  addOpening,wallPieces,length,interpolated,deleteObject,addFurniture,
  importLegacy,clamp,setOpeningDimension} from './studio-model.js';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const selectedTemplate=new URLSearchParams(location.search).get('template');
const demoInfo=SHOWCASE_TEMPLATES.find(x=>x.slug===selectedTemplate);
const STORE=projectStorageKey(demoInfo?.slug);
let demoXray=Boolean(demoInfo);
const svg=$('plan-svg'),world=$('world'),preview=$('preview-layer');
let doc=createProject(),selection=null,tool='select',view='2d',zoom=1;
let history=[],future=[],anchor=null,current=null,drag=null,alignmentGuides=[];
let scene,renderer,camera,orbit,content,ready=false,toastTimer;
let lastSceneKey=null,lastStructureKey=null,sceneRebuilds=0;
const furnitureMeshes=new Map();
let airflowOverlay=null,airflowEnabled=false,airflowSpeed=1,placingWindSource=false;
const glbLoader=new GLTFLoader();
let sceneEpoch=0;
function attachGlb(entry,item){
 if(!item.modelData)return;
 const epoch=sceneEpoch,modelKey=item.modelData;
 try{
  const raw=atob(modelKey.split(',')[1]);const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  glbLoader.parse(bytes.buffer,'',gltf=>{
   if(epoch!==sceneEpoch||!entry.group.parent)return;
   const root=gltf.scene;const box=new THREE.Box3().setFromObject(root);
   const size=box.getSize(new THREE.Vector3());
   if(!Number.isFinite(size.x+size.y+size.z)||size.x<.0001||size.z<.0001){notify('GLB 模型尺寸无效');return;}
   root.position.sub(box.getCenter(new THREE.Vector3()));
   root.scale.set(item.width/size.x,item.height/Math.max(size.y,.001),item.depth/size.z);
   root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   entry.group.clear();entry.group.add(root);entry.externalGlb=true;
   $('three-viewport').dataset.glbLoaded=String(Number($('three-viewport').dataset.glbLoaded||0)+1);
  },err=>notify('GLB 解析失败：'+err.message));
 }catch(err){notify('GLB 读取失败：'+err.message);}
}

let touring=false,walkYaw=0,walkPitch=0,mouseTurn=null,lastFrame=0;
const walkPressed=new Set();
const copy=()=>structuredClone(doc);
const el=(tag,attrs={},text)=>{
  const a=document.createElementNS(ns,tag);
  Object.entries(attrs).forEach(([key,value])=>a.setAttribute(key,String(value)));
  if(text!==undefined)a.textContent=text;
  return a;
};
const line=(x1,y1,x2,y2,attrs)=>el('line',{x1,y1,x2,y2,...attrs});
const notify=(message)=>{
 const t=$('toast');t.textContent=message;t.classList.add('show');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
};
const stat=message=>$('status-text').textContent=message;
function save(){
 try{localStorage.setItem(STORE,JSON.stringify(doc));$('save-state').textContent='已保存在此浏览器';}
 catch(e){$('save-state').textContent='⚠ 保存失败';notify('保存失败，请下载 JSON 备份');}
}
function refresh(){
 $('project-title').value=doc.title;
 const takeoff=materialTakeoff(doc);
 $('studio-room-summary').textContent=takeoff.rooms.length+' 个闭合空间 · '+takeoff.totalFloorAreaM2.toFixed(2)+' ㎡ · 墙体净面积 '+takeoff.netWallAreaM2.toFixed(2)+' ㎡';
 const issues=furnitureDiagnostics(doc);
 if(issues.length)stat('⚠ '+issues.length+' 处家具重叠/墙体碰撞，请检查高亮家具');
 $('geometry-stats').textContent=doc.walls.length+' 段墙 · '+doc.openings.length+' 个门窗 · '+doc.furniture.length+' 件家具';
 $('undo').disabled=!history.length;$('redo').disabled=!future.length;
 draw();inspect();if(ready){renderThree();window.qixuSetLighting?.(doc.lightingMode||'day');}
 $('texture-repeat').value=doc.textureRepeat??3;
 $('airflow-source').value=doc.airflowSource||'opening';$('airflow-source-x').value=doc.airflowX??0;$('airflow-source-z').value=doc.airflowZ??0;$('airflow-spread').value=doc.airflowSpread??1.5;
 $('flow-pressure').value=doc.flowPressurePa??5;$('flow-inlet').value=(doc.flowInlet??1)*100;$('flow-outlet').value=(doc.flowOutlet??1)*100;
 showFlowEstimate();save();
}
function change(fn){
 const old=copy();
 try{fn();const error=validateProject(doc);if(error)throw Error(error);}
 catch(e){doc=old;notify(e.message);stat('操作取消：'+e.message);return false;}
 history.push(old);if(history.length>50)history.shift();future=[];refresh();return true;
}
function goBack(){if(!history.length)return;future.push(copy());doc=history.pop();selection=null;anchor=null;refresh();}
function goForward(){if(!future.length)return;history.push(copy());doc=future.pop();selection=null;anchor=null;refresh();}
function useDoc(next,message){
 const error=validateProject(next);if(error)throw Error(error);
 doc=structuredClone(next);history=[];future=[];selection=null;anchor=null;zoom=1;refresh();fit();notify(message);
}
function toolMode(name){
 if(placingWindSource)finishWindPlacement(false);
 tool=name;anchor=null;
 document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
 const hints={select:'单击选择，拖动家具；V',wall:'先点起点，再点终点；Esc 取消',door:'点击一段墙添加真实门洞',
   window:'点击一段墙添加窗户'};
 $('interaction-hint').textContent=hints[name];stat(hints[name]);
 if(view==='3d'&&name!=='select')setView('2d');draw();
}
function finishWindPlacement(success=false){
 placingWindSource=false;
 svg.classList.remove('placing-wind-source');
 $('place-wind-source').setAttribute('aria-pressed','false');
 $('place-wind-source').classList.remove('active');
 $('cancel-wind-source').hidden=true;
 $('wind-placement-hint').textContent=success?'风源已设定，可调整参数并点击 3D 预览。':'点击「放置风源」，然后在 2D 户型图中选点。';
}
$('place-wind-source').addEventListener('click',()=>{
 placingWindSource=true;
 tool='select';anchor=null;drag=null;
 sidebar('simulation');setView('2d');
 svg.classList.add('placing-wind-source');
 $('place-wind-source').setAttribute('aria-pressed','true');
 $('place-wind-source').classList.add('active');
 $('cancel-wind-source').hidden=false;
 $('wind-placement-hint').textContent='放置模式：点击 2D 户型图设定气流起点，Esc 取消。';
 stat('在 2D 户型图内单击放置风源，Esc 取消');
});
$('cancel-wind-source').addEventListener('click',()=>finishWindPlacement(false));
$('preview-wind-3d').addEventListener('click',()=>{
 finishWindPlacement(false);sidebar('simulation');setView('3d');
 if(!$('airflow-toggle').checked)$('airflow-toggle').click();
});
function sidebar(name){
 document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
 document.querySelectorAll('[data-sidebar]').forEach(p=>p.hidden=p.dataset.sidebar!==name);
}
function fit(){
 zoom=1;draw();
 if(orbit){camera.position.set(doc.width*.88,Math.max(3.7,doc.depth*.66),doc.depth*1.7);
  orbit.target.set(0,.8,0);orbit.update();}
}
function screenPoint(e){
 const matrix=svg.getScreenCTM();
 if(!matrix)return null;
 const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
 return [p.x,p.y];
}
function draw(){
 const wide=(doc.width+2)/zoom,deep=(doc.depth+2)/zoom;
 svg.setAttribute('viewBox',[-wide/2,-deep/2,wide,deep].join(' '));
 world.replaceChildren();preview.replaceChildren();
 world.append(el('rect',{x:-doc.width/2-1,y:-doc.depth/2-1,width:doc.width+2,height:doc.depth+2,fill:'#f8fbf8'}));
 if($('show-grid').checked)world.append(el('rect',{x:-doc.width/2-1,y:-doc.depth/2-1,width:doc.width+2,height:doc.depth+2,fill:'url(#grid)'}));
 world.append(el('rect',{x:-doc.width/2,y:-doc.depth/2,width:doc.width,height:doc.depth,fill:doc.floor,stroke:'#d2d7d0','stroke-width':.04}));
 if(doc.reference)world.append(el('image',{x:-doc.width/2,y:-doc.depth/2,width:doc.width,height:doc.depth,href:doc.reference,opacity:.53,preserveAspectRatio:'none'}));
 const rooms=calculateRooms(doc.walls);
 rooms.forEach((room,i)=>{
   world.append(el('polygon',{points:room.polygon.map(p=>p.join(',')).join(' '),
     fill:i%2?'#65a58a':'#8ab7a1','fill-opacity':'.12','pointer-events':'none'}));
   world.append(el('text',{x:room.centroid[0],y:room.centroid[1],class:'room-label'},
     '区域 '+(i+1)+' · '+room.area.toFixed(1)+'㎡'));
 });
 const collisionIds=new Set(furnitureDiagnostics(doc).map(x=>x.id));
 for(const wall of doc.walls){
   const picked=selection?.id===wall.id;
   world.append(line(...wall.a,...wall.b,{class:'wall-base'+(picked?' selected':''),'stroke-width':doc.thickness}));
   world.append(line(...wall.a,...wall.b,{class:'wall-click','data-wall-id':wall.id}));
   if($('show-measures').checked){
     const mid=interpolated(wall,.5),L=length(wall),dx=wall.b[0]-wall.a[0],dy=wall.b[1]-wall.a[1];
     world.append(el('text',{x:mid[0]-dy/L*.27,y:mid[1]+dx/L*.27,class:'wall-label'},L.toFixed(2)+'m'));
   }
   if(picked)for(const which of ['a','b']){
     const v=wall[which];
     world.append(el('circle',{cx:v[0],cy:v[1],r:.13,class:'selection-dot wall-handle',
       'data-endpoint-wall':wall.id,'data-endpoint-side':which}));
   }
 }
 for(const o of doc.openings){
   const w=doc.walls.find(x=>x.id===o.wallId);if(!w)continue;
   const p=interpolated(w,o.t),L=length(w),dx=(w.b[0]-w.a[0])/L,dy=(w.b[1]-w.a[1])/L;
   const a=[p[0]-dx*o.width/2,p[1]-dy*o.width/2];
   const b=[p[0]+dx*o.width/2,p[1]+dy*o.width/2];
   world.append(line(...a,...b,{class:o.kind==='door'?'opening-door':'opening-window','data-opening-id':o.id,
     'stroke-width':Math.max(doc.thickness*1.4,.17)}));
   if(selection?.id===o.id)world.append(el('circle',{cx:p[0],cy:p[1],r:.11,class:'selection-dot'}));
 }
 for(const f of doc.furniture){
   const g=el('g',{transform:'translate('+f.x+' '+f.z+') rotate('+(f.rotation*180/Math.PI)+')',
     'data-furniture-id':f.id});
   g.append(el('rect',{x:-f.width/2,y:-f.depth/2,width:f.width,height:f.depth,rx:.06,
     class:'furniture-rect'+(selection?.id===f.id?' selected':'')+(collisionIds.has(f.id)?' collision':'')}));
   g.append(el('text',{x:0,y:.06,class:'furniture-label'},FURNITURE[f.type].label));
   if(selection?.id===f.id&&selection.kind==='furniture'){
     const handleY=-f.depth/2-.40;
     g.append(line(0,-f.depth/2,0,handleY+.11,{class:'rotation-guide','pointer-events':'none'}));
     g.append(el('circle',{cx:0,cy:handleY,r:.17,class:'rotation-handle',
       'data-rotate-id':f.id,'aria-label':'旋转家具','role':'button'}));
   }
   world.append(g);
 }
 if(doc.airflowSource==='custom'&&Number.isFinite(doc.airflowX)&&Number.isFinite(doc.airflowZ)){
   const x=doc.airflowX,z=doc.airflowZ;
   world.append(el('circle',{cx:x,cy:z,r:.23,class:'wind-source-marker','data-wind-source':'true','pointer-events':'none'}));
   world.append(el('path',{d:'M '+(x-.45)+' '+z+' L '+(x-.13)+' '+z+' M '+(x-.27)+' '+(z-.12)+' L '+(x-.13)+' '+z+' L '+(x-.27)+' '+(z+.12),
     class:'wind-source-arrow','pointer-events':'none'}));
   world.append(el('text',{x:x+.28,y:z-.25,class:'wind-source-label','pointer-events':'none'},'风源'));
 }
 if(alignmentGuides.length)for(const guide of alignmentGuides){
   const attrs={class:'alignment-guide','pointer-events':'none'};
   preview.append(guide.axis==='x'?line(guide.value,-doc.depth/2,guide.value,doc.depth/2,attrs):
     line(-doc.width/2,guide.value,doc.width/2,guide.value,attrs));
 }
 if(anchor&&current&&tool==='wall'){
   preview.append(line(...anchor,...current,{class:'preview-wall'}));
   preview.append(el('circle',{cx:anchor[0],cy:anchor[1],r:.1,fill:'#288862'}));
 }
 $('zoom-label').textContent=Math.round(zoom*100)+'%';
}
const field=(title,key,value,min,max,step=.1)=>
 '<label class="field">'+title+'<input type="number" data-prop="'+key+'" value="'+value+
 '" min="'+min+'" max="'+max+'" step="'+step+'"></label>';
function inspect(){
 const panel=$('property-body');let html='';
 if(!selection){
  html='<p class="props-intro">选择任意墙体、开口或家具，直接输入准确尺寸。</p><div class="label">整屋尺寸（米）</div>'+
  '<div class="props-grid">'+field('宽度','width',doc.width,3,100)+field('深度','depth',doc.depth,3,100)+'</div>'+
  '<div class="props-grid">'+field('墙高','wallHeight',doc.wallHeight,2,6)+field('墙厚','thickness',doc.thickness,.06,.6,.01)+'</div>'+
  '<p class="muted">当前户型为室内规划示意，不自动判定承重墙或建筑安全。</p>';
 }else if(selection.kind==='wall'){
  const w=doc.walls.find(x=>x.id===selection.id);if(!w){selection=null;return inspect();}
  html='<div class="label">实体墙</div>'+field('墙长（米）','wallLength',length(w).toFixed(2),.3,60)+
   '<p class="muted">调整长度时固定起点和墙体方向。</p><div class="props-actions"><button data-delete class="danger">删除墙体</button></div>';
 }else if(selection.kind==='opening'){
  const o=doc.openings.find(x=>x.id===selection.id);if(!o){selection=null;return inspect();}
  html='<div class="label">'+(o.kind==='door'?'门洞':'窗户')+'</div><div class="props-grid">'+
   field('宽度','openWidth',o.width,.45,10)+field('高度','openHeight',o.height,.3,4)+'</div>'+
   (o.kind==='window'?field('窗台高度','openSill',o.sill,0,4):'<p class="muted">门洞下缘固定在地面。</p>')+
   '<div class="props-actions"><button data-delete class="danger">删除门窗</button></div>';
 }else if(selection.kind==='furniture'){
  const f=doc.furniture.find(x=>x.id===selection.id);if(!f){selection=null;return inspect();}
  html='<div class="label">'+FURNITURE[f.type].label+'</div><div class="props-grid">'+
  field('X 坐标','x',f.x.toFixed(2),-100,100)+field('Z 坐标','z',f.z.toFixed(2),-100,100)+
  field('宽度','fWidth',f.width,.1,20)+field('深度','fDepth',f.depth,.1,20)+
  field('高度','fHeight',f.height,.01,20)+field('旋转度数','angle',(f.rotation*180/Math.PI).toFixed(1),-360,360,1)+
  '</div><div class="props-actions"><button data-duplicate>复制</button><button data-delete class="danger">删除</button></div>';
 }
 panel.innerHTML=html;
 for(const input of panel.querySelectorAll('[data-prop]'))input.addEventListener('change',()=>{
  const key=input.dataset.prop,val=Number(input.value);
  if(!Number.isFinite(val))return notify('请输入正确数字');
  change(()=>{
   if(!selection){doc[key]=val;return;}
   if(selection.kind==='furniture'){
    const f=doc.furniture.find(x=>x.id===selection.id),map={fWidth:'width',fDepth:'depth',fHeight:'height'};
    f[map[key]|| (key==='angle'?'rotation':key)]=key==='angle'?val*Math.PI/180:val;return;
   }
   if(selection.kind==='opening'){
    const o=doc.openings.find(x=>x.id===selection.id),map={openWidth:'width',openHeight:'height',openSill:'sill'};
    setOpeningDimension(doc,o,{[map[key]]:val});return;
   }
   if(selection.kind==='wall'&&key==='wallLength'){
    const w=doc.walls.find(x=>x.id===selection.id),old=length(w);
    w.b=[w.a[0]+(w.b[0]-w.a[0])*val/old,w.a[1]+(w.b[1]-w.a[1])*val/old];
    for(const o of doc.openings.filter(x=>x.wallId===w.id))
     if(o.t*val-o.width/2<.12||o.t*val+o.width/2>val-.12)throw Error('门窗超出缩短后的墙段');
   }
  });
 });
 for(const [selector,delta] of [['[data-rotate-left]',-Math.PI/2],['[data-rotate-right]',Math.PI/2]]){
  panel.querySelector(selector)?.addEventListener('click',()=>{
   const target=selection?.id;if(!target)return;
   change(()=>{const f=doc.furniture.find(x=>x.id===target);if(!f)throw Error('家具不存在');
     f.rotation=Math.atan2(Math.sin(f.rotation+delta),Math.cos(f.rotation+delta));});
  });
 }
 panel.querySelector('[data-delete]')?.addEventListener('click',()=>{
  const target=selection.id;change(()=>deleteObject(doc,target));selection=null;refresh();
 });
 panel.querySelector('[data-duplicate]')?.addEventListener('click',()=>{
  const f=doc.furniture.find(x=>x.id===selection.id);
  change(()=>{const n=addFurniture(doc,f.type);Object.assign(n,{x:f.x+.4,z:f.z+.4,
   width:f.width,depth:f.depth,height:f.height,rotation:f.rotation});selection={kind:'furniture',id:n.id};});
 });
}
function picked(kind,id){selection={kind,id};draw();inspect();$('three-viewport').dataset.selectedId=id;}
svg.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const p=screenPoint(e);if(!p)return;
 if(placingWindSource){
   if(Math.abs(p[0])>doc.width/2||Math.abs(p[1])>doc.depth/2){
     stat('请点击户型范围内的位置');e.preventDefault();return;
   }
   const ok=change(()=>{
     doc.airflowSource='custom';
     doc.airflowX=Number(p[0].toFixed(2));
     doc.airflowZ=Number(p[1].toFixed(2));
   });
   finishWindPlacement(ok);
   if(ok){sidebar('simulation');resetFlowOverlay();
     stat('风源已放置：X '+doc.airflowX.toFixed(2)+'m，Z '+doc.airflowZ.toFixed(2)+'m · 可切换 3D 查看');
   }
   e.preventDefault();return;
 }
 if(tool==='wall'){
  const q=snapPosition(p,doc,.1,{disable:e.altKey});
  if(anchor){const a=anchor;anchor=null;change(()=>{const w=addWall(doc,a,q);selection={kind:'wall',id:w.id};});}
  else {anchor=q;current=q;draw();stat('已选择起点，点击第二点完成墙体');}
  e.preventDefault();return;
 }
 const rotate=e.target.closest('[data-rotate-id]');
 if(rotate&&tool==='select'){
   const f=doc.furniture.find(x=>x.id===rotate.dataset.rotateId);
   if(f){
     selection={kind:'furniture',id:f.id};
     drag={type:'rotation',id:f.id,before:copy(),fromRotation:f.rotation,moved:false};
     try{svg.setPointerCapture(e.pointerId);}catch{}
     e.preventDefault();
   }
   return;
 }
 const endpoint=e.target.closest('[data-endpoint-wall]');
 if(endpoint && tool==='select'){
   const w=doc.walls.find(w=>w.id===endpoint.dataset.endpointWall);
   if(w){picked('wall',w.id);drag={type:'endpoint',id:w.id,side:endpoint.dataset.endpointSide,
     p,from:[...w[endpoint.dataset.endpointSide]],before:copy(),moved:false};
     try{svg.setPointerCapture(e.pointerId);}catch{}}
   return;
 }
 const furniture=e.target.closest('[data-furniture-id]');
 const opening=e.target.closest('[data-opening-id]');
 const wall=e.target.closest('[data-wall-id]');
 if(tool==='door'||tool==='window'){
  const wallId=wall?.dataset.wallId||doc.openings.find(x=>x.id===opening?.dataset.openingId)?.wallId;
  const near=nearestWall(doc,p);
  if(!near||near.distance>.48||near.wall.id!==wallId){notify('请点击墙体中心线');return;}
  if(change(()=>{const o=addOpening(doc,tool,wallId,near.t,tool==='door'?.9:1.25);
   selection={kind:'opening',id:o.id};}))notify('真实墙洞已创建，可在右侧编辑尺寸');
  e.preventDefault();return;
 }
 if(furniture){
  const f=doc.furniture.find(x=>x.id===furniture.dataset.furnitureId);
  if(f){picked('furniture',f.id);drag={id:f.id,before:copy(),p,from:[f.x,f.z],moved:false};
   try{svg.setPointerCapture(e.pointerId);}catch{}}
 }else if(opening)picked('opening',opening.dataset.openingId);
 else if(wall)picked('wall',wall.dataset.wallId);
 else{selection=null;draw();inspect();}
});
svg.addEventListener('pointermove',e=>{
 current=screenPoint(e);if(!current)return;
 if(tool==='wall'&&anchor){current=snapPosition(current,doc,.1,{disable:e.altKey});draw();return;}
 if(!drag)return;
 if(drag.type==='rotation'){
   const f=doc.furniture.find(x=>x.id===drag.id);if(!f)return;
   const dx=current[0]-f.x,dy=current[1]-f.z;
   if(Math.hypot(dx,dy)<.1)return;
   let angle=Math.atan2(dy,dx)+Math.PI/2;
   if(!e.altKey){
     const step=(e.shiftKey?15:5)*Math.PI/180;
     angle=Math.round(angle/step)*step;
   }
   f.rotation=Math.atan2(Math.sin(angle),Math.cos(angle));
   drag.moved=true;draw();
   stat('家具旋转 '+Math.round(f.rotation*180/Math.PI)+'° · Shift 15°吸附 / Alt 自由旋转');
   e.preventDefault();return;
 }
 const next=[drag.from[0]+current[0]-drag.p[0],drag.from[1]+current[1]-drag.p[1]];
 if(drag.type==='endpoint'){
   const w=doc.walls.find(x=>x.id===drag.id);if(!w)return;
   const previous=[...w[drag.side]];
   const snapped=snapPosition(next,doc,.1,{excludePoint:drag.from,excludeWallId:drag.id,disable:e.altKey});
   for(const segment of doc.walls){
     for(const side of ['a','b']){
       if(Math.hypot(segment[side][0]-previous[0],segment[side][1]-previous[1])<.011)
         segment[side]=[...snapped];
     }
   }
   drag.moved=true;draw();stat(e.altKey?'自由拖动（Alt 暂停吸附）':'墙端点已按端点／墙线／网格吸附');e.preventDefault();return;
 }
 const f=doc.furniture.find(x=>x.id===drag.id);if(!f)return;
 const point=snapPosition(next,doc,.1,{disable:e.altKey});
 const aligned=(!e.altKey&&$('snap-furniture').checked)?snapFurniture(doc,f.id,point[0],point[1]):{x:point[0],z:point[1],guides:[]};
 alignmentGuides=aligned.guides;
 f.x=clamp(aligned.x,-doc.width/2+f.width/2,doc.width/2-f.width/2);
 f.z=clamp(aligned.z,-doc.depth/2+f.depth/2,doc.depth/2-f.depth/2);
 drag.moved=true;draw();e.preventDefault();
});
const drop=()=>{
 if(!drag)return;
 alignmentGuides=[];
 if(drag.moved){
   const error=validateProject(doc);
   if(error){doc=drag.before;notify('墙体修改已取消：'+error);}
   else{history.push(drag.before);future=[];}
   refresh();
 }
 drag=null;draw();
};
svg.addEventListener('pointerup',drop);svg.addEventListener('pointercancel',drop);
svg.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.90:1.10),.6,3.6);draw();},{passive:false});
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>toolMode(b.dataset.tool)));
document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>sidebar(b.dataset.panel)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
for(const name of ['show-grid','show-measures'])$(name).addEventListener('change',draw);
$('fit-view').addEventListener('click',fit);$('reset-camera').addEventListener('click',fit);
let panTool=false;
function updateCameraTool(){
 const button=$('camera-pan');
 button.classList.toggle('active',panTool);
 button.setAttribute('aria-pressed',String(panTool));
 button.textContent=panTool?'✋ 平移中':'✋ 平移';
 if(orbit)orbit.mouseButtons.LEFT=panTool?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
 if(orbit)orbit.touches.ONE=panTool?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
}
$('airflow-toggle').addEventListener('change',e=>{
 airflowEnabled=e.target.checked;
 if(airflowOverlay){scene?.remove(airflowOverlay.group);airflowOverlay.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});airflowOverlay=null;}
 if(airflowEnabled){
   if(view!=='3d')setView('3d');
   if(ready&&!airflowOverlay){airflowOverlay=makeAirflowOverlay(doc,{openings:flowSettings().openings,flowScale:Math.min(3,Math.max(0,(evaluateVentilation(doc,flowSettings()).flowM3s||0)/.45)),sourcePoint:doc.airflowSource==='custom'?[doc.airflowX??0,doc.airflowZ??0]:null,spread:doc.airflowSpread??1.5});scene.add(airflowOverlay.group);}
   $('three-viewport').dataset.airflowActive=String(Boolean(airflowOverlay?.available));
   stat(airflowOverlay?.available?'气流粒子预览：门窗间示意路径（非 CFD）':'请添加至少两个门窗开口用于气流示意');
 }else{ $('three-viewport').dataset.airflowActive='false';stat('已关闭气流示意');}
});

function flowSettings(){
 const items=doc.openings.filter(o=>o.kind==='door'||o.kind==='window'),openingFractions={};
 if(items[0])openingFractions[items[0].id]=doc.flowInlet??1;
 if(items.length>1)openingFractions[items.at(-1).id]=doc.flowOutlet??1;
 return {pressurePa:doc.flowPressurePa??5,openings:openingFractions};
}
$('cfd-export-stl').addEventListener('click',()=>{
 try{
  const geometry=cfdSurfaceStl(doc);
  const blob=new Blob([geometry],{type:'model/stl'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='qixu-obstacles.stl';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('cfd-result-status').textContent='已导出墙体和家具 STL；仍需流体域网格、边界映射和 OpenFOAM 求解。';
 }catch(e){$('cfd-result-status').textContent='STL 导出失败：'+e.message;}
});
$('cfd-export').addEventListener('click',()=>{
 try{
  const request=buildCfdJob(doc,flowSettings());
  const blob=new Blob([JSON.stringify(request,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='qixu-openfoam-input.json';a.click();URL.revokeObjectURL(url);
  $('cfd-result-status').textContent='已导出求解输入。尚无 OpenFOAM 结果；需要独立求解器完成网格与计算。';
 }catch(e){$('cfd-result-status').textContent='CFD 输入校验失败：'+e.message;}
});
function showFlowEstimate(){
 const r=evaluateVentilation(doc,flowSettings());
 $('flow-estimate').textContent=r.available?
 '孔口近似流量 '+(r.flowM3s*3600).toFixed(1)+' m³/h · 理论 ACH '+r.airChangesPerHour.toFixed(2)+' /h · 家具阻力因子 '+r.lossFactor.toFixed(2)+'。非 CFD / 非实测值':
 '无有效流量估算：'+r.reason;
}
function resetFlowOverlay(){
 if(airflowOverlay){scene?.remove(airflowOverlay.group);airflowOverlay.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});airflowOverlay=null;}
 if(airflowEnabled&&ready){airflowOverlay=makeAirflowOverlay(doc,{openings:flowSettings().openings,flowScale:Math.min(3,Math.max(0,(evaluateVentilation(doc,flowSettings()).flowM3s||0)/.45)),sourcePoint:doc.airflowSource==='custom'?[doc.airflowX??0,doc.airflowZ??0]:null,spread:doc.airflowSpread??1.5});scene.add(airflowOverlay.group);}
 $('three-viewport').dataset.airflowActive=String(Boolean(airflowOverlay?.available));
}
for(const [id,key,scale] of [['flow-pressure','flowPressurePa',1],['flow-inlet','flowInlet',.01],['flow-outlet','flowOutlet',.01]]){
 $(id).addEventListener('change',e=>{change(()=>{doc[key]=Number(e.target.value)*scale;});resetFlowOverlay();showFlowEstimate();});
}
let textureTarget='wall';
$('texture-wall').addEventListener('click',()=>{textureTarget='wall';$('texture-file').click();});
$('texture-floor').addEventListener('click',()=>{textureTarget='floor';$('texture-file').click();});
for(const [id,key] of [['texture-clear-wall','wallTexture'],['texture-clear-floor','floorTexture']]){
 $(id).addEventListener('click',()=>{change(()=>{delete doc[key];});notify('已清除贴图');});
}
$('texture-repeat').addEventListener('change',e=>{
 const n=Number(e.target.value);if(!Number.isInteger(n)||n<1||n>12){notify('重复次数需为 1–12');return;}
 change(()=>{doc.textureRepeat=n;});
});
$('texture-file').addEventListener('change',e=>{
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 if(file.size>1_000_000||!['image/jpeg','image/png','image/webp'].includes(file.type)){notify('只支持 1MB 内 PNG/JPEG/WebP');return;}
 const reader=new FileReader();
 reader.onload=()=>{const data=reader.result;
  change(()=>{doc[textureTarget==='wall'?'wallTexture':'floorTexture']=data;});
  notify('自定义材质贴图已保存');
 };
 reader.onerror=()=>notify('材质贴图读取失败');
 reader.readAsDataURL(file);
});
for(const [id,key,transform] of [['airflow-source','airflowSource',v=>v],['airflow-source-x','airflowX',Number],['airflow-source-z','airflowZ',Number],['airflow-spread','airflowSpread',Number]]){
 $(id).addEventListener('change',e=>{change(()=>doc[key]=transform(e.target.value));resetFlowOverlay();});
}
$('airflow-speed').addEventListener('input',e=>{airflowSpeed=Number(e.target.value);});
$('camera-pan').addEventListener('click',()=>{
 if(view!=='3d')setView('3d');
 if(view!=='3d'||touring)return;
 panTool=!panTool;updateCameraTool();
 stat(panTool?'平移模式：左键拖拽画面；右键仍可平移':'旋转模式：左键拖动视角，右键平移');
});
$('camera-top').addEventListener('click',()=>{
 if(view!=='3d')setView('3d');
 if(!ready||view!=='3d'||touring)return;
 const distance=Math.max(doc.width,doc.depth)*1.55;
 camera.position.set(0,distance,.001);
 orbit.target.set(0,0,0);orbit.update();
 stat('俯视 3D · 拖动可旋转 / 平移');
});
for(const b of document.querySelectorAll('[data-lighting]'))b.addEventListener('click',()=>{
 const mode=b.dataset.lighting;
 change(()=>{doc.lightingMode=mode;});
 window.qixuSetLighting?.(mode);
 document.querySelectorAll('[data-lighting]').forEach(x=>x.classList.toggle('active',x===b));
 stat('3D 光照：'+b.textContent.trim());
});
$('camera-eye').addEventListener('click',()=>{
 if(view!=='3d')setView('3d');
 if(!ready||view!=='3d'||touring)return;
 camera.position.set(doc.width*.39,1.65,Math.max(2.8,doc.depth*.53));
 orbit.target.set(0,1.4,0);orbit.update();
 stat('室内视角 · 拖动旋转 / 右键平移 / 滚轮缩放');
});
$('undo').addEventListener('click',goBack);$('redo').addEventListener('click',goForward);
$('project-title').addEventListener('change',e=>change(()=>doc.title=e.target.value.trim().slice(0,50)||'未命名空间'));
$('new-project').addEventListener('click',()=>{
 if(!confirm('创建空白户型将替换当前设计，请先下载需要保留的项目。'))return;
 const next=createProject();next.walls=[];next.openings=[];next.furniture=[];useDoc(next,'空白户型已创建');
});
$('load-sample').addEventListener('click',()=>{
 if(confirm('载入示例会替换当前设计，继续吗？'))useDoc(createProject(),'已加载双房示例');
});
$('import-legacy').addEventListener('click',()=>{
 try{useDoc(importLegacy(JSON.parse(localStorage.getItem('qixu-blueprint-v6')||'null')),
  '旧版墙线已导入。请检查门窗、尺寸和真实比例。');}
 catch(e){notify('迁移失败：'+e.message);}
});
$('import-glb').addEventListener('click',()=>{
 if(selection?.kind!=='furniture'){notify('请先在 2D 或 3D 中选中一件家具');return;}
 $('file-glb').click();
});
$('file-glb').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 if(file.size>2_000_000){notify('GLB 超过 2MB，当前仅支持小型自包含模型');return;}
 if(selection?.kind!=='furniture'){notify('请先选择家具');return;}
 try{
  const buffer=await file.arrayBuffer();
  const view=new DataView(buffer);
  if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||
      view.getUint32(8,true)!==buffer.byteLength)throw Error('不是有效的 GLB 2.0 文件');
  const jsonLength=view.getUint32(12,true);
  if(jsonLength<2||jsonLength>buffer.byteLength-20||view.getUint32(16,true)!==0x4e4f534a)throw Error('GLB JSON 块无效');
  const manifest=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)));
  if(manifest.asset?.version!=='2.0'||['buffers','images'].some(key=>(manifest[key]||[]).some(x=>x.uri&&!x.uri.startsWith('data:'))))
   throw Error('仅支持不带外链的自包含 GLB 2.0');
  const binary=new Uint8Array(buffer);let raw='';
  for(let i=0;i<binary.length;i+=32768)raw+=String.fromCharCode(...binary.subarray(i,i+32768));
  const data='data:model/gltf-binary;base64,'+btoa(raw),id=selection.id;
  // glTF 2.0 uses meters. Preserve intrinsic model measurements; never silently
  // stretch a newly imported product to a generic furniture template's dimensions.
  const gltf=await new Promise((resolve,reject)=>glbLoader.parse(buffer,'',resolve,reject));
  const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z].every(Number.isFinite)||size.x<.1||size.z<.1||
     size.x>20||size.z>20||size.y<.005||size.y>20)
    throw Error('GLB 必须以米为单位，尺寸为有效家具范围（0.1–20 米）');
  if(change(()=>{
    const item=doc.furniture.find(f=>f.id===id);if(!item)throw Error('家具已删除');
    item.modelData=data;item.width=+size.x.toFixed(4);
    item.height=+size.y.toFixed(4);item.depth=+size.z.toFixed(4);
  }))notify('GLB 已按原始米制尺寸导入：'+size.x.toFixed(2)+' × '+size.y.toFixed(2)+' × '+size.z.toFixed(2)+' m');
 }catch(err){notify('GLB 导入失败：'+err.message);}
});
$('import-file').addEventListener('click',()=>$('file-json').click());
$('import-ifc').addEventListener('click',()=>$('file-ifc').click());
$('file-ifc').addEventListener('change',async e=>{
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 if(file.size>8_000_000){notify('IFC 文件超过 8MB');return;}
 $('status-text').textContent='正在按需加载 IFC WASM，读取墙体几何…';
 try{
  const {parseIfcWallPlan}=await import('./studio-ifc.js');
  const result=await parseIfcWallPlan(await file.arrayBuffer());
  if(!confirm('解析到 '+result.wallCount+' 条 IFC 墙体（'+result.schema+'）。导入将替换当前项目，是否继续？'))return;
  useDoc(result.project,'已导入 IFC 墙线。'+result.warnings.join('；'));
  $('status-text').textContent=result.warnings.join('；');
 }catch(err){notify('IFC 导入失败：'+err.message);$('status-text').textContent=err.message;}
});
$('import-dxf').addEventListener('click',()=>$('file-dxf').click());
$('file-dxf').addEventListener('change',async e=>{
  const f=e.target.files?.[0];e.target.value='';
  if(!f)return;
  if(f.size>5_000_000){notify('DXF 文件不能超过 5MB');return;}
  try{
    const converted=parseDxf(await f.text(),$('dxf-units').value);
    useDoc(converted.project,'已导入 '+converted.wallCount+' 条 DXF 墙线（单位：'+converted.units+'）。请核对墙体与门窗。');
  }catch(err){notify('DXF 导入失败：'+err.message);}
});
$('file-json').addEventListener('change',async e=>{
 const f=e.target.files?.[0];e.target.value='';if(!f)return;
 if(f.size>14e6)return notify('项目文件超出 14 MB');
 try{useDoc(JSON.parse(await f.text()),'完整项目导入成功');}catch(err){notify('导入失败：'+err.message);}
});
$('load-image').addEventListener('click',()=>$('file-image').click());
$('file-image').addEventListener('change',e=>{
 const f=e.target.files?.[0];e.target.value='';
 if(!f||!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>7e6)return notify('请选择 7MB 内的户型图片');
 const reader=new FileReader();
 reader.onload=()=>{
  const img=new Image();
  img.onload=()=>{if(img.width*img.height>25e6)return notify('图片像素过大');
   change(()=>doc.reference=reader.result);notify('参考底图已导入，可用绘墙工具描线');};
  img.onerror=()=>notify('图片无法解码');img.src=reader.result;
 };
 reader.onerror=()=>notify('图片读取失败');reader.readAsDataURL(f);
});
function download(name,type,source){
 const url=URL.createObjectURL(new Blob([source],{type}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('export-dxf').addEventListener('click',()=>{
 download('qixu-wall-plan.dxf','application/dxf',exportDxf(doc));
 notify('已导出 CAD R12 ASCII LINE 墙线 DXF');
});
$('export-bom').addEventListener('click',()=>{
 const takeoff=materialTakeoff(doc);
 const rows=[['类型','名称','数量','单位','说明'],
 ['地面','已闭合房间面积',takeoff.totalFloorAreaM2,'㎡','仅已闭合空间'],
 ['墙体','墙段总长',takeoff.wallLengthM,'m','不剔除重复重叠墙线'],
 ['墙体','墙面净面积',takeoff.netWallAreaM2,'㎡','单面墙面面积，扣除门窗开孔'],
 ['开口','门窗面积',takeoff.openingAreaM2,'㎡','估算值']];
 for(const [type,n]of Object.entries(takeoff.furnitureCounts))
   rows.push(['家具',FURNITURE[type]?.label||type,n,'件','仅数量，无单价']);
 const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
 download('qixu-material-takeoff.csv','text/csv;charset=utf-8',csv);
 notify('已导出估算工程量 CSV，不包含施工损耗及报价');
});
$('smart-layout').addEventListener('click',()=>{
 const suggestions=suggestLayout(doc);
 if(!suggestions.length){notify('未找到可以安全摆放家具的闭合空间。请检查墙体连接后重试。');return;}
 change(()=>{
   for(const s of suggestions){
     const f=addFurniture(doc,s.type);
     Object.assign(f,{x:s.x,z:s.z,width:s.width,depth:s.depth,height:s.height,rotation:0});
   }
 });notify('已按房间几何生成 '+suggestions.length+' 件家具的规则布局，可继续手工调整');
});
$('export').addEventListener('click',()=>{
 download('qixu-studio.json','application/json',JSON.stringify(doc,null,2));notify('已导出可编辑完整方案');
});
$('snapshot').addEventListener('click',()=>{
 if(view==='2d'){
  const clone=svg.cloneNode(true);clone.setAttribute('xmlns',ns);
  clone.setAttribute('width','1600');clone.setAttribute('height','1000');
  download('qixu-floorplan.svg','image/svg+xml;charset=utf-8',new XMLSerializer().serializeToString(clone));
 }else if(renderer){
  renderer.render(scene,camera);const a=document.createElement('a');
  a.href=renderer.domElement.toDataURL('image/png');a.download='qixu-3d.png';a.click();
 }
 notify('当前视角已导出');
});
document.querySelectorAll('[data-floor]').forEach(b=>b.addEventListener('click',()=>change(()=>doc.floor=b.dataset.floor)));
document.querySelectorAll('[data-floor-pattern]').forEach(b=>b.addEventListener('click',()=>{
 change(()=>{doc.floorPattern=b.dataset.floorPattern;});
 document.querySelectorAll('[data-floor-pattern]').forEach(x=>x.classList.toggle('active',x===b));
}));
document.querySelectorAll('[data-wall-color]').forEach(b=>b.addEventListener('click',()=>change(()=>doc.wallColor=b.dataset.wallColor)));
document.querySelectorAll('[data-wall-pattern]').forEach(b=>b.addEventListener('click',()=>{
 change(()=>doc.wallPattern=b.dataset.wallPattern);
 document.querySelectorAll('[data-wall-pattern]').forEach(x=>x.classList.toggle('active',x===b));
}));
function library(search=''){
 const parent=$('furniture-library');parent.replaceChildren();
 Object.entries(FURNITURE).filter(([type,v])=>v.label.includes(search)||type.includes(search.toLowerCase()))
  .forEach(([type,data])=>{
   const b=document.createElement('button');b.className='library-item';
   const icon=document.createElement('strong'),text=document.createElement('span');
   icon.textContent=data.icon;text.textContent=data.label;b.append(icon,text);
   b.addEventListener('click',()=>{
    change(()=>{const f=addFurniture(doc,type);selection={kind:'furniture',id:f.id};});
    toolMode('select');notify('家具已添加，在 2D 模式可拖动');
   });parent.append(b);
  });
}
$('model-search').addEventListener('input',e=>library(e.target.value.trim()));
document.addEventListener('keydown',e=>{
 if(touring){if(e.key==='Escape')toggleTour();return;}
 if(e.target.matches('input,textarea,select'))return;
 const cmd=e.ctrlKey||e.metaKey;
 if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)goForward();else goBack();return;}
 if(cmd&&e.key.toLowerCase()==='y'){e.preventDefault();goForward();return;}
 if(e.key==='Escape'){if(placingWindSource){e.preventDefault();finishWindPlacement(false);}else toolMode('select');return;}
 if(['Delete','Backspace'].includes(e.key)&&selection){
  e.preventDefault();change(()=>deleteObject(doc,selection.id));selection=null;refresh();return;
 }
 if(cmd&&e.key.toLowerCase()==='d'&&selection?.kind==='furniture'){
   e.preventDefault();const source=doc.furniture.find(f=>f.id===selection.id);
   if(source)change(()=>{const created=addFurniture(doc,source.type);
    Object.assign(created,{...structuredClone(source),id:created.id,x:source.x+.3,z:source.z+.3});selection={kind:'furniture',id:created.id};});
   return;
 }
 if(selection?.kind==='furniture'&&!cmd&&['[',']'].includes(e.key)){
   e.preventDefault();const angle=e.key==='['?-Math.PI/12:Math.PI/12;
   change(()=>{const f=doc.furniture.find(f=>f.id===selection.id);if(f)f.rotation=Math.atan2(Math.sin(f.rotation+angle),Math.cos(f.rotation+angle));});
   return;
 }
 const keys={v:'select',w:'wall',d:'door',g:'window'},mode=keys[e.key.toLowerCase()];
 if(mode)toolMode(mode);
});


function buildBox(parent,mat,w,h,d,x,y,z){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
 return mesh;
}
function disposeGroup(group){
 group.traverse(o=>{
   o.geometry?.dispose();
   if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose();m.dispose();});
 });
}
function renderThree(){
 if(!ready)return;
 // Preserve GPU geometry, textures and materials when only UI/selection/lighting changed.
 const structureKey=JSON.stringify([doc.width,doc.depth,doc.thickness,doc.wallHeight,doc.floor,doc.floorPattern,doc.floorTexture?.length,doc.floorTexture?.slice(-50),doc.textureRepeat,doc.wallColor,doc.wallPattern,doc.wallTexture?.length,doc.wallTexture?.slice(-50),doc.reference,doc.walls,doc.openings,demoXray]);
 const furnitureKey=JSON.stringify(doc.furniture);
 const sceneKey=structureKey+'|'+furnitureKey;
 if(sceneKey===lastSceneKey)return;
 // Keep all static GPU geometry alive when only furniture changes.
 if(structureKey===lastStructureKey){
   const wanted=new Set(doc.furniture.map(f=>f.id));
   for(const [id,entry] of furnitureMeshes){
     if(wanted.has(id))continue;
     content.remove(entry.group);disposeGroup(entry.group);furnitureMeshes.delete(id);
   }
   for(const item of doc.furniture){
     const shapeKey=JSON.stringify([item.type,item.width,item.depth,item.height,item.modelData?.length,item.modelData?.slice(-40)]);
     let entry=furnitureMeshes.get(item.id);
     if(entry&&entry.shapeKey!==shapeKey){
       content.remove(entry.group);disposeGroup(entry.group);
       furnitureMeshes.delete(item.id);entry=null;
     }
     if(!entry){
       const group=new THREE.Group();
       group.userData.selection={kind:'furniture',id:item.id};
       group.add(createProceduralFurniture(item));content.add(group);
       entry={group,shapeKey};furnitureMeshes.set(item.id,entry);attachGlb(entry,item);
     }
     entry.group.position.set(item.x,0,item.z);
     entry.group.rotation.y=-item.rotation;
   }
   lastSceneKey=sceneKey;
   $('three-viewport').dataset.furnitureUpdates=String(Number($('three-viewport').dataset.furnitureUpdates||0)+1);
   return;
 }
 lastSceneKey=sceneKey;lastStructureKey=structureKey;
 furnitureMeshes.clear();sceneEpoch++;
 sceneRebuilds++;
 $('three-viewport').dataset.sceneRebuilds=String(sceneRebuilds);
 while(content.children.length){
  const child=content.children[0];content.remove(child);disposeGroup(child);
 }
 if(airflowOverlay){scene.remove(airflowOverlay.group);airflowOverlay.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});airflowOverlay=null;}
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(doc.width,doc.depth),
   floorMaterial(doc.floor,doc.floorPattern||'auto',doc.floorTexture||null,doc.textureRepeat||3));
 floor.rotation.x=-Math.PI/2;floor.position.y=.02;floor.receiveShadow=true;content.add(floor);
 if(doc.reference){
  const texture=new THREE.TextureLoader().load(doc.reference);
  texture.colorSpace=THREE.SRGBColorSpace;
  const ref=new THREE.Mesh(new THREE.PlaneGeometry(doc.width,doc.depth),
    new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.58,depthWrite:false}));
  ref.rotation.x=-Math.PI/2;ref.position.y=.026;content.add(ref);
 }
 for(const wall of doc.walls){
  const dx=wall.b[0]-wall.a[0],dz=wall.b[1]-wall.a[1],wallLength=length(wall);
  const group=new THREE.Group();group.position.set(wall.a[0],0,wall.a[1]);
  group.rotation.y=-Math.atan2(dz,dx);
  group.userData.selection={kind:'wall',id:wall.id};
  const cx=(wall.a[0]+wall.b[0])/2,cz=(wall.a[1]+wall.b[1])/2;
  const fadeWall=demoXray&&(cx>doc.width*.27||cz>doc.depth*.27);
  const material=wallMaterial(doc.wallColor,doc.wallPattern||'paint',doc.wallTexture||null,doc.textureRepeat||3);
  material.transparent=fadeWall;material.opacity=fadeWall?.2:1;
  material.depthWrite=!fadeWall;material.side=THREE.DoubleSide;
  for(const piece of wallPieces(doc,wall)){
   buildBox(group,material,piece.end-piece.start,piece.top-piece.bottom,doc.thickness,
     (piece.start+piece.end)/2,(piece.top+piece.bottom)/2,0);
  }
  content.add(group);
  for(const opening of doc.openings.filter(o=>o.wallId===wall.id)){
   const g=new THREE.Group();g.position.set(...[wall.a[0],0,wall.a[1]]);
   g.rotation.y=group.rotation.y;g.userData.selection={kind:'opening',id:opening.id};
   const trim=new THREE.MeshStandardMaterial({color:'#c3a991',roughness:.72});
   const distance=opening.t*wallLength;
   buildBox(g,trim,.047,opening.height,.18,distance-opening.width/2,opening.sill+opening.height/2,0);
   buildBox(g,trim,.047,opening.height,.18,distance+opening.width/2,opening.sill+opening.height/2,0);
   buildBox(g,trim,opening.width+.06,.045,.18,distance,opening.sill+opening.height+.02,0);
   if(opening.kind==='window'){
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(opening.width-.08,opening.height-.09),
      new THREE.MeshPhysicalMaterial({color:'#b5d9e4',transparent:true,opacity:.28,
        roughness:.12,side:THREE.DoubleSide,depthWrite:false}));
    glass.position.set(distance,opening.sill+opening.height/2,0);g.add(glass);
    buildBox(g,trim,opening.width,.04,.18,distance,opening.sill,0);
   }
   content.add(g);
  }
 }
 for(const item of doc.furniture){
  const group=new THREE.Group();
  group.position.set(item.x,0,item.z);
  group.rotation.y=-item.rotation;
  group.userData.selection={kind:'furniture',id:item.id};
  group.add(createProceduralFurniture(item));
  content.add(group);
  const entry={group,shapeKey:JSON.stringify([item.type,item.width,item.depth,item.height,item.modelData?.length,item.modelData?.slice(-40)])};
  furnitureMeshes.set(item.id,entry);attachGlb(entry,item);
 }
 const grid=new THREE.GridHelper(Math.max(doc.width,doc.depth)+2,
   Math.max(6,Math.ceil(Math.max(doc.width,doc.depth)*2)),0xaec5b6,0xdfebe2);
 grid.position.y=.014;grid.visible=!demoInfo;content.add(grid);
 if(airflowEnabled){airflowOverlay=makeAirflowOverlay(doc,{openings:flowSettings().openings,flowScale:Math.min(3,Math.max(0,(evaluateVentilation(doc,flowSettings()).flowM3s||0)/.45)),sourcePoint:doc.airflowSource==='custom'?[doc.airflowX??0,doc.airflowZ??0]:null,spread:doc.airflowSpread??1.5});scene.add(airflowOverlay.group);}
 $('three-viewport').dataset.airflowActive=String(Boolean(airflowOverlay?.available));
}
function initThree(){
 if(ready)return;
 scene=new THREE.Scene();scene.background=new THREE.Color('#ecf3ef');
 camera=new THREE.PerspectiveCamera(43,1,.05,250);
 renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.shadowMap.autoUpdate=true;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=demoInfo?1.18:1.5;
 $('three-viewport').append(renderer.domElement);
 orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;
 orbit.minDistance=1.2;orbit.maxDistance=130;orbit.maxPolarAngle=Math.PI*.495;
 orbit.enablePan=true;orbit.screenSpacePanning=true;
 orbit.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
 orbit.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
 const ambient=new THREE.HemisphereLight(0xfffaf0,0x91a898,1.15);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffeed4,demoInfo?2.25:2.9);
 sun.position.set(-13,22,-18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 sun.shadow.camera.left=-35;sun.shadow.camera.right=35;
 sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;
 sun.shadow.camera.far=100;sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
 const presets={day:{sun:2.7,ambient:1.15,color:0xffeed4,exposure:1.22},evening:{sun:1.45,ambient:.63,color:0xffb76d,exposure:1.35},showcase:{sun:2.4,ambient:1.8,color:0xffffff,exposure:1.3}};
 function applyLighting(mode){const p=presets[mode]||presets.day;sun.intensity=p.sun;ambient.intensity=p.ambient;sun.color.setHex(p.color);renderer.toneMappingExposure=p.exposure;}
 window.qixuSetLighting=mode=>{applyLighting(mode);};
 applyLighting(doc.lightingMode||'day');
 document.querySelectorAll('[data-lighting]').forEach(b=>b.classList.toggle('active',b.dataset.lighting===(doc.lightingMode||'day')));
 content=new THREE.Group();scene.add(content);
 const resize=()=>{
  const r=$('three-viewport').getBoundingClientRect();if(!r.width||!r.height)return;
  camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
  renderer.setSize(r.width,r.height,false);
 };
 new ResizeObserver(resize).observe($('three-viewport'));
 renderer.domElement.addEventListener('pointerdown',e=>{
   if(!touring)return;mouseTurn={x:e.clientX,y:e.clientY};
   try{renderer.domElement.setPointerCapture(e.pointerId)}catch{}
 });
 renderer.domElement.addEventListener('pointermove',e=>{
   if(!touring||!mouseTurn)return;
   const dx=e.clientX-mouseTurn.x,dy=e.clientY-mouseTurn.y;mouseTurn={x:e.clientX,y:e.clientY};
   walkYaw-=dx*.004;walkPitch=Math.max(-.88,Math.min(.88,walkPitch-dy*.004));
   camera.rotation.set(walkPitch,walkYaw,0);
 });
 renderer.domElement.addEventListener('pointerup',()=>{mouseTurn=null});
 renderer.domElement.addEventListener('pointercancel',()=>{mouseTurn=null});
 renderer.domElement.addEventListener('click',e=>{
  if(touring)return;
  const rect=renderer.domElement.getBoundingClientRect();
  const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,
    -((e.clientY-rect.top)/rect.height*2-1));
  const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
  for(const hit of ray.intersectObjects(content.children,true)){
   let object=hit.object;
   while(object&&object!==content&&!object.userData.selection)object=object.parent;
   if(object?.userData.selection){picked(object.userData.selection.kind,object.userData.selection.id);break;}
  }
 });
 ready=true;updateCameraTool();fit();renderThree();resize();
 function frame(time){
   requestAnimationFrame(frame);if(view!=='3d'&&view!=='split')return;
   const dt=Math.min(.055,Math.max(0,(time-lastFrame)/1000));lastFrame=time;
   if(touring)walkFrame(dt);else orbit.update();
   if(airflowEnabled)airflowOverlay?.update(time,airflowSpeed);
   renderer.render(scene,camera);
 }
 frame();
}
function toggleTour(){
 if(touring){
   touring=false;walkPressed.clear();mouseTurn=null;
   if(orbit){orbit.enabled=true;orbit.target.set(0,.8,0);orbit.update();}
   $('tour-toggle').classList.remove('active');$('tour-toggle').textContent='🚶 室内漫游';
   stat('已退出漫游，返回可旋转的 3D 视图');return;
 }
 setView('3d');
 if(!ready)return;
 const start=findWalkStart(doc);
 if(!start){notify('未找到可站立位置，请先移开家具或调整墙体');return;}
 touring=true;walkYaw=0;walkPitch=0;
 orbit.enabled=false;camera.position.set(start[0],1.63,start[1]);
 camera.rotation.order='YXZ';camera.rotation.set(0,walkYaw,0);
 $('tour-toggle').classList.add('active');$('tour-toggle').textContent='结束漫游';
 stat('室内漫游：WASD 移动，按住鼠标拖动观察；门洞可通行');
 $('interaction-hint').textContent='漫游模式 · WASD 移动 · 按住鼠标旋转 · 点击“结束漫游”返回编辑';
}
$('tour-toggle').addEventListener('click',toggleTour);
window.addEventListener('keydown',e=>{
 if(!touring||e.target.matches('input,textarea,select'))return;
 const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
   e.preventDefault();walkPressed.add(key);}
});
window.addEventListener('keyup',e=>walkPressed.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>walkPressed.clear());
function walkFrame(dt){
 if(!touring||!camera||dt<=0)return;
 const forward=(walkPressed.has('w')||walkPressed.has('arrowup')?1:0)-
  (walkPressed.has('s')||walkPressed.has('arrowdown')?1:0);
 const sideways=(walkPressed.has('d')||walkPressed.has('arrowright')?1:0)-
  (walkPressed.has('a')||walkPressed.has('arrowleft')?1:0);
 if(!forward&&!sideways)return;
 const step=2.3*dt/Math.max(1,Math.hypot(forward,sideways));
 const dx=(-Math.sin(walkYaw)*forward+Math.cos(walkYaw)*sideways)*step;
 const dz=(-Math.cos(walkYaw)*forward-Math.sin(walkYaw)*sideways)*step;
 if(canWalkAt(doc,camera.position.x+dx,camera.position.z))camera.position.x+=dx;
 if(canWalkAt(doc,camera.position.x,camera.position.z+dz))camera.position.z+=dz;
}
function setView(name){
 if(!['2d','3d','split'].includes(name))return;
 if(name!=='3d'&&touring){touring=false;walkPressed.clear();if(orbit)orbit.enabled=true;
   $('tour-toggle').classList.remove('active');$('tour-toggle').textContent='🚶 室内漫游';}
 view=name;
 document.querySelectorAll('[data-view]').forEach(b=>{
  b.classList.toggle('active',b.dataset.view===name);
  b.setAttribute('aria-pressed',String(b.dataset.view===name));
 });
 $('canvas-wrap').classList.toggle('dual-view',name==='split');
 $('split-resizer').hidden=name!=='split';
 svg.toggleAttribute('hidden',name==='3d');$('three-viewport').hidden=name==='2d';
 $('mode-description').textContent=name==='2d'?'平面编辑 · 网格吸附':name==='split'?
   '2D 编辑 / 3D 实时同步':'3D 预览 · 拖动旋转 / 滚轮缩放';
 if(name!=='2d'){
  try{initThree();renderThree();}
  catch(e){
    console.error('3D rendering failed',e);
    view='2d';ready=false;
    $('canvas-wrap').classList.remove('dual-view');
    svg.removeAttribute('hidden');$('three-viewport').hidden=true;
    document.querySelectorAll('[data-view]').forEach(b=>{
      b.classList.toggle('active',b.dataset.view==='2d');
      b.setAttribute('aria-pressed',String(b.dataset.view==='2d'));
    });
    $('mode-description').textContent='3D 加载失败 · 已恢复 2D';
    stat('3D 无法启动：'+e.message);
    notify('3D 无法启动，请检查浏览器 WebGL 设置：'+e.message);
  }
 }
}
function focusSelectedFurniture(){
 const f=selection?.kind==='furniture'&&doc.furniture.find(x=>x.id===selection.id);
 if(!f){notify('请先在 2D 或 3D 选中一件家具');return;}
 if(!ready)initThree();
 const target=new THREE.Vector3(f.x,Math.max(.4,f.height/2),f.z);
 const offset=new THREE.Vector3(Math.max(2,f.width*2.5),Math.max(2.1,f.height*2.5),Math.max(2,f.depth*2.5));
 camera.position.copy(target).add(offset);orbit.target.copy(target);orbit.update();
 stat('3D 镜头已定位到选中家具');
}
$('dock-focus').addEventListener('click',focusSelectedFurniture);
const splitHandle=$('split-resizer');let resizingDock=false;
function setDockWidth(percent){
 const size=Math.max(25,Math.min(65,Math.round(percent)));
 $('canvas-wrap').style.setProperty('--dock-width',size+'%');
 splitHandle.setAttribute('aria-valuenow',String(size));
}
splitHandle.addEventListener('pointerdown',e=>{
 if(view!=='split')return;resizingDock=true;splitHandle.setPointerCapture(e.pointerId);e.preventDefault();
});
splitHandle.addEventListener('pointermove',e=>{
 if(!resizingDock)return;
 const r=$('canvas-wrap').getBoundingClientRect();
 if(window.matchMedia('(max-width:960px)').matches)return;
 setDockWidth((r.right-e.clientX)/r.width*100);
});
for(const event of ['pointerup','pointercancel'])splitHandle.addEventListener(event,()=>resizingDock=false);
splitHandle.addEventListener('keydown',e=>{
 const current=Number(splitHandle.getAttribute('aria-valuenow')||36);
 if(e.key==='ArrowLeft'){setDockWidth(current+5);e.preventDefault();}
 if(e.key==='ArrowRight'){setDockWidth(current-5);e.preventDefault();}
});
$('dock-expand').addEventListener('click',()=>setView('3d'));
$('dock-close').addEventListener('click',()=>setView('2d'));

try{
 const old=JSON.parse(localStorage.getItem(STORE)||'null');
 if(old&&!validateProject(old))doc=old;
 else if(demoInfo)doc=makeShowcaseTemplate(demoInfo.slug);
}catch(err){console.warn('Ignoring corrupted project',err);
 if(demoInfo)doc=makeShowcaseTemplate(demoInfo.slug);}
library();refresh();fit();toolMode('select');
if(demoInfo){
 const banner=document.createElement('div');banner.className='studio-demo-banner';
 const copy=document.createElement('div');
 const tag=document.createElement('strong');tag.textContent='交互式样板间 / '+demoInfo.name;
 const hint=document.createElement('span');hint.textContent='可以自由移动家具、修改墙门窗。演示进度与个人项目分别保存。';
 copy.append(tag,hint);
 const actions=document.createElement('div');
 const xrayButton=document.createElement('button');xrayButton.type='button';
 xrayButton.textContent='显示完整墙体';
 xrayButton.title='透视墙仅用于观看，项目真实几何和门窗开孔保持不变';
 xrayButton.addEventListener('click',()=>{
   demoXray=!demoXray;
   xrayButton.textContent=demoXray?'显示完整墙体':'开启透视墙';
   if(ready)renderThree();
 });
 const savePersonal=document.createElement('button');savePersonal.type='button';savePersonal.textContent='另存为我的项目 ↗';
 savePersonal.addEventListener('click',()=>{
   try{
     const key=PERSONAL_PROJECT_KEY;
     if(localStorage.getItem(key)&&!confirm('已有个人设计，是否使用当前样板间覆盖它？建议先下载个人设计的 JSON 备份。'))return;
     localStorage.setItem(key,JSON.stringify(doc));location.href='./studio.html';
   }catch(err){notify('另存失败，请使用右上角的「保存项目」下载 JSON。');}
 });
 const collection=document.createElement('a');collection.href='./showcase.html#collection';collection.textContent='返回样板间';
 actions.append(xrayButton,savePersonal,collection);banner.append(copy,actions);
 document.querySelector('.workspace').before(banner);
 if(new URLSearchParams(location.search).get('view')==='3d')setView('3d');
}
