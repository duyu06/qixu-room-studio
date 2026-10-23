// On-demand IFC wall importer, using the self-hosted web-ifc WASM runtime.
// This imports measurable architectural wall footprints, not the complete BIM graph.
import {createProject,validateProject} from './studio-model.js';

export async function parseIfcWallPlan(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<64||buffer.byteLength>8_000_000)
  throw Error('仅支持不超过 8MB 的 IFC STEP 模型');
 const header=new TextDecoder().decode(new Uint8Array(buffer,0,Math.min(buffer.byteLength,2048)));
 if(!header.includes('ISO-10303-21'))throw Error('不是 IFC STEP 文件');
 const {IfcAPI}=await import('../vendor/ifc/web-ifc-api.js');
 if(typeof IfcAPI!=='function')throw Error('IFC 浏览器解析器加载失败');
 const api=new IfcAPI();let model;
 try{
  api.SetWasmPath(new URL('../vendor/ifc/',import.meta.url).href,true);
  await api.Init(undefined,true);
  model=api.OpenModel(new Uint8Array(buffer),{COORDINATE_TO_ORIGIN:false});
  const schema=api.GetModelSchema(model);
  const walls=[],unsupported=[];
  const types=['IFCWALL','IFCWALLSTANDARDCASE'].map(x=>api.GetTypeCodeFromName(x)).filter(Number.isFinite);
  // IFC geometry's world matrices use X/Y horizontal and Z vertical.
  api.StreamAllMeshesWithTypes(model,types,flat=>{
   if(walls.length>=500)return;
   const pts=[];
   for(let i=0;i<flat.geometries.size();i++){
    const placed=flat.geometries.get(i);
    const geom=api.GetGeometry(model,placed.geometryExpressID);
    try{
     const verts=api.GetVertexArray(geom.GetVertexData(),geom.GetVertexDataSize());
     const m=placed.flatTransformation;
     const sampleStride=Math.max(1,Math.floor((verts.length/6)/250));
     for(let v=0;v<verts.length;v+=6*sampleStride){
      const x=verts[v],y=verts[v+1],z=verts[v+2];
      const px=m[0]*x+m[4]*y+m[8]*z+m[12];
      const py=m[1]*x+m[5]*y+m[9]*z+m[13];
      if(Number.isFinite(px)&&Number.isFinite(py))pts.push([px,py]);
     }
    }finally{geom.delete?.();}
   }
   if(pts.length<3){unsupported.push(flat.expressID);return;}
   const center=pts.reduce((acc,p)=>[acc[0]+p[0]/pts.length,acc[1]+p[1]/pts.length],[0,0]);
   let xx=0,xy=0,yy=0;
   for(const p of pts){const dx=p[0]-center[0],dy=p[1]-center[1];xx+=dx*dx;xy+=dx*dy;yy+=dy*dy;}
   const angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle);
   let low=Infinity,high=-Infinity;
   for(const p of pts){const t=(p[0]-center[0])*ux+(p[1]-center[1])*uy;low=Math.min(low,t);high=Math.max(high,t);}
   if(high-low<.2){unsupported.push(flat.expressID);return;}
   walls.push({id:'ifc-'+flat.expressID,ifcExpressId:flat.expressID,layer:'IFC_WALL',
     a:[center[0]+low*ux,center[1]+low*uy],b:[center[0]+high*ux,center[1]+high*uy]});
  },true);
  if(!walls.length)throw Error('IFC 中没有可转换的实体墙体；未修改当前户型');
  const points=walls.flatMap(w=>[w.a,w.b]),minX=Math.min(...points.map(x=>x[0])),maxX=Math.max(...points.map(x=>x[0]));
  const minY=Math.min(...points.map(x=>x[1])),maxY=Math.max(...points.map(x=>x[1]));
  if(!Number.isFinite(minX+maxX+minY+maxY)||maxX-minX>98||maxY-minY>98)
   throw Error('IFC 尺寸超出单层户型范围，请检查单位或筛选楼层');
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  const project=createProject();project.title='IFC 墙体户型';
  project.width=Math.max(3,Math.ceil((maxX-minX+1.5)*10)/10);
  project.depth=Math.max(3,Math.ceil((maxY-minY+1.5)*10)/10);
  project.walls=walls.map(w=>({...w,a:[+(w.a[0]-centerX).toFixed(4),+(centerY-w.a[1]).toFixed(4)],
     b:[+(w.b[0]-centerX).toFixed(4),+(centerY-w.b[1]).toFixed(4)]}));
  project.openings=[];project.furniture=[];project.reference=null;
  const error=validateProject(project);if(error)throw Error('IFC 墙体不能导入：'+error);
  const warnings=['只导入可识别的墙体中心线；门窗、楼板、楼层和其他 BIM 属性仍需核对'];
  if(unsupported.length)warnings.push(unsupported.length+' 个墙体缺少有效几何，未转换');
  return {project,schema,wallCount:project.walls.length,warnings};
 }finally{if(model!==undefined)api.CloseModel(model);}
}
