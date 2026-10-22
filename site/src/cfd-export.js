// Geometry and boundary conditions for a future CFD meshing service; NOT an OpenFOAM simulation.
export function makeCfdInput(plan,{door,window,inletSpeedMps=0.5,heightM=2.8,northDeg=0}={}){
  if(!plan||!Number.isFinite(plan.w)||!Number.isFinite(plan.d)||plan.w<=1||plan.d<=1||!plan.crop||!Array.isArray(plan.walls))
    throw new Error('请先导入有效户型图');
  for(const port of [door,window])
    if(!Number.isFinite(port?.x)||!Number.isFinite(port?.z)||Math.abs(port.x)>plan.w/2+.2||Math.abs(port.z)>plan.d/2+.2)
      throw new Error('请校准门窗位置');
  if(Math.hypot(door.x-window.x,door.z-window.z)<.65)throw new Error('门窗位置不能重叠');
  const {left,right,top,bottom}=plan.crop;
  const coord=(x,y)=>[(x-left)/(right-left)*plan.w-plan.w/2,(y-top)/(bottom-top)*plan.d-plan.d/2];
  return {
    schema:'qixu-cfd-input',version:'0.1.0',units:{distance:'m',velocity:'m/s'},status:'UNVALIDATED_GEOMETRY_ONLY',
    room:{widthM:plan.w,depthM:plan.d,heightM,northDeg,scaleMeasured:false},
    geometry:{walls:plan.walls.map(([x1,y1,x2,y2])=>({a:coord(x1,y1),b:coord(x2,y2),heightM,thicknessM:.10})),
      furniture:(plan.furniture||[]).map(({x,z,dims,angle=0},id)=>({id,centerM:[x,z],dimensionsM:dims,yawRad:angle}))},
    boundaries:{inlet:{type:'velocityInlet',positionM:[door.x,door.z],assumedVelocityMps:inletSpeedMps,
        assumedOpeningWidthM:.85,assumedOpeningHeightM:2.0},
      outlet:{type:'pressureOutlet',positionM:[window.x,window.z],referencePressurePa:0,
        assumedOpeningWidthM:1.2,assumedOpeningHeightM:1.2}},
    warnings:['从图片比例估算，未校准尺寸与窗台高度。','尚未生成封闭网格、CFD 边界面或 OpenFOAM 求解结果。',
      '必须验证墙体闭合、开口立面、风压和通风条件后才能进行工程计算。']
  };
}
