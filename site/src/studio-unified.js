import {SHOWCASE_TEMPLATES} from './showcase-templates.js';
import {flowTrajectories,localSolarDate} from './studio-analysis.js';

/** One lightweight controller. Existing Studio owns the authoritative editable document. */
export function mountUnifiedStudio({readDoc,readDemo,setView,draw,switchProject}){
 const $=id=>document.getElementById(id);
 let panel='structure',flow=null;
 const svgNS='http://www.w3.org/2000/svg';
 const frame=$('studio-render-frame');
 const gallery=$('studio-project-gallery');
 function groupChild(tag,attrs={},text=''){
   const n=document.createElementNS(svgNS,tag);
   for(const [key,value]of Object.entries(attrs))n.setAttribute(key,String(value));
   if(text)n.textContent=text;return n;
 }
 for(const meta of SHOWCASE_TEMPLATES){
   const button=document.createElement('button');button.type='button';button.className='studio-project-choice';
   button.dataset.project=meta.slug;
   const title=document.createElement('strong'),note=document.createElement('span');
   title.textContent=meta.name;note.textContent=meta.subtitle;
   button.append(title,note);
   button.addEventListener('click',()=>{switchProject(meta.slug);updateProjectLabel();});
   gallery.append(button);
 }
 $('open-personal').addEventListener('click',()=>{switchProject(null);updateProjectLabel();});
 function updateProjectLabel(){
   const slug=readDemo(),meta=SHOWCASE_TEMPLATES.find(x=>x.slug===slug);
   $('studio-active-project').textContent=meta?'当前：'+meta.name:'当前：我的项目';
   for(const button of gallery.querySelectorAll('[data-project]'))
     button.classList.toggle('active',button.dataset.project===slug);
 }
 updateProjectLabel();
 function rebuildFlow(){
   try{
     flow=flowTrajectories(readDoc(),14);
     $('studio-flow-status').textContent='已计算 '+flow.nx+' × '+flow.nz+' 网格、'+flow.routes.length+
       ' 条相对气流路径。未校准真实风速和外部风压。';
   }catch(err){
     flow=null;$('studio-flow-status').textContent=err.message;
   }
 }
 function drawOverlay(){
   if(panel!=='analysis'||!flow||$('plan-svg').hidden)return;
   const layer=$('preview-layer');
   layer.querySelector('#studio-flow-overlay')?.remove();
   const root=groupChild('g',{id:'studio-flow-overlay','pointer-events':'none'});
   for(const path of flow.routes)root.append(groupChild('polyline',{
     points:path.map(p=>p.join(',')).join(' '),stroke:'#28aaa1',fill:'none',
     'stroke-width':'.045',opacity:'.74','stroke-linecap':'round'
   }));
   for(const [p,color,label] of [[flow.door,'#148b7e','门 / 进风'],[flow.window,'#c38d4c','窗 / 排风']]){
     root.append(groupChild('circle',{cx:p.x,cy:p.z,r:'.14',fill:color,stroke:'#fff','stroke-width':'.03'}));
     root.append(groupChild('text',{x:p.x+.13,y:p.z-.18,
       'font-size':'.16',fill:color,'font-weight':'bold'},label));
   }
   layer.append(root);
 }
 function activatePanel(name){
   panel=name;
   if(name==='analysis'){setView('2d');rebuildFlow();draw();}
   else if(name==='render'){setView('render');}
   else if(!frame.hidden){setView('2d');}
 }
 $('studio-flow-run').addEventListener('click',()=>{rebuildFlow();draw();});
 $('studio-date').value=new Date().toLocaleDateString('en-CA');
 $('studio-sun-calc').addEventListener('click',async()=>{
   try{
     const lat=$('studio-lat').value,lon=$('studio-lon').value;
     if(!lat.trim()||!lon.trim())throw Error('请先填写房屋的经度和纬度');
     const latitude=Number(lat),longitude=Number(lon);
     const date=localSolarDate({latitude,longitude,date:$('studio-date').value,
       time:Number($('studio-hour').value),timezone:Number($('studio-tz').value)});
     const sun=await import('../vendor/suncalc.js');
     const position=sun.getPosition(date,latitude,longitude);
     const altitude=position.altitude*180/Math.PI;
     const azimuth=(position.azimuth*180/Math.PI+540)%360;
     $('studio-sun-status').textContent='太阳高度 '+altitude.toFixed(1)+'°，真北方位角 '+
       azimuth.toFixed(1)+'°；实际室内采光仍需窗户方位和遮挡校准。';
   }catch(err){$('studio-sun-status').textContent='无法计算：'+err.message;}
 });
 function enterRender(){
   const slug=readDemo(),next='./photoreal.html?embed=1'+
     (slug?'&template='+encodeURIComponent(slug):'');
   // The child renderer reads the exact Studio document via shared storage.
   frame.src=next;
   $('studio-render-status').textContent='按需加载当前设计的 WebGPU 渲染，未跳转页面。';
 }
 function leaveRender(){frame.src='about:blank';}
 frame.addEventListener('load',()=>{
   if(frame.getAttribute('src')==='about:blank')return;
   $('studio-render-status').textContent='预览已载入。如设备不支持 WebGPU，渲染区域会显示说明。';
 });
 $('studio-render-refresh').addEventListener('click',enterRender);
 for(const kind of ['samples','wall']){
   const attr=kind==='samples'?'data-render-samples':'data-render-wall';
   const inside=kind==='samples'?'data-samples':'data-wall';
   const area=kind==='samples'?'#samples':'#wall-mode';
   document.querySelectorAll('['+attr+']').forEach(button=>button.addEventListener('click',()=>{
     try{
       const target=frame.contentDocument?.querySelector(area+' ['+inside+'="'+button.getAttribute(attr)+'"]');
       if(!target)throw Error('still initializing');
       target.click();
       document.querySelectorAll('['+attr+']').forEach(other=>other.classList.toggle('active',other===button));
     }catch{
       $('studio-render-status').textContent='渲染尚未就绪；请先检查 WebGPU 兼容性。';
     }
   }));
 }
 return {activatePanel,drawOverlay,enterRender,leaveRender,
   onProjectChange(){if(panel==='analysis'){rebuildFlow();drawOverlay();}updateProjectLabel();}};
}
