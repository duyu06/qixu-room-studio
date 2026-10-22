import * as THREE from 'three';
import { PressureFlow2D } from './airflow-solver.js';
import { sunCalcToScene } from './solar-model.js';
import { makeCfdInput } from './cfd-export.js';

// Pressure-field/particle tracer is physical-model-based; not decorative qi particles.
export function createVentilationStudio({scene,renderer,state,host,camera,orbit}) {
  let plan=null,solver=null,flowObjects=null,part=null,positions=null,colors=null;
  let door=null,windowPort=null,markerMode='',last=0,lastGeometry='',modelSun=null;
  let sunCalc=null,solar=null,lastSolarKey='';
  const panel=document.createElement('section');
  panel.className='v8-panel';
  panel.innerHTML='<h3>V8 · 门窗气流与日照计算</h3>'+
    '<p class="v8-note">空气由门口高压端进入，经墙体/家具之间的可通区域，流向窗口低压端。二维势流近似计算，不是测得的气流。</p>'+
    '<div class="v8-controls"><button id="v8-door" type="button">定位进风门</button><button id="v8-window" type="button">定位排风窗</button><button id="v8-recalc" type="button">重算气流</button></div>'+
    '<div class="v8-controls" style="margin-top:8px"><button id="v9-export-cfd" type="button">导出 CFD 输入</button><button id="v9-render" type="button">物理光照预览 ↗</button></div>'+
    '<label class="v8-line">示踪速度 <input id="v8-speed" type="range" min=".2" max="3" step=".1" value="1.2"><output id="v8-speed-label">1.2 ×</output></label>'+
    '<div id="v8-solver-info" class="v8-info" role="status">导入户型图后计算流场。</div>'+
    '<h4>天文太阳位置</h4>'+
    '<div class="v8-grid"><label>纬度<input id="v8-lat" type="number" step=".0001" value="39.9042"></label><label>经度<input id="v8-lon" type="number" step=".0001" value="116.4074"></label>'+
    '<label>日期<input id="v8-date" type="date" value="2026-10-22"></label><label>时区 UTC<input id="v8-tz" type="number" min="-12" max="14" step=".5" value="8"></label></div>'+
    '<button type="button" class="v8-sun-btn" id="v8-sun-apply">计算实际太阳方位</button>'+
    '<p id="v8-sun-status" class="v8-info">默认为北京演示数据，必须改成房屋实际地址和真北角度；墙体日照还需窗洞高度校准。</p>'+
    '<p class="v8-note">数值模型只反映相对气流路径。缺少外部风压/温差/门缝/立面高度，不能用于真实通风量、健康或消防判断。</p>';
  host.append(panel);
  const $=id=>panel.querySelector('#'+id);
  const airLabel=$('v8-solver-info'),sunLabel=$('v8-sun-status');
  const speed=$('v8-speed');
  speed.addEventListener('input',()=>$('v8-speed-label').textContent=Number(speed.value).toFixed(1)+' ×');
  $('v8-door').addEventListener('click',()=>arm('door'));
  $('v8-window').addEventListener('click',()=>arm('window'));
  $('v8-recalc').addEventListener('click',()=>rebuild());
  ['v8-lat','v8-lon','v8-date','v8-tz'].forEach(id=>$(id).addEventListener('change',updateSolar));
  $('v8-sun-apply').addEventListener('click',updateSolar);
  $('v9-render').addEventListener('click',()=>window.open('./photoreal.html','_blank','noopener,noreferrer'));
  $('v9-export-cfd').addEventListener('click',()=>{
    try{
      const input=makeCfdInput(plan,{door,window:windowPort,northDeg:Number(state.north||0),heightM:Number(state.height||2.8)});
      const blob=new Blob([JSON.stringify(input,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='qixu-cfd-input.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
      airLabel.textContent='已导出 CFD 几何草稿。必须测量并建网格后才能使用 OpenFOAM。';
    }catch(err){airLabel.textContent=err.message;}
  });
  function arm(mode){
    markerMode=markerMode===mode?'':mode;
    $('v8-door').classList.toggle('active',markerMode==='door');
    $('v8-window').classList.toggle('active',markerMode==='window');
    airLabel.textContent=markerMode?'已选择'+(markerMode==='door'?'进风门':'排风窗')+'，请切换俯视图，在户型图中点击门洞中心。':'已退出定位模式。';
    if(markerMode){const top=document.querySelector('#view-buttons [data-view="top"]');top?.click();}
  }
  function place(x,z){
    if(!markerMode||!plan)return false;
    const p={x:Math.max(-plan.w/2,Math.min(plan.w/2,x)),z:Math.max(-plan.d/2,Math.min(plan.d/2,z))};
    if(markerMode==='door')door=p;else windowPort=p;
    plan.ventilation={door:{...door},window:{...windowPort}};
    arm(markerMode); rebuild();return true;
  }
  function clear(){
    if(!flowObjects)return;
    scene.remove(flowObjects);
    flowObjects.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});
    flowObjects=null;part=null;
  }
  function marker(position,color,label){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.055,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false}));
    mesh.position.set(position.x,.13,position.z);mesh.name=label;flowObjects.add(mesh);
    const halo=new THREE.Mesh(new THREE.RingGeometry(.25,.33,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));
    halo.rotation.x=-Math.PI/2;halo.position.set(position.x,.16,position.z);flowObjects.add(halo);
  }
  function rebuild(){
    if(!plan)return;
    const geometry={...plan,door,window:windowPort};
    try{solver=new PressureFlow2D(geometry,88);}
    catch(e){airLabel.textContent='气流计算失败：'+e.message;console.error(e);return;}
    clear();
    flowObjects=new THREE.Group();flowObjects.name='V8-pressure-potential-ventilation';scene.add(flowObjects);
    marker(door,'#2ba9a0','进风门 · 高压');
    marker(windowPort,'#dc9953','排风窗 · 低压');
    const n=460;
    positions=new Float32Array(n*3);colors=new Float32Array(n*3);
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geom.setAttribute('color',new THREE.BufferAttribute(colors,3));
    part=new THREE.Points(geom,new THREE.PointsMaterial({size:.12,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.88,blending:THREE.AdditiveBlending,depthWrite:false}));
    part.frustumCulled=false;flowObjects.add(part);
    part.userData.seeds=Array.from({length:n},(_,i)=>({x:door.x,z:door.z,t:i/n*1.4,life:0}));
    for(let i=0;i<n;i++){positions[i*3]=door.x;positions[i*3+1]=.13;positions[i*3+2]=door.z;}
    airLabel.textContent='二维势流场已计算 · '+solver.nx+' × '+solver.nz+' 网格 · 进风门青色 / 排风窗金色；移动家具后可重算。';
  }
  function onPlan(next){
    const changed=plan!==next;
    plan=next;
    if(!plan)return;
    if(changed || plan.ventilation){
      // K-4 unit entrance opens on its eastern boundary; upper exterior is window example.
      const isK4=plan.note?.includes('K-4');
      door=plan.ventilation?.door||(isK4?solverPos(409,239):{x:plan.w*.45,z:-plan.d*.02});
      windowPort=plan.ventilation?.window||(isK4?solverPos(238,59):{x:plan.w*.04,z:-plan.d*.44});
    }
    rebuild();
    solarUpdateAfterPlan();
  }
  function solverPos(x,y){const c=plan.crop;return {x:(x-c.left)/(c.right-c.left)*plan.w-plan.w/2,z:(y-c.top)/(c.bottom-c.top)*plan.d-plan.d/2};}
  function updateParticles(time) {
    requestAnimationFrame(updateParticles);
    const dt=Math.max(0,Math.min(.045,(time-last)/1000));last=time;
    if(!part||!solver||document.hidden)return;
    const key=[state.sunHour,state.north,state.light].join('|');
    if(key!==lastSolarKey){lastSolarKey=key;updateSolar();}
    const seeds=part.userData.seeds,velocity=Number(speed.value);
    const c1=new THREE.Color('#30cbc1'),c2=new THREE.Color('#ffd18b');
    for(let i=0;i<seeds.length;i++){
      const p=seeds[i];
      if(p.t>0){p.t=Math.max(0,p.t-dt);continue;}
      if(p.life>11||Math.hypot(p.x-windowPort.x,p.z-windowPort.z)<.18){
        const theta=i*2.39996323,pad=(i*.618033)%1*.28;
        p.x=door.x+Math.cos(theta)*pad;p.z=door.z+Math.sin(theta)*pad;p.life=0;p.t=(i%11)*.04;
      }
      const before=solver.velocity(p.x,p.z),next=solver.trace(p.x,p.z,dt*velocity*.75);
      p.life+=dt;
      if(next.blocked||before.speed<.0001){p.life=12;}
      else {p.x=next.x;p.z=next.z;}
      const alpha=Math.min(1,before.speed/1.05);
      c1.clone().lerp(c2,alpha).toArray(colors,i*3);
      positions[i*3]=p.x;positions[i*3+1]=.12+.09*Math.sin(p.life*3+i);positions[i*3+2]=p.z;
    }
    part.geometry.attributes.position.needsUpdate=true;
    part.geometry.attributes.color.needsUpdate=true;
  }
  // Real solar angles come from the MIT/BSD-style SunCalc astronomy implementation,
  // calculated for the user's chosen date, coordinates and timezone.
  async function loadSun() {
    try{sunCalc=await import('https://cdn.jsdelivr.net/npm/suncalc@2.1.1/+esm');updateSolar();}
    catch(e){sunLabel.textContent='太阳位置库无法加载；日照计算已禁用。请检查 CDN 网络。';console.warn(e);}
  }
  let solarLight=null;
  function solarUpdateAfterPlan(){if(solarLight)updateSolar();}
  function updateSolar(){
    if(!plan||!sunCalc)return;
    const latitude=Number($('v8-lat').value),longitude=Number($('v8-lon').value);
    const utc=Number($('v8-tz').value),date=$('v8-date').value;
    if(Math.abs(latitude)>90||Math.abs(longitude)>180||!date||utc<-12||utc>14){sunLabel.textContent='经纬度、时区或日期不正确。';return;}
    const hour=Number(state.sunHour);
    const sign=utc>=0?'+':'-',offset=Math.abs(utc),hh=String(Math.floor(offset)).padStart(2,'0'),mm=String(Math.round((offset%1)*60)).padStart(2,'0');
    const iso=date+'T'+String(Math.floor(hour)).padStart(2,'0')+':'+(hour%1?'30':'00')+':00'+sign+hh+':'+mm;
    const pos=sunCalc.getPosition(new Date(iso),latitude,longitude);
    const sol=sunCalcToScene(pos,Number(state.north||0));
    const {x,y,z}=sol.direction;
    if(!solarLight){
      solarLight=new THREE.DirectionalLight('#fff5de',2.4);solarLight.castShadow=true;
      solarLight.shadow.mapSize.set(2048,2048);solarLight.shadow.camera.near=.2;solarLight.shadow.camera.far=90;
      scene.add(solarLight);scene.add(solarLight.target);
    }
    const extent=Math.max(plan.w,plan.d);
    solarLight.shadow.camera.left=-extent;solarLight.shadow.camera.right=extent;
    solarLight.shadow.camera.top=extent;solarLight.shadow.camera.bottom=-extent;solarLight.shadow.camera.updateProjectionMatrix();
    solarLight.target.position.set(0,0,0);
    solarLight.position.set(x*25,Math.max(.1,y*25),z*25);
    scene.children.forEach(o=>{if(o.isDirectionalLight&&o!==solarLight)o.intensity=0;});
    solarLight.intensity=sol.aboveHorizon?2.3:0;
    solarLight.color.set(sol.altitudeDeg<16?'#ffd6ac':'#fff5de');
    sunLabel.textContent='太阳高度 '+sol.altitudeDeg.toFixed(1)+'° · 真北方位 '+sol.bearingDeg.toFixed(1)+'°；窗洞位置与高度仍需校准。';
  }
  requestAnimationFrame(updateParticles);
  loadSun();
  const getPorts=()=>door&&windowPort?{door:{...door},window:{...windowPort}}:null;
  return {onPlan,place,isMarking:()=>!!markerMode,rebuild,getPorts};
}
