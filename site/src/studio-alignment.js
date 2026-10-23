// Furniture placement helpers: metric center/edge alignment and equal-spacing hints.
// Geometry-only module, without rendering or external dependencies.
export function snapFurniture(doc,movingId,x,z,{threshold=.16}={}){
 const moving=doc.furniture.find(f=>f.id===movingId);
 if(!moving)return {x,z,guides:[]};
 const guides=[],targets=doc.furniture.filter(f=>f.id!==movingId);
 let bestX={distance:threshold,value:x,guide:null},bestZ={distance:threshold,value:z,guide:null};
 for(const other of targets){
  const xValues=[{value:other.x,label:'中心'},{value:other.x-other.width/2+moving.width/2,label:'左边缘'},
    {value:other.x+other.width/2-moving.width/2,label:'右边缘'}];
  const zValues=[{value:other.z,label:'中心'},{value:other.z-other.depth/2+moving.depth/2,label:'上边缘'},
    {value:other.z+other.depth/2-moving.depth/2,label:'下边缘'}];
  for(const target of xValues){const d=Math.abs(target.value-x);
    if(d<bestX.distance){bestX={distance:d,value:target.value,guide:{axis:'x',value:target.value,label:target.label,otherId:other.id}};}}
  for(const target of zValues){const d=Math.abs(target.value-z);
    if(d<bestZ.distance){bestZ={distance:d,value:target.value,guide:{axis:'z',value:target.value,label:target.label,otherId:other.id}};}}
 }
 if(bestX.guide)guides.push(bestX.guide);
 if(bestZ.guide)guides.push(bestZ.guide);
 return {x:bestX.value,z:bestZ.value,guides};
}
export function alignFurniture(doc,ids,axis='x',mode='center'){
 const items=doc.furniture.filter(f=>ids.includes(f.id));
 if(items.length<2)throw Error('至少需要两件家具');
 if(!['x','z'].includes(axis)||!['center','start','end'].includes(mode))throw Error('不支持的对齐方式');
 const size=f=>axis==='x'?f.width:f.depth;
 const coordinate=f=>f[axis];
 const edge=f=>mode==='center'?coordinate(f):coordinate(f)+(mode==='start'?-1:1)*size(f)/2;
 const target=items.reduce((sum,f)=>sum+edge(f),0)/items.length;
 for(const f of items)f[axis]=target-(mode==='center'?0:(mode==='start'?-1:1)*size(f)/2);
 return items;
}
