import {SHOWCASE_TEMPLATES,makeShowcaseTemplate} from './showcase-templates.js';
import {studioLink} from './qixu-routes.js';
import {length,interpolated,wallPieces,FURNITURE} from './studio-model.js';

const ns='http://www.w3.org/2000/svg';
const element=(name,attrs={},text)=>{
 const node=document.createElementNS(ns,name);
 for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
 if(text!==undefined)node.textContent=text;
 return node;
};
function furnitureArt(svg,f){
 const group=element('g',{transform:'translate('+f.x+' '+f.z+') rotate('+(f.rotation*180/Math.PI)+')'});
 const base=element('rect',{x:-f.width/2,y:-f.depth/2,width:f.width,height:f.depth,rx:.07,
   fill:FURNITURE[f.type]?.color||'#b3af9f',stroke:'#fffef8','stroke-width':.028});
 group.append(base);
 if(f.type==='sofa'){
  group.append(element('rect',{x:-f.width/2+.1,y:-f.depth/2+.08,width:f.width-.2,height:f.depth-.16,rx:.07,fill:'#cedbd1'}));
  group.append(element('line',{x1:0,y1:-f.depth/2+.13,x2:0,y2:f.depth/2-.08,stroke:'#94ae9d','stroke-width':.025}));
 }else if(f.type==='bed'){
  group.append(element('rect',{x:-f.width/2+.12,y:-f.depth/2+.12,width:f.width-.24,height:f.depth-.24,rx:.06,fill:'#f5efe7'}));
  group.append(element('rect',{x:-f.width/2+.14,y:-f.depth/2+.15,width:f.width-.28,height:.35,rx:.07,fill:'#ded7ca'}));
 }else if(f.type==='rug'){
  group.append(element('rect',{x:-f.width/2+.12,y:-f.depth/2+.12,width:f.width-.24,height:f.depth-.24,rx:.04,
  fill:'none',stroke:'#f6ead6','stroke-width':.035,'stroke-dasharray':'.1 .08'}));
 }else if(f.type==='plant'){
  group.append(element('circle',{cx:0,cy:0,r:Math.min(f.width,f.depth)*.36,fill:'#496f55'}));
  group.append(element('circle',{cx:.12,cy:-.08,r:.12,fill:'#79a17a'}));
 }else if(f.type==='table'){
  group.append(element('rect',{x:-f.width*.38,y:-f.depth*.35,width:f.width*.76,height:f.depth*.70,
  rx:.12,fill:'#e7d5bc',stroke:'#bda084','stroke-width':.025}));
 }
 svg.append(group);
}
function drawPlan(project){
 const svg=element('svg',{viewBox:[-project.width/2,-project.depth/2,project.width,project.depth].join(' '),
  preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':project.title+' 实际墙体与家具布置预览'});
 const defs=element('defs');
 const wood=element('pattern',{id:'wood-'+project.width,patternUnits:'userSpaceOnUse',width:.46,height:.46});
 wood.append(element('path',{d:'M0 0L0 .46',stroke:'#ffffff','stroke-width':.015,opacity:.46}));
 defs.append(wood);svg.append(defs);
 svg.append(element('rect',{x:-project.width/2,y:-project.depth/2,width:project.width,height:project.depth,
  rx:.1,fill:'#f1eee7'}));
 svg.append(element('rect',{x:-project.width/2,y:-project.depth/2,width:project.width,height:project.depth,
  fill:project.floor,opacity:.87}));
 svg.append(element('rect',{x:-project.width/2,y:-project.depth/2,width:project.width,height:project.depth,
  fill:'url(#wood-'+project.width+')',opacity:.48}));
 for(const item of project.furniture)furnitureArt(svg,item);
 for(const wall of project.walls){
  const L=length(wall);
  for(const piece of wallPieces(project,wall)){
   if(piece.bottom!==0||piece.top<.3)continue;
   // At floor height, a door is void; a window remains a sill and is highlighted.
   const a=interpolated(wall,piece.start/L),b=interpolated(wall,piece.end/L);
   svg.append(element('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#4c6154',
    'stroke-width':Math.max(.10,project.thickness*1.7),'stroke-linecap':'square'}));
  }
 }
 for(const o of project.openings){
  const wall=project.walls.find(w=>w.id===o.wallId);
  const L=length(wall),center=interpolated(wall,o.t),vx=(wall.b[0]-wall.a[0])/L,vz=(wall.b[1]-wall.a[1])/L;
  const a=[center[0]-vx*o.width/2,center[1]-vz*o.width/2];
  const b=[center[0]+vx*o.width/2,center[1]+vz*o.width/2];
  svg.append(element('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],
   stroke:o.kind==='door'?'#f6e9d3':'#83bfd1','stroke-width':.17}));
 }
 return svg;
}
const slugs=SHOWCASE_TEMPLATES.map(x=>x.slug);
const hero=document.getElementById('hero-plan'),heroName=document.getElementById('hero-name');
const heroButton=document.querySelector('.hero-buttons .primary');
let active=0;
function switchHero(next){
 active=(next+slugs.length)%slugs.length;
 const template=SHOWCASE_TEMPLATES[active],doc=makeShowcaseTemplate(template.slug);
 hero.replaceChildren(drawPlan(doc));heroName.textContent=template.name;
 heroButton.href=studioLink(template.slug);
}
document.getElementById('hero-prev').addEventListener('click',()=>switchHero(active-1));
document.getElementById('hero-next').addEventListener('click',()=>switchHero(active+1));
const gallery=document.getElementById('projects');
for(const metadata of SHOWCASE_TEMPLATES){
 const doc=makeShowcaseTemplate(metadata.slug);
 const card=document.createElement('article');card.className='project';
 const art=document.createElement('div');art.className='project-art';
 const chip=document.createElement('span');chip.className='project-chip';chip.textContent=metadata.tag;
 art.append(chip,drawPlan(doc));
 const details=document.createElement('div');details.className='project-details';
 const n=document.createElement('span');n.className='project-number';n.textContent='SPACE '+metadata.number+'  /  '+(doc.width*doc.depth).toFixed(0)+'㎡ 画布范围';
 const title=document.createElement('h3');title.className='project-title';title.textContent=metadata.name;
 const text=document.createElement('p');text.className='project-desc';text.textContent=metadata.subtitle;
 const action=document.createElement('a');action.className='project-action';
 action.href=studioLink(metadata.slug);
 action.append(document.createTextNode('打开可编辑样板间'),Object.assign(document.createElement('span'),{textContent:'↗'}));
 details.append(n,title,text,action);card.append(art,details);gallery.append(card);
}
switchHero(0);
