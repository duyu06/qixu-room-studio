// 栖序 Studio: versioned editable metric floor plan, independent of the renderer.
export const MODEL_VERSION = 1;
export const FURNITURE = Object.freeze({
  sofa:{label:'三人沙发',icon:'▰',w:2.2,d:.88,h:.8,color:'#879c91'},
  bed:{label:'双人床',icon:'▣',w:1.8,d:2,h:.6,color:'#c6ab8f'},
  table:{label:'餐桌',icon:'◯',w:1.45,d:.9,h:.76,color:'#b99a79'},
  chair:{label:'单椅',icon:'♙',w:.52,d:.54,h:.84,color:'#94a5a2'},
  cabinet:{label:'储物柜',icon:'▤',w:1.3,d:.52,h:1.7,color:'#af9d86'},
  plant:{label:'绿植',icon:'✿',w:.55,d:.55,h:1.15,color:'#789476'},
  desk:{label:'书桌',icon:'▥',w:1.25,d:.6,h:.75,color:'#a48d78'},
  rug:{label:'地毯',icon:'▦',w:2.2,d:1.5,h:.025,color:'#d9c6ac'}
});
export const id=()=> 'q'+Math.random().toString(36).slice(2,10);
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const point=(x,z)=>[Number(x),Number(z)];
export const length=w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
export const interpolated=(w,t)=>[w.a[0]+(w.b[0]-w.a[0])*t,w.a[1]+(w.b[1]-w.a[1])*t];
export function createProject(){
  const walls=[
    {id:id(),a:[-5,-3.4],b:[5,-3.4]}, {id:id(),a:[5,-3.4],b:[5,3.4]},
    {id:id(),a:[5,3.4],b:[-5,3.4]}, {id:id(),a:[-5,3.4],b:[-5,-3.4]},
    {id:id(),a:[.8,-3.4],b:[.8,3.4]}
  ];
  return {schema:'qixu-studio',version:MODEL_VERSION,title:'我的第一个空间',width:12,depth:9,
    wallHeight:2.8,thickness:.14,lightingMode:'day',wallPattern:'paint',floorPattern:'auto',textureRepeat:3,flowPressurePa:5,flowInlet:1,flowOutlet:1,airflowSource:'opening',airflowX:0,airflowZ:0,airflowSpread:1.5,floor:'#ded4c3',wallColor:'#fffaf0',reference:null,
    walls,openings:[
      {id:id(),kind:'door',wallId:walls[4].id,t:.52,width:.9,height:2.1,sill:0},
      {id:id(),kind:'door',wallId:walls[0].id,t:.48,width:.9,height:2.1,sill:0},
      {id:id(),kind:'window',wallId:walls[2].id,t:.31,width:1.75,height:1.35,sill:.85}
    ],furniture:[]};
}
// Prioritize wall endpoints, then wall centerlines, then the metric grid.
// Exclusion avoids a dragged endpoint snapping back to its own previous position.
export function snapPosition(p,doc,grid=.1,{excludePoint=null,excludeWallId=null,disable=false}={}){
 if(disable)return [...p];
 const excluded=end=>excludePoint&&Math.hypot(end[0]-excludePoint[0],end[1]-excludePoint[1])<.025;
 let best=null,bestDist=.22;
 for(const wall of doc.walls)for(const end of [wall.a,wall.b]){
   if(excluded(end))continue;
   const distance=Math.hypot(p[0]-end[0],p[1]-end[1]);
   if(distance<bestDist){best=[...end];bestDist=distance;}
 }
 if(best)return best;
 // Intersections are a stronger target than generic line projections.
 for(let i=0;i<doc.walls.length;i++)for(let j=i+1;j<doc.walls.length;j++){
   const a=doc.walls[i],b=doc.walls[j];
   if(a.id===excludeWallId||b.id===excludeWallId)continue;
   const [ax,az]=a.a,[bx,bz]=a.b,[cx,cz]=b.a,[dx,dz]=b.b;
   const rx=bx-ax,rz=bz-az,sx=dx-cx,sz=dz-cz,den=rx*sz-rz*sx;
   if(Math.abs(den)<1e-9)continue;
   const t=((cx-ax)*sz-(cz-az)*sx)/den;
   const u=((cx-ax)*rz-(cz-az)*rx)/den;
   if(t<0||t>1||u<0||u>1)continue;
   const intersection=[ax+t*rx,az+t*rz];
   if(excluded(intersection))continue;
   const dist=Math.hypot(p[0]-intersection[0],p[1]-intersection[1]);
   if(dist<bestDist){best=intersection;bestDist=dist;}
 }
 if(best)return best.map(v=>Number(v.toFixed(3)));
 // Snap to a wall axis without shifting away from its physical centerline.
 best=null;bestDist=.12;
 for(const wall of doc.walls){
   if(wall.id===excludeWallId)continue;
   const vx=wall.b[0]-wall.a[0],vz=wall.b[1]-wall.a[1],sq=vx*vx+vz*vz;
   if(sq<.0001)continue;
   const t=clamp(((p[0]-wall.a[0])*vx+(p[1]-wall.a[1])*vz)/sq,0,1);
   const projected=[wall.a[0]+t*vx,wall.a[1]+t*vz];
   if(excluded(projected))continue;
   const distance=Math.hypot(p[0]-projected[0],p[1]-projected[1]);
   if(distance<bestDist){best=projected;bestDist=distance;}
 }
 if(best)return best.map(v=>Number(v.toFixed(3)));
 return [Math.round(p[0]/grid)*grid,Math.round(p[1]/grid)*grid]
   .map(v=>Number(v.toFixed(3)));
}
export function nearestWall(doc,p){
  let best=null,dist=Infinity;
  for(const wall of doc.walls){
    const vx=wall.b[0]-wall.a[0],vz=wall.b[1]-wall.a[1],d=vx*vx+vz*vz;
    if(d<.09)continue;
    const t=clamp(((p[0]-wall.a[0])*vx+(p[1]-wall.a[1])*vz)/d,0,1);
    const q=interpolated(wall,t),delta=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(delta<dist){best={wall,t,distance:delta,point:q};dist=delta;}
  }
  return best;
}
export function addWall(doc,a,b){
  if(!a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('墙体坐标错误');
  const w={id:id(),a:[...a],b:[...b]};
  if(length(w)<.25)throw Error('墙体长度不能小于 0.25 米');
  if(length(w)>60)throw Error('墙体超过长度限制');
  doc.walls.push(w);return w;
}
export function addOpening(doc,kind,wallId,t,width){
  if(!['door','window'].includes(kind))throw Error('未知开口类型');
  const wall=doc.walls.find(w=>w.id===wallId);if(!wall)throw Error('墙体不存在');
  const L=length(wall),w=Number(width),offset=Number(t)*L;
  if(!(w>=.45&&w<L-.24)||offset-w/2<.12||offset+w/2>L-.12)
    throw Error('开口过宽或距离墙角太近');
  const intersects=doc.openings.some(o=>o.wallId===wallId&&
    Math.abs(o.t*L-offset)<(o.width+w)/2+.10);
  if(intersects)throw Error('此位置与已有门窗冲突');
  const object={id:id(),kind,wallId,t:Number(t),width:w,height:kind==='door'?2.1:1.25,sill:kind==='door'?0:.88};
  doc.openings.push(object);return object;
}
export function setOpeningDimension(doc,o,values){
  const wall=doc.walls.find(w=>w.id===o.wallId);if(!wall)throw Error('墙体不存在');
  const old={...o};Object.assign(o,values);
  try{
    if(o.width<.45||o.width>length(wall)-.24||o.t*length(wall)-o.width/2<.12||
       o.t*length(wall)+o.width/2>length(wall)-.12||o.sill<0||o.height<.3||
       o.sill+o.height>(wall.height??doc.wallHeight)-.08)throw Error('开口超出墙体边界');
    if(doc.openings.some(a=>a.id!==o.id&&a.wallId===o.wallId&&
      Math.abs(a.t*length(wall)-o.t*length(wall))<(a.width+o.width)/2+.1))
      throw Error('与其他门窗重叠');
    if(o.kind==='door'&&o.sill!==0)throw Error('门洞底部必须贴地');
    return o;
  }catch(e){Object.assign(o,old);throw e;}
}
export function wallPieces(doc,wall){
  const L=length(wall),H=wall.height??doc.wallHeight,holes=doc.openings.filter(o=>o.wallId===wall.id)
    .sort((a,b)=>a.t-b.t);
  const solids=[];let cursor=0;
  const push=(start,end,bottom,top)=>{if(end-start>.0001&&top-bottom>.0001)
    solids.push({wallId:wall.id,start,end,bottom,top});};
  for(const o of holes){
    const start=o.t*L-o.width/2,end=o.t*L+o.width/2;
    if(start<cursor-.001)throw Error('门窗开口重叠');
    push(cursor,start,0,H);
    push(start,end,0,o.sill);
    push(start,end,o.sill+o.height,H);
    cursor=end;
  }
  push(cursor,L,0,H);return solids;
}
export function deleteObject(doc,idValue){
  const w=doc.walls.find(x=>x.id===idValue);
  if(w){doc.walls=doc.walls.filter(x=>x.id!==idValue);
    doc.openings=doc.openings.filter(x=>x.wallId!==idValue);return true;}
  for(const key of ['openings','furniture']){
    const n=doc[key].length;
    doc[key]=doc[key].filter(x=>x.id!==idValue);
    if(doc[key].length!==n)return true;
  }
  return false;
}
export function addFurniture(doc,type){
  const info=FURNITURE[type];if(!info)throw Error('未知家具类别');
  const count=doc.furniture.length;
  const x=((count%5)-2)*.5,z=(Math.floor(count/5)%4-1.5)*.5;
  const f={id:id(),type,x,z,width:info.w,depth:info.d,height:info.h,rotation:0};
  doc.furniture.push(f);return f;
}
export function validateProject(doc){
  if(!doc||doc.schema!=='qixu-studio'||doc.version!==1)return '不支持的项目格式';
  if(doc.textureRepeat!==undefined&&(!Number.isInteger(doc.textureRepeat)||doc.textureRepeat<1||doc.textureRepeat>12))return '贴图重复次数错误';
  if(doc.airflowSource!==undefined&&!['opening','custom'].includes(doc.airflowSource))return '风源类型无效';
  if(doc.airflowSpread!==undefined&&(!Number.isFinite(doc.airflowSpread)||doc.airflowSpread<.2||doc.airflowSpread>3))return '气流覆盖范围无效';
  if(doc.airflowX!==undefined&&(!Number.isFinite(doc.airflowX)||Math.abs(doc.airflowX)>doc.width/2))return '风源 X 超出房间';
  if(doc.airflowZ!==undefined&&(!Number.isFinite(doc.airflowZ)||Math.abs(doc.airflowZ)>doc.depth/2))return '风源 Z 超出房间';
  if(doc.flowPressurePa!==undefined&&(!Number.isFinite(doc.flowPressurePa)||doc.flowPressurePa<0||doc.flowPressurePa>100))return '边界压差错误';
  for(const key of ['flowInlet','flowOutlet'])if(doc[key]!==undefined&&(!Number.isFinite(doc[key])||doc[key]<0||doc[key]>1))return '门窗开度错误';
  for(const key of ['floorTexture','wallTexture'])if(doc[key]!==undefined&&
   (typeof doc[key]!=='string'||doc[key].length>1500000||!/^data:image\/(png|jpeg|webp);base64,/.test(doc[key])))return '材质贴图无效';
  if(doc.wallPattern!==undefined&&!['paint','plaster','wallpaper'].includes(doc.wallPattern))return '墙面材质类型错误';
  if(doc.floorPattern!==undefined&&!['auto','wood','stone','tile'].includes(doc.floorPattern))return '地面纹理类型错误';
  if(doc.lightingMode!==undefined&&!['day','evening','showcase'].includes(doc.lightingMode))return '光照预设错误';
  if(!Number.isFinite(doc.width)||!Number.isFinite(doc.depth)||doc.width<3||doc.depth<3||
     doc.width>100||doc.depth>100)return '房间边界尺寸错误';
  if(!Number.isFinite(doc.wallHeight)||doc.wallHeight<2||doc.wallHeight>6||
     !Number.isFinite(doc.thickness)||doc.thickness<.06||doc.thickness>.6)return '墙体参数错误';
  if(!Array.isArray(doc.walls)||doc.walls.length>1000||
     !doc.walls.every(w=>typeof w.id==='string'&&w.a?.length===2&&w.b?.length===2&&
       [...w.a,...w.b].every(Number.isFinite)&&length(w)>.2&&length(w)<100))return '墙体数据错误';
  if(!Array.isArray(doc.openings)||doc.openings.length>500||
    !doc.openings.every(o=>typeof o.id==='string'&&['door','window'].includes(o.kind)&&
      doc.walls.some(w=>w.id===o.wallId)&&Number.isFinite(o.t)&&Number.isFinite(o.width)&&
      Number.isFinite(o.height)&&Number.isFinite(o.sill)))return '门窗数据错误';
  if(doc.walls.some(w=>w.locked!==undefined&&typeof w.locked!=='boolean'))return '墙体锁定状态无效';
  if(doc.walls.some(w=>w.layer!==undefined&&!['structure','partition','decor','IFC_WALL'].includes(w.layer)))return '墙体图层无效';
  if(doc.walls.some(w=>['faceAColor','faceBColor'].some(key=>w[key]!==undefined&&!/^#[0-9a-fA-F]{6}$/.test(w[key]))))return '墙面颜色无效';
  if(doc.walls.some(w=>['faceAPattern','faceBPattern'].some(key=>w[key]!==undefined&&!['paint','plaster','wallpaper'].includes(w[key]))))return '墙面纹理类型无效';
  if(doc.walls.some(w=>['faceARepeat','faceBRepeat'].some(key=>w[key]!==undefined&&(!Number.isInteger(w[key])||w[key]<1||w[key]>12))))return '墙面纹理重复次数无效';
  if(doc.walls.some(w=>['faceARoughness','faceBRoughness','faceAMetalness','faceBMetalness'].some(key=>w[key]!==undefined&&(!Number.isFinite(w[key])||w[key]<0||w[key]>1))))return '墙面物理材质参数无效';
  if(doc.walls.some(w=>w.wallType!==undefined&&!['exterior','interior','partition'].includes(w.wallType)))return '墙体类型无效';
  if(doc.walls.some(w=>(w.thickness!==undefined&&(!Number.isFinite(w.thickness)||w.thickness<.06||w.thickness>.6))||
    (w.height!==undefined&&(!Number.isFinite(w.height)||w.height<2||w.height>6))))return '独立墙体厚度或高度无效';
  if(doc.openings.some(o=>{
    const w=doc.walls.find(w=>w.id===o.wallId);
    return o.sill+o.height>(w?.height??doc.wallHeight)-.08;
  }))return '门窗高于所在墙体';
  try {for(const w of doc.walls)wallPieces(doc,w);}catch{return '墙体开口互相重叠';}
  if(!Array.isArray(doc.furniture)||doc.furniture.length>500||
     !doc.furniture.every(f=>FURNITURE[f.type]&&[f.x,f.z,f.width,f.depth,f.height,f.rotation].every(Number.isFinite)&&
       f.width>.1&&f.depth>.1&&f.height>.005&&f.width<20&&f.depth<20))return '家具数据错误';
  if(doc.furniture.some(f=>f.modelData!==undefined&&(typeof f.modelData!=='string'||f.modelData.length>2800000||!/^data:model\/gltf-binary;base64,/.test(f.modelData))))return 'GLB 模型数据不合法';
  if(doc.reference!==null&&doc.reference!==undefined&&
    (typeof doc.reference!=='string'||doc.reference.length>12_000_000||
      !/^data:image\/(png|jpeg|webp);base64,/.test(doc.reference)))return '底图格式错误';
  return null;
}
export function importLegacy(saved){
  if(!saved?.plan?.crop||!Array.isArray(saved.plan.walls))throw Error('没有可以迁移的旧户型');
  const p=saved.plan,c=p.crop;
  const d=createProject();d.title='导入的户型';d.width=p.w;d.depth=p.d;
  d.walls=p.walls.map(line=>{
    const coord=(x,y)=>[(x-c.left)/(c.right-c.left)*p.w-p.w/2,(y-c.top)/(c.bottom-c.top)*p.d-p.d/2];
    return{id:id(),a:coord(line[0],line[1]),b:coord(line[2],line[3])};
  });
  d.openings=[];d.furniture=(p.furniture||[]).map(f=>({
    id:id(),type:FURNITURE[f.type]?f.type:'cabinet',x:f.x,z:f.z,
    width:f.dims?.[0]||.8,depth:f.dims?.[1]||.8,height:f.dims?.[2]||.8,rotation:f.angle||0
  }));
  d.reference=saved.image||null;
  return d;
}
