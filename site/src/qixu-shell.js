import {PAGES,demoId,renderLink,studioLink} from './qixu-routes.js';

const basename=location.pathname.split('/').pop()||'index.html';
const current=basename==='showcase.html'?'showcase':
  basename==='studio.html'?'studio':
  basename==='photoreal.html'?'render':'analysis';
const demo=demoId(new URLSearchParams(location.search).get('template'));
for(const brand of document.querySelectorAll('[data-qixu-brand]')){
  const img=document.createElement('img');
  img.src='./assets/qixu-logo-horizontal.png';
  img.alt='栖序 QIXU 官方标识';
  img.width=260;img.height=85;img.decoding='async';
  brand.replaceChildren(img);
}
for(const slot of document.querySelectorAll('[data-qixu-nav]')){
 const menu=document.createElement('details');menu.className='qx-hub-menu';
 const summary=document.createElement('summary');
 summary.textContent='切换模块';summary.setAttribute('aria-label','切换栖序功能模块');
 const list=document.createElement('nav');list.className='qx-hub-links';
 list.setAttribute('aria-label','栖序产品功能导航');
 for(const entry of PAGES){
  const link=document.createElement('a');
  link.href=entry.key==='render'?renderLink(demo):
    entry.key==='studio'?studioLink(demo):entry.href;
  link.textContent=entry.label;
  if(entry.key===current){link.setAttribute('aria-current','page');}
  list.append(link);
 }
 menu.append(summary,list);slot.replaceChildren(menu);
}
for(const link of document.querySelectorAll('[data-qixu-render-link]')){
 link.href=renderLink(demo);
}
for(const link of document.querySelectorAll('[data-qixu-studio-link]')){
 link.href=studioLink(demo);
}
document.addEventListener('pointerdown',event=>{
 for(const menu of document.querySelectorAll('.qx-hub-menu[open]')){
  if(!menu.contains(event.target))menu.open=false;
 }
});
