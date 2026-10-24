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

/** Snap rectangular furniture edges to horizontal/vertical walls in plan coordinates.
 * Oblique walls are intentionally excluded until oriented footprint projection exists. */
export function snapFurnitureToWalls(doc,movingId,x,z,{threshold=.18,clearance=.03}={}){
 const item=doc.furniture.find(f=>f.id===movingId);
 if(!item)return {x,z,guides:[]};
 const angle=Math.abs(((item.rotation||0)%Math.PI+Math.PI)%Math.PI);
 if(Math.min(angle,Math.abs(angle-Math.PI/2),Math.abs(angle-Math.PI))>.035)return {x,z,guides:[]};
 const turned=Math.abs(angle-Math.PI/2)<.035;
 const halfWidth=(turned?item.depth:item.width)/2,halfDepth=(turned?item.width:item.depth)/2;
 let best={distance:threshold,x,z,guide:null};
 for(const wall of doc.walls){
  const [ax,az]=wall.a,[bx,bz]=wall.b,thick=(doc.thickness||.12)/2+clearance;
  if(Math.abs(ax-bx)<.001){
   if(z+halfDepth<Math.min(az,bz)||z-halfDepth>Math.max(az,bz))continue;
   for(const side of [-1,1]){
    const proposed=ax+side*(halfWidth+thick),distance=Math.abs(x-proposed);
    if(distance<best.distance)best={distance,x:proposed,z,guide:{axis:'x',value:proposed,label:'贴墙',wallId:wall.id}};
   }
  }else if(Math.abs(az-bz)<.001){
   if(x+halfWidth<Math.min(ax,bx)||x-halfWidth>Math.max(ax,bx))continue;
   for(const side of [-1,1]){
    const proposed=az+side*(halfDepth+thick),distance=Math.abs(z-proposed);
    if(distance<best.distance)best={distance,x,z:proposed,guide:{axis:'z',value:proposed,label:'贴墙',wallId:wall.id}};
   }
  }
 }
 return {x:best.x,z:best.z,guides:best.guide?[best.guide]:[]};
}

export function distributeFurniture(doc,ids,axis='x'){
 const items=doc.furniture.filter(f=>ids.includes(f.id)).sort((a,b)=>a[axis]-b[axis]);
 if(!['x','z'].includes(axis)||items.length<3)throw Error('至少选择三件家具');
 const first=items[0][axis],last=items.at(-1)[axis],step=(last-first)/(items.length-1);
 for(let i=1;i<items.length-1;i++)items[i][axis]=first+step*i;
 return items;
}
