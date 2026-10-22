import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {FURNITURE,createProject,validateProject,snapPosition,nearestWall,addWall,
  addOpening,wallPieces,length,interpolated,deleteObject,addFurniture,
  importLegacy,clamp,setOpeningDimension} from './studio-model.js';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg',STORE='qixu-studio-v1';
const svg=$('plan-svg'),world=$('world'),preview=$('preview-layer');
let doc=createProject(),selection=null,tool='select',view='2d',zoom=1;
let history=[],future=[],anchor=null,current=null,drag=null;
let scene,renderer,camera,orbit,content,ready=false,toastTimer;
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
 $('geometry-stats').textContent=doc.walls.length+' 段墙 · '+doc.openings.length+' 个门窗 · '+doc.furniture.length+' 件家具';
 $('undo').disabled=!history.length;$('redo').disabled=!future.length;
 draw();inspect();if(ready)renderThree();save();
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
 tool=name;anchor=null;
 document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
 const hints={select:'单击选择，拖动家具；V',wall:'先点起点，再点终点；Esc 取消',door:'点击一段墙添加真实门洞',
   window:'点击一段墙添加窗户'};
 $('interaction-hint').textContent=hints[name];stat(hints[name]);
 if(view==='3d'&&name!=='select')setView('2d');draw();
}
function sidebar(name){
 document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
 document.querySelectorAll('[data-sidebar]').forEach(p=>p.hidden=p.dataset.sidebar!==name);
}
function fit(){
 zoom=1;draw();
 if(orbit){camera.position.set(doc.width*.85,Math.max(9,doc.depth*1.25),doc.depth*1.45);
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
 for(const wall of doc.walls){
   const picked=selection?.id===wall.id;
   world.append(line(...wall.a,...wall.b,{class:'wall-base'+(picked?' selected':''),'stroke-width':doc.thickness}));
   world.append(line(...wall.a,...wall.b,{class:'wall-click','data-wall-id':wall.id}));
   if($('show-measures').checked){
     const mid=interpolated(wall,.5),L=length(wall),dx=wall.b[0]-wall.a[0],dy=wall.b[1]-wall.a[1];
     world.append(el('text',{x:mid[0]-dy/L*.27,y:mid[1]+dx/L*.27,class:'wall-label'},L.toFixed(2)+'m'));
   }
   if(picked)for(const v of [wall.a,wall.b])
     world.append(el('circle',{cx:v[0],cy:v[1],r:.11,class:'selection-dot'}));
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
     class:'furniture-rect'+(selection?.id===f.id?' selected':'')}));
   g.append(el('text',{x:0,y:.06,class:'furniture-label'},FURNITURE[f.type].label));
   world.append(g);
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
 panel.querySelector('[data-delete]')?.addEventListener('click',()=>{
  const target=selection.id;change(()=>deleteObject(doc,target));selection=null;refresh();
 });
 panel.querySelector('[data-duplicate]')?.addEventListener('click',()=>{
  const f=doc.furniture.find(x=>x.id===selection.id);
  change(()=>{const n=addFurniture(doc,f.type);Object.assign(n,{x:f.x+.4,z:f.z+.4,
   width:f.width,depth:f.depth,height:f.height,rotation:f.rotation});selection={kind:'furniture',id:n.id};});
 });
}
function picked(kind,id){selection={kind,id};draw();inspect();}
svg.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const p=screenPoint(e);if(!p)return;
 if(tool==='wall'){
  const q=snapPosition(p,doc);
  if(anchor){const a=anchor;anchor=null;change(()=>{const w=addWall(doc,a,q);selection={kind:'wall',id:w.id};});}
  else {anchor=q;current=q;draw();stat('已选择起点，点击第二点完成墙体');}
  e.preventDefault();return;
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
 if(tool==='wall'&&anchor){draw();return;}
 if(!drag)return;
 const f=doc.furniture.find(x=>x.id===drag.id);if(!f)return;
 const point=snapPosition([drag.from[0]+current[0]-drag.p[0],drag.from[1]+current[1]-drag.p[1]],doc);
 f.x=clamp(point[0],-doc.width/2+f.width/2,doc.width/2-f.width/2);
 f.z=clamp(point[1],-doc.depth/2+f.depth/2,doc.depth/2-f.depth/2);
 drag.moved=true;draw();e.preventDefault();
});
const drop=()=>{
 if(!drag)return;
 if(drag.moved){history.push(drag.before);future=[];refresh();}
 drag=null;
};
svg.addEventListener('pointerup',drop);svg.addEventListener('pointercancel',drop);
svg.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.90:1.10),.6,3.6);draw();},{passive:false});
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>toolMode(b.dataset.tool)));
document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>sidebar(b.dataset.panel)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
for(const name of ['show-grid','show-measures'])$(name).addEventListener('change',draw);
$('fit-view').addEventListener('click',fit);$('reset-camera').addEventListener('click',fit);
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
$('import-file').addEventListener('click',()=>$('file-json').click());
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
document.querySelectorAll('[data-wall-color]').forEach(b=>b.addEventListener('click',()=>change(()=>doc.wallColor=b.dataset.wallColor)));
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
 if(e.target.matches('input,textarea,select'))return;
 const cmd=e.ctrlKey||e.metaKey;
 if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)goForward();else goBack();return;}
 if(cmd&&e.key.toLowerCase()==='y'){e.preventDefault();goForward();return;}
 if(e.key==='Escape'){toolMode('select');return;}
 if(['Delete','Backspace'].includes(e.key)&&selection){
  e.preventDefault();change(()=>deleteObject(doc,selection.id));selection=null;refresh();return;
 }
 const keys={v:'select',w:'wall',d:'door',g:'window'},mode=keys[e.key.toLowerCase()];
 if(mode)toolMode(mode);
});
