// Solver-agnostic export contract. Coordinates are meters: X/Z floor, Y up.
// This is a preparation artifact, NOT a CFD solution or a valid OpenFOAM mesh.
export function buildCfdJob(project,{pressurePa,openings={},maxCellSize=.25}={}){
 const finite=(n,min,max,name)=>{if(!Number.isFinite(n)||n<min||n>max)throw Error(name+'超出允许范围');return n;};
 if(!project||!Array.isArray(project.walls)||!Array.isArray(project.openings)||!Array.isArray(project.furniture))throw Error('无效户型');
 const width=finite(project.width,3,100,'宽度'),depth=finite(project.depth,3,100,'深度');
 const height=finite(project.wallHeight,2,6,'墙高');
 const deltaP=finite(Number(pressurePa??project.flowPressurePa??5),0,100,'压差');
 const cell=finite(Number(maxCellSize),.1,1,'网格尺寸');
 if(Math.ceil(width/cell)*Math.ceil(depth/cell)*Math.ceil(height/cell)>1500000)throw Error('网格预算超过限制');
 const wById=new Map(project.walls.map(w=>[w.id,w]));
 const outlets=project.openings.filter(o=>o.kind==='door'||o.kind==='window')
  .map((o,i,all)=>({id:o.id,kind:o.kind,wallId:o.wallId,
    t:finite(o.t,0,1,'开口位置'),width:finite(o.width,.1,20,'开口宽度'),
    height:finite(o.height,.1,6,'开口高度'),sill:finite(o.sill,0,6,'窗台高度'),
    openFraction:finite(Number(openings[o.id]??(i===0?project.flowInlet:i===all.length-1?project.flowOutlet:1)??1),0,1,'开度'),
    wall:wById.get(o.wallId)}));
 if(outlets.length<2||!outlets[0].openFraction||!outlets.at(-1).openFraction)throw Error('需要开启的进风口和出风口');
 for(const o of outlets)if(!o.wall)throw Error('存在缺失的墙体引用');
 const walls=project.walls.map(w=>({
  id:w.id,from:[w.a[0],0,w.a[1]],to:[w.b[0],0,w.b[1]],thickness:project.thickness,height
 }));
 const furniture=project.furniture.map(f=>({
  id:f.id,type:f.type,center:[f.x,f.height/2,f.z],size:[f.width,f.height,f.depth],rotationY:-f.rotation,
  // Imported GLB is NOT converted into collision solids in this version.
  geometry:'axis-aligned-box-proxy-in-local-coordinates'
 }));
 return {schema:'qixu-cfd-job',version:1,units:'m',axis:'Y-up',status:'input-only',
  domain:{width,depth,height},mesh:{targetCellSize:cell,maxCells:1500000},
  physics:{model:'incompressible-RANS-request',fluid:'air',densityKgM3:1.2,
    inletPressurePa:deltaP,outletPressurePa:0,turbulenceModel:'kOmegaSST-request'},
  walls,furniture,openings:outlets.map(({wall,...o})=>o),
  disclaimers:['仅为求解输入；没有生成流体域网格','门窗压差和湍流参数需校准','家具目前使用盒体障碍物近似','需独立 OpenFOAM 服务完成网格生成、求解和残差检查']};
}
