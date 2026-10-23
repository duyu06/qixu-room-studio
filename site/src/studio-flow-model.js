// Pressure-driven *reduced-order* ventilation estimate, not 3D CFD / RANS.
// Orifice Q = Cd A sqrt(2 Δp / rho), series equivalent areas.
// Furniture creates geometric route exclusion and empirical loss multiplier.
import {airflowRoute} from './studio-airflow-path.js';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function evaluateVentilation(doc,settings={}){
 const pressure=clamp(Number(settings.pressurePa??5),0,100);
 const rho=1.2,Cd=.62,openings=doc.openings.filter(o=>o.kind==='door'||o.kind==='window');
 const a=openings[0],b=openings.at(-1);
 if(!a||!b)return {available:false,reason:'至少需要两个门窗开口'};
 const fraction=o=>clamp(Number(settings.openings?.[o.id]??1),0,1);
 const area=o=>o.width*o.height*fraction(o);
 const areaA=area(a),areaB=area(b);
 if(areaA<=0||areaB<=0)return {available:false,reason:'进风或出风开口已关闭'};
 const route=airflowRoute(doc,{furniture:true,openingFractions:settings.openings});
 if(!route)return {available:false,reason:'门窗间没有可通行的路径'};
 const areaEq=1/Math.sqrt(1/areaA**2+1/areaB**2);
 const obstacles=doc.furniture.filter(f=>route.some(p=>{
   const dx=p[0]-f.x,dz=p[1]-f.z,c=Math.cos(f.rotation),s=Math.sin(f.rotation);
   const x=dx*c-dz*s,z=dx*s+dz*c;
   return Math.abs(x)<f.width/2+.5&&Math.abs(z)<f.depth/2+.5;
 }));
 const lossFactor=1+obstacles.reduce((v,f)=>v+Math.min(1,f.height/Math.max(doc.wallHeight,.1))*.3,0);
 const flowM3s=Cd*areaEq*Math.sqrt(2*pressure/rho)/Math.sqrt(lossFactor);
 const volume=doc.width*doc.depth*doc.wallHeight;
 return {available:true,route,pressurePa:pressure,flowM3s,
  airChangesPerHour:volume>0?flowM3s*3600/volume:0,
  obstacleCount:obstacles.length,lossFactor,
  turbulence:'未求解：需要网格、边界条件和湍流闭合模型',
  note:'简化孔口流量估算，仅用于方案比较；未求解三维速度场、湍流、壁面边界层及实际换气次数'};
}
