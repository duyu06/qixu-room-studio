import {airflowRoute} from './studio-airflow-path.js';
import * as THREE from 'three';
// Educational airflow streamlines only. NOT Navier-Stokes/CFD velocity predictions.
export function makeAirflowOverlay(doc,{count=48}={}){
 const group=new THREE.Group();group.name='airflow-preview';
 const route=airflowRoute(doc);
 if(!route||route.length<2)return {group,update:()=>{},available:false};
 const lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths.at(-1)+Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]));
 const total=lengths.at(-1);if(total<.01)return {group,update:()=>{},available:false};
 const sample=t=>{
  const d=t*total;let j=1;while(j<lengths.length-1&&lengths[j]<d)j++;
  const q=(d-lengths[j-1])/Math.max(1e-9,lengths[j]-lengths[j-1]);
  return [route[j-1][0]*(1-q)+route[j][0]*q,route[j-1][1]*(1-q)+route[j][1]*q];
 };
 const points=new Float32Array(count*3),phases=new Float32Array(count);
 const noise=i=>((i*16807%997)/997-.5);
 for(let i=0;i<count;i++)phases[i]=i/count;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(points,3));
 const material=new THREE.PointsMaterial({color:0x16a8c2,size:.115,transparent:true,opacity:.85,
   depthWrite:false,sizeAttenuation:true});
 const particles=new THREE.Points(geometry,material);particles.frustumCulled=false;group.add(particles);
 const update=(time,speed=1)=>{
   for(let i=0;i<count;i++){
     const t=(phases[i]+time*speed*.00006)%1,j=i*3;
     const [x,z]=sample(t);
     points[j]=x+noise(i)*.045;
     points[j+1]=.7+((i%7)/7)*1.2;
     points[j+2]=z+noise(i+33)*.045;
   }
   geometry.attributes.position.needsUpdate=true;
 };
 update(0);
 return {group,update,available:true};
}
