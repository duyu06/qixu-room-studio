import {demoId,projectStorageKey,renderLink} from './qixu-routes.js';
import {validateProject,length} from './studio-model.js';

const $=id=>document.getElementById(id);
const demo=demoId(new URLSearchParams(location.search).get('template'));
const key=projectStorageKey(demo);
const frame=$('integrated-render-frame'),surface=$('integrated-preview');
const source=renderLink(demo);
let lastRenderedScene=null;
function current(){
 try{const doc=JSON.parse(localStorage.getItem(key)||'null');return !validateProject(doc)?doc:null;}
 catch{return null;}
}
function hidePreview(){
 surface.hidden=true;
 const active=document.querySelector('[data-view].active')?.dataset.view;
 $('plan-svg').toggleAttribute('hidden',active==='3d');
 $('three-viewport').hidden=active==='2d';
}
function showAnalysis(){
 const doc=current(),dest=$('studio-analysis-result');
 if(!doc){dest.textContent='项目尚未准备好。请在户型模块创建或导入项目。';return;}
 const doors=doc.openings.filter(o=>o.kind==='door');
 const windows=doc.openings.filter(o=>o.kind==='window');
 const wallLength=doc.walls.reduce((sum,w)=>sum+length(w),0);
 const netArea=doc.width*doc.depth;
 const facts=[
  ['当前画布',doc.width.toFixed(1)+' × '+doc.depth.toFixed(1)+' m'],
  ['画布包络面积',netArea.toFixed(1)+' m²'],
  ['墙段总长',wallLength.toFixed(1)+' m'],
  ['门洞 / 窗洞',doors.length+' / '+windows.length],
  ['布置家具',doc.furniture.length+' 件']
 ];
 dest.replaceChildren();
 const dl=document.createElement('dl');dl.className='insight-grid';
 for(const [name,value]of facts){
  const wrap=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=name;dd.textContent=value;wrap.append(dt,dd);dl.append(wrap);
 }
 const msg=document.createElement('p');msg.className='insight-note';
 msg.textContent=doors.length&&windows.length?'已识别门洞和窗洞，可作为后续气流模拟的边界条件。当前结果仅统计几何位置，不代表真实风速。':
 '当前项目缺少门洞或窗洞信息。先在户型模块补全开口，才能开展通风条件分析。';
 const label=document.createElement('p');label.className='insight-note';
 label.textContent='实际可使用面积需确认墙体是否形成封闭房间；画布包络面积不可用作房地产测绘面积。';
 dest.append(dl,msg,label);

}
function showRender(force=false){
 const doc=current();
 if(!doc){$('status-text').textContent='请先建立有效项目';return;}
 // The iframe shares the same origin/storage and renders this exact key.
 document.querySelector('[data-view="3d"]')?.click();
 surface.hidden=false;
 $('plan-svg').setAttribute('hidden','');
 $('three-viewport').hidden=true;
 const serialized=JSON.stringify(doc);
 if(force||lastRenderedScene!==serialized||!frame.getAttribute('src')){
  lastRenderedScene=serialized;
  frame.src=source;
 }
 $('status-text').textContent='同一项目 · WebGPU 光照预览';
}
const selector='[data-panel]';
for(const tab of document.querySelectorAll(selector)){
 tab.addEventListener('click',()=>{
  const mode=tab.dataset.panel;
  if(mode==='analysis'){hidePreview();showAnalysis();}
  else if(mode==='render')showRender();
  else hidePreview();
 });
}
for(const control of document.querySelectorAll('[data-view]')){
 control.addEventListener('click',()=>{if(!surface.hidden)hidePreview();});
}
// The editor refreshes its scene statistics on every mutation; keep analysis linked.
new MutationObserver(()=>{
 if(document.querySelector('[data-panel="analysis"].active'))showAnalysis();
}).observe($('geometry-stats'),{childList:true,subtree:true,characterData:true});
$('analysis-refresh').addEventListener('click',showAnalysis);
$('analysis-show-3d').addEventListener('click',()=>{
 hidePreview();document.querySelector('[data-view="3d"]')?.click();
});
$('render-refresh').addEventListener('click',()=>showRender(true));
$('render-return').addEventListener('click',()=>{
 hidePreview();document.querySelector('[data-view="3d"]')?.click();
});
frame.addEventListener('load',()=>{
 try{
  // Same-origin presentation only: no extra browser tab or duplicate controls.
  const d=frame.contentDocument;
  if(!d)return;
  const style=d.createElement('style');
  style.textContent='header,aside{display:none!important}main{height:100dvh!important;display:block!important}#viewer{height:100dvh!important;min-height:0!important}body{overflow:hidden!important}';
  d.head.append(style);
 }catch{ /* Render remains functional if embedded styling is restricted. */ }
});

 
// Deep links from former standalone pages open the relevant tool without
// navigating away from the active scene. The existing rail remains the source
// of truth for panel selection.
const initialPanel=new URLSearchParams(location.search).get('panel') ||
  location.hash.slice(1);
if(['structure','library','materials','analysis','render'].includes(initialPanel)){
  requestAnimationFrame(()=>document.querySelector('[data-panel="'+initialPanel+'"]')?.click());
}
// Keep the URL shareable without full document navigation or iframe resets.
for(const button of document.querySelectorAll('[data-panel]')){
  button.addEventListener('click',()=>{
    const selected=button.dataset.panel;
    const url=new URL(location.href);
    url.searchParams.set('panel',selected);
    history.replaceState(null,'',url.pathname+url.search);
  });
}
