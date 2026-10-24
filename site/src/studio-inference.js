// Deterministic inferred 3D construction report from the editable metric plan.
// No computer vision or floor-plan dimension claims; unknown geometry remains unknown.
export function inferModel(doc){
 if(!doc||!Array.isArray(doc.walls)||!Array.isArray(doc.openings))throw Error('无效户型');
 const length=w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
 const walls=doc.walls.filter(w=>length(w)>.05);
 const validOpenings=[],issues=[];
 for(const o of doc.openings){
  const w=walls.find(w=>w.id===o.wallId);
  if(!w){issues.push('门窗 '+o.id+' 无匹配墙体');continue;}
  const half=o.width/(2*length(w));
  if(o.t-half<0||o.t+half>1)issues.push('门窗 '+o.id+' 超出墙段边界');
  if(o.sill+o.height>doc.wallHeight+.001)issues.push('门窗 '+o.id+' 高于墙顶');
  validOpenings.push(o);
 }
 const netWallFace=walls.reduce((sum,w)=>sum+length(w)*doc.wallHeight,0)-
  validOpenings.reduce((sum,o)=>sum+o.width*o.height,0);
 const floorArea=doc.width*doc.depth;
 return {
  walls:walls.length,openings:validOpenings.length,furniture:doc.furniture.length,
  wallHeight:doc.wallHeight,wallThickness:doc.thickness,
  approximateFloorArea:floorArea,approximateVolume:floorArea*doc.wallHeight,
  approximateWallFaceArea:Math.max(0,netWallFace),
  assumptions:['墙体按当前 2D 中心线拉伸','门窗按已录入宽高及窗台高度开孔',
    '家具使用已知尺寸和朝向；缺少 GLB 时使用简化几何','未知的楼板厚度、梁柱与真实施工构造不作推断'],
  issues,complete:issues.length===0&&walls.length>0,
  source:'editable-plan',engineeringValidated:false
 };
}
