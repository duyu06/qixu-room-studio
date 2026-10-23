import * as THREE from 'three';
// Educational airflow streamlines only. NOT Navier-Stokes/CFD velocity predictions.
export function makeAirflowOverlay(doc,{count=48}={}){
 const group=new THREE.Group();group.name='airflow-preview';
 const openings=doc.openings.filter(o=>o.kind==='door'||o.kind==='window')
  .map(o=>{const w=doc.walls.find(w=>w.id===o.wallId);if(!w)return null;
    return {x:w.a[0]+(w.b[0]-w.a[0])*o.t,z:w.a[1]+(w.b[1]-w.a[1])*o.t};}).filter(Boolean);
 if(openings.length<2)return {group,update:()=>{},available:false};
 const a=openings[0],b=openings.at(-1);
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
     points[j]=a.x+(b.x-a.x)*t+noise(i)*.28*Math.sin(Math.PI*t);
     points[j+1]=.7+((i%7)/7)*1.2;
     points[j+2]=a.z+(b.z-a.z)*t+noise(i+33)*.26*Math.sin(Math.PI*t);
   }
   geometry.attributes.position.needsUpdate=true;
 };
 update(0);
 return {group,update,available:true};
}
