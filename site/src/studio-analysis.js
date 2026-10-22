import {PressureFlow2D} from './airflow-solver.js';
import {studioToRenderPayload} from './studio-render-bridge.js';
import {interpolated,validateProject} from './studio-model.js';

function port(doc,kind){
 const opening=doc.openings.find(x=>x.kind===kind);
 if(!opening)return null;
 const wall=doc.walls.find(w=>w.id===opening.wallId);
 if(!wall)return null;
 const [x,z]=interpolated(wall,opening.t);
 return {x,z};
}
/** Reuse V8 pressure-field solver on the ONE editable Studio document. */
export function projectAirflow(doc,grid=64){
 const err=validateProject(doc);if(err)throw Error(err);
 const door=port(doc,'door'),window=port(doc,'window');
 if(!door||!window)throw Error('气流分析需要至少一扇门和一扇窗');
 const plan=studioToRenderPayload(doc).plan;
 return {solver:new PressureFlow2D({...plan,door,window},grid),door,window};
}
/** Screen-space SVG trajectories; lengths are in actual project metres. */
export function flowTrajectories(doc,count=18){
 const {solver,door,window}=projectAirflow(doc);
 const routes=[];
 for(let i=0;i<count;i++){
  const theta=i*2.399963,rad=.11+.12*((i%7)/7);
  let x=door.x+Math.cos(theta)*rad,z=door.z+Math.sin(theta)*rad;
  const line=[[x,z]];
  for(let j=0;j<240;j++){
   const v=solver.velocity(x,z);
   if(v.speed<.002||solver.blocked(x,z))break;
   const step=solver.trace(x,z,.075);
   if(step.blocked)break;
   x=step.x;z=step.z;
   if(j%3===0)line.push([x,z]);
   if(Math.hypot(x-window.x,z-window.z)<.22)break;
  }
  if(line.length>3)routes.push(line);
 }
 return {routes,door,window,nx:solver.nx,nz:solver.nz};
}
export function validateSolarInputs({latitude,longitude,date,time,timezone}){
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||
    !Number.isFinite(longitude)||Math.abs(longitude)>180||
    !Number.isFinite(timezone)||timezone<-12||timezone>14||
    !Number.isFinite(time)||time<0||time>=24||
    !/^\d{4}-\d{2}-\d{2}$/.test(date))return '请输入有效的经纬度、日期、当地时间和 UTC 时区';
 return null;
}
export function localSolarDate(input){
 const err=validateSolarInputs(input);if(err)throw Error(err);
 const t=Math.round(input.time*60),minutes=t%60,hours=Math.floor(t/60);
 const offset=Math.abs(input.timezone),tzHour=Math.floor(offset);
 const tzMinute=Math.round((offset%1)*60);
 const sign=input.timezone>=0?'+':'-';
 const pad=n=>String(n).padStart(2,'0');
 const iso=input.date+'T'+pad(hours)+':'+pad(minutes)+':00'+sign+pad(tzHour)+':'+pad(tzMinute);
 const date=new Date(iso);if(!Number.isFinite(+date))throw Error('日期无效');
 return date;
}
