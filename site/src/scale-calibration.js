// Absolute scale calibration using two image points with a known real-world distance.
// Input points are IMAGE COORDINATES, in the same units as plan.crop and plan.walls.
// Returns an independent copy. All world-space positions are scaled; physical furniture
// dimensions are not automatically scaled (catalog furniture already use meters).
export function calibrateFloorplan(plan, start, end, distanceMeters){
  if(!plan || !plan.crop || !Number.isFinite(plan.w) || !Number.isFinite(plan.d)
      || plan.w<=0 || plan.d<=0)throw new Error('没有可校准的户型。');
  if(!Array.isArray(start)||!Array.isArray(end)||start.length!==2||end.length!==2
    ||![...start,...end].every(Number.isFinite))throw new Error('请选择两个有效测量点。');
  const meters=Number(distanceMeters);
  if(!Number.isFinite(meters)||meters<.1||meters>40)throw new Error('已知距离必须在 0.1 至 40 米之间。');
  const c=plan.crop,cw=c.right-c.left,ch=c.bottom-c.top;
  if(!Number.isFinite(cw)||!Number.isFinite(ch)||cw<=0||ch<=0)throw new Error('户型底图范围无效。');
  for(const p of [start,end]){
    if(p[0]<c.left||p[0]>c.right||p[1]<c.top||p[1]>c.bottom)
      throw new Error('测量点必须落在户型区域内。');
  }
  const dx=(end[0]-start[0])*plan.w/cw;
  const dz=(end[1]-start[1])*plan.d/ch;
  const inferred=Math.hypot(dx,dz);
  if(inferred<.05)throw new Error('两个点距离太近，请重新点选。');
  const scale=meters/inferred, width=plan.w*scale, depth=plan.d*scale;
  if(width<1||depth<1||width>100||depth>100)
    throw new Error('校准结果超出 1–100 米的可编辑房间范围，请检查输入。');
  const copy=structuredClone(plan);
  copy.w=Number(width.toFixed(5));copy.d=Number(depth.toFixed(5));
  for(const f of copy.furniture||[]){f.x*=scale;f.z*=scale;} // Do not resize physical furniture!
  const v=copy.ventilation;
  for(const port of [v?.door,v?.window])if(port){port.x*=scale;port.z*=scale;}
  copy.calibration={
    kind:'two-points', distanceMeters:meters,
    imagePoints:[start.slice(),end.slice()],
    metersPerImageUnit:Number((meters/Math.hypot(end[0]-start[0],end[1]-start[1])).toFixed(7)),
    calibratedAt:new Date().toISOString(),
    measuredByUser:true
  };
  return copy;
}
