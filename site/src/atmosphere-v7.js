import * as THREE from 'three';

// V7 visual design layer for imported floor plans. Never claims to model
// physical qi, magnetic fields, measured sunlight, or real wind.
export function createAtmosphere({ scene, renderer, state, host, onWallModeChange }) {
  const $ = (id) => document.getElementById(id);
  let plan = null, world = null, field = null, spots = [], particles = null;
  let particlePositions = null, particleColors = null, seeds = [];
  let elapsed = 0, frameId = 0, lastNow = 0, lastLightKey = '', lightAutoplay = false, lightAccum = 0;
  let wallMode = 'cutaway', flowMode = 'qi';
  const L = new THREE.DirectionalLight(0xffefcd, 2.3);
  L.castShadow = true;
  L.shadow.mapSize.set(2048, 2048);
  L.shadow.camera.near = 0.3;
  L.shadow.camera.far = 85;
  L.shadow.bias = -0.00015;
  L.shadow.normalBias = 0.025;
  L.shadow.radius = 3;
  const ambient = new THREE.AmbientLight(0xffead3, 0.48);
  const evening = new THREE.PointLight(0xffba75, 0, 19, 1.4);
  const windowGlow = new THREE.PointLight(0xffe0a2, 0.35, 16, 1.5);
  scene.add(L, L.target, ambient, evening, windowGlow);
  L.visible = ambient.visible = evening.visible = windowGlow.visible = false;

  const panel = document.createElement('section');
  panel.className = 'v7-studio';
  panel.innerHTML =
    '<div class="v7-heading"><span class="v7-pill">V7 · 实时场景</span><b>光影 · 八方流动</b></div>' +
    '<div class="v7-line"><label for="v7-daytime">太阳时刻</label><b id="v7-time-label">12:00</b></div>' +
    '<input id="v7-daytime" type="range" min="6" max="20" step=".5" value="12" aria-label="日照时间">' +
    '<div class="v7-choices" id="v7-quick"><button type="button" data-hour="8">晨光</button><button type="button" data-hour="12">正午</button><button type="button" data-hour="17">夕照</button><button type="button" data-hour="20">夜景</button><button type="button" id="v7-autoplay">▶ 演示</button></div>' +
    '<div class="v7-line v7-separate"><label>墙体视觉</label><span class="v7-sub">不改变实际墙线</span></div>' +
    '<div class="v7-choices" id="v7-wall-choices"><button type="button" class="active" data-wall="cutaway">暖白剖切</button><button type="button" data-wall="solid">真实立面</button><button type="button" data-wall="ghost">轻透墙</button></div>' +
    '<div class="v7-line v7-separate"><label>动态八卦</label><span class="v7-sub" id="v7-flow-label">持续流动</span></div>' +
    '<div class="v7-choices" id="v7-flow-choices"><button type="button" class="active" data-mode="qi">环绕气韵</button><button type="button" data-mode="wuxing">五行流光</button><button type="button" data-mode="directions">八方汇聚</button></div>' +
    '<div class="v7-line v7-last"><span id="v7-light-status">暖金日光与柔和阴影</span><label class="v7-switch"><input id="v7-flow-enabled" type="checkbox" checked> 动态</label></div>' +
    '<p class="v7-legal">光斑与流线为可调的视觉模拟；户型图缺少实际窗位、方位和经纬度，不能据此判断真实采光或物理磁场。</p>';
  host.append(panel);
  const hourInput = panel.querySelector('#v7-daytime');
  const flowToggle = panel.querySelector('#v7-flow-enabled');
  const timeLabel = panel.querySelector('#v7-time-label');
  hourInput.value = state.sunHour;
  hourInput.addEventListener('input', () => {
    const upstream = $('sun-hour');
    if (upstream) {
      upstream.value = hourInput.value;
      upstream.dispatchEvent(new Event('input', { bubbles: true }));
    } else state.sunHour = Number(hourInput.value);
    updateLighting(true);
  });
  panel.querySelector('#v7-quick').addEventListener('click', e => {
    const b = e.target.closest('[data-hour]'); if (!b) return;
    hourInput.value = b.dataset.hour;
    hourInput.dispatchEvent(new Event('input'));
  });
  panel.querySelector('#v7-autoplay').addEventListener('click', () => {
    lightAutoplay = !lightAutoplay;
    panel.querySelector('#v7-autoplay').textContent = lightAutoplay ? 'Ⅱ 暂停' : '▶ 演示';
    panel.querySelector('#v7-autoplay').classList.toggle('active', lightAutoplay);
    lightAccum = 0;
  });
  panel.querySelector('#v7-wall-choices').addEventListener('click', e => {
    const b = e.target.closest('[data-wall]'); if (!b) return;
    wallMode = b.dataset.wall;
    panel.querySelectorAll('[data-wall]').forEach(n => n.classList.toggle('active', n === b));
    onWallModeChange();
  });
  panel.querySelector('#v7-flow-choices').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    flowMode = b.dataset.mode;
    panel.querySelectorAll('[data-mode]').forEach(n => n.classList.toggle('active', n === b));
    panel.querySelector('#v7-flow-label').textContent = b.textContent;
    recolor();
  });
  flowToggle.addEventListener('change', () => {
    if (field) field.visible = flowToggle.checked;
  });

  const sunlightTexture = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grad = g.createRadialGradient(64,64,4,64,64,63);
    grad.addColorStop(0,'rgba(255,241,173,.95)');
    grad.addColorStop(.35,'rgba(255,210,109,.64)');
    grad.addColorStop(.77,'rgba(255,177,85,.15)');
    grad.addColorStop(1,'rgba(255,171,81,0)');
    g.fillStyle = grad; g.fillRect(0,0,128,128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  function disposeGroup(g) {
    if (!g) return;
    scene.remove(g);
    g.traverse(o => {
      o.geometry?.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
  }
  function makeOverlay() {
    disposeGroup(field);
    if (world && world.parent) { world.parent.remove(world); world.geometry.dispose(); world.material.dispose(); }
    field = new THREE.Group(); field.name = 'qixu-v7-dynamic-bagua'; scene.add(field);
    spots = [];
    if (!plan) return;
    world = new THREE.Mesh(
      new THREE.PlaneGeometry(plan.w, plan.d),
      new THREE.ShadowMaterial({color:0x382b21,opacity:.27,depthWrite:false})
    );
    world.rotation.x = -Math.PI/2; world.position.y = .037;
    world.receiveShadow = true; scene.add(world);
    const radius = Math.min(plan.w, plan.d)*.305;
    const palette = [0x4dcfbc,0xf5d288,0xf6aa77,0xb4a4e0,0x70c9c5,0xeac27c,0x9bb6ea,0xe3a4ae];
    for (let i=0;i<8;i++) {
      const start = -Math.PI/2 + i*Math.PI/4;
      const curve = new THREE.EllipseCurve(0,0,radius*.91,radius*.91,start,start+Math.PI/4,false,0);
      const arr=curve.getPoints(18).map(p=>new THREE.Vector3(p.x,.106,p.y));
      const ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr),
        new THREE.LineBasicMaterial({color:palette[i],transparent:true,opacity:.55,depthWrite:false}));
      ring.name='八卦方位轨迹'; field.add(ring);
      const rayEnd = radius*.98;
      const a=start+Math.PI/8;
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,.104,0),
        new THREE.Vector3(Math.cos(a)*rayEnd,.104,Math.sin(a)*rayEnd)]),
        new THREE.LineBasicMaterial({color:palette[i],transparent:true,opacity:.18,depthWrite:false}));
      field.add(line);
    }
    const n=320;
    particlePositions=new Float32Array(n*3);
    particleColors=new Float32Array(n*3);
    seeds=Array.from({length:n},(_,i)=>({
      a:(i*.618033988749895%1)*Math.PI*2,
      lane: .23+(.754877666*i%1)*.73,
      delta:(i*.41421356237%1)*2*Math.PI,
      index:i
    }));
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(particlePositions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
    particles=new THREE.Points(geometry,new THREE.PointsMaterial({
      size:.14,vertexColors:true,transparent:true,opacity:.94,
      sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending
    }));
    particles.name='八卦流动粒子'; particles.frustumCulled=false;
    field.add(particles);
    recolor();
  }
  function recolor() {
    if (!particles) return;
    const c1=new THREE.Color('#38c4b0'), c2=new THREE.Color('#f7b861');
    const wuxing=['#58c795','#f39b64','#e2bc71','#cfd9dd','#65bfe1'];
    const bagua=['#5accca','#f5ca7e','#de9d82','#b7a7e8','#6cb8db','#f2ba79','#8ec5a9','#e6a4b7'];
    for(let i=0;i<seeds.length;i++){
      const p=seeds[i];
      const color=flowMode==='wuxing'?new THREE.Color(wuxing[Math.floor(p.a/(Math.PI*2)*5)%5]):
        flowMode==='directions'?new THREE.Color(bagua[Math.floor(p.a/(Math.PI/4))%8]):
        c1.clone().lerp(c2,p.lane*.70);
      color.toArray(particleColors,i*3);
    }
    particles.geometry.attributes.color.needsUpdate=true;
  }
  function onPlan(next,overlay) {
    plan=next;
    if(!plan)return;
    scene.background = new THREE.Color('#fcfaf3'); scene.fog=null;
    renderer.toneMappingExposure=1.25;
    const old = scene.getObjectByName('cultural-flow-not-measured');
    if(old)old.visible=false;
    const walkway=scene.getObjectByName('illustrative-walkway-not-egress');
    if(walkway)walkway.visible=false;
    const oldSun=scene.children.find(o=>o.isDirectionalLight&&o!==L);
    if(oldSun)oldSun.castShadow=false;
    L.visible = ambient.visible = evening.visible = windowGlow.visible = true;
    evening.position.set(plan.w*.1,2.6,plan.d*.10);
    windowGlow.position.set(-plan.w*.32,2.6,-plan.d*.26);
    L.target.position.set(0,0,0);
    L.shadow.camera.left=-Math.max(plan.w,plan.d)*.85;
    L.shadow.camera.right=Math.max(plan.w,plan.d)*.85;
    L.shadow.camera.top=Math.max(plan.w,plan.d)*.85;
    L.shadow.camera.bottom=-Math.max(plan.w,plan.d)*.85;
    L.shadow.camera.updateProjectionMatrix();
    makeOverlay();
    for (let i=0;i<4;i++){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.0,4.8),
        new THREE.MeshBasicMaterial({map:sunlightTexture,color:i%2?'#ffb968':'#fff4bf',
          transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,
          polygonOffset:true,polygonOffsetFactor:-2,toneMapped:false}));
      mesh.rotation.x=-Math.PI/2; mesh.position.y=.05+i*.001;
      mesh.renderOrder=5;
      field.add(mesh);spots.push(mesh);
    }
    lastLightKey=''; updateLighting(true);
  }
  function dayTimeBackground(hour){return hour>=18||hour<=6?'#e3ded5':'#fcfaf3';}
  function updateLighting(force=false){
    if (!plan) return;
    const hour=Number(state.sunHour),mode=state.light;
    const key=[hour,mode,state.daylight,state.lampPower,state.north,state.lightKelvin,state.sunOverlay].join('|');
    if (!force&&key===lastLightKey)return;
    lastLightKey=key; hourInput.value=hour;
    scene.background.set(dayTimeBackground(hour)); scene.fog=null;
    renderer.toneMappingExposure=1.25;
    const hh=Math.floor(hour),mm=hour%1?'30':'00';
    timeLabel.textContent=String(hh).padStart(2,'0')+':'+mm;
    panel.querySelectorAll('[data-hour]').forEach(b=>b.classList.toggle('active',Number(b.dataset.hour)===hour));
    const day=mode!=='warm'&&hour>6&&hour<18;
    const phase=Math.max(0,Math.min(1,(hour-6)/12));
    const altitude=day?Math.sin(Math.PI*phase)*Math.PI*.34:.05;
    const az=(90+phase*180+Number(state.north||0))*Math.PI/180;
    const vertical=18*Math.sin(altitude);
    L.position.set(Math.sin(az)*15,Math.max(1,vertical),-Math.cos(az)*15);
    L.intensity=day?(2.35*(state.daylight||85)/100):0;
    L.color.set(hour<10||hour>16?'#ffd5a1':'#fff6df');
    ambient.intensity=day?.65:.36;
    evening.intensity=day?.25:Math.max(1.8,Number(state.lampPower||65)/100*5);
    windowGlow.intensity=day?.8:.16;
    spots.forEach((mesh,i)=>{
      mesh.visible=day&&state.sunOverlay!==false;
      mesh.material.opacity=day?(.34+.16*Math.sin(Math.PI*phase)):0;
      const sweep=(phase-.5)*plan.w*.69;
      mesh.position.x=Math.max(-plan.w*.36,Math.min(plan.w*.36,sweep+
        (i-1.5)*Math.min(1.65,plan.w*.115)));
      mesh.position.z=-plan.d*.23+Math.sin(phase*Math.PI)*(plan.d*.27)+
        (i%2? .85:-.85);
      mesh.scale.set(Math.min(1.8,plan.w/9),Math.min(1.8,plan.d/10),1);
    });
    panel.querySelector('#v7-light-status').textContent=day?
      (hour<11?'晨间斜阳 · 光斑移动':hour>15?'金色夕照 · 长阴影':'明亮正午 · 柔和投影'):
      '夜间暖灯 · 无直射日光';
  }
  function animate(now){
    frameId=requestAnimationFrame(animate);
    if(!plan || document.hidden)return;
    const dt=Math.min(.05,Math.max(0,(now-lastNow)/1000));lastNow=now;
    if(lightAutoplay){
      lightAccum += dt;
      if(lightAccum >= .65){
        lightAccum = 0;
        hourInput.value = Number(state.sunHour) >= 20 ? 6 : Number(state.sunHour) + .5;
        hourInput.dispatchEvent(new Event('input'));
      }
    }
    updateLighting();
    if (!particles || !field)return;
    field.visible=flowToggle.checked;
    if(!flowToggle.checked)return;
    elapsed+=dt*.20*Math.max(0,Number(state.flowSpeed??100)/100);
    const r=Math.min(plan.w,plan.d)*.34;
    const n=Math.max(0,Math.min(seeds.length,Number(state.flowDensity??180)));
    particles.geometry.setDrawRange(0,n);
    for(let i=0;i<n;i++){
      const p=seeds[i], t=p.a+elapsed*(.75+p.lane*.55);
      const radial=r*p.lane*(.87+.13*Math.sin(3*t+p.delta));
      let x=Math.cos(t)*radial;
      let z=Math.sin(t)*radial;
      if(flowMode==='directions'){
        const axis=p.a+Math.sin(elapsed*.7+p.delta)*.07;
        const fraction=(p.lane + elapsed*.06)%1;
        x=Math.cos(axis)*r*fraction;
        z=Math.sin(axis)*r*fraction;
      }
      for(const obj of plan.furniture||[]){
        const dx=x-obj.x,dz=z-obj.z;
        const dist=Math.hypot(dx,dz);
        const safe=Math.max(obj.dims?.[0]||.6,obj.dims?.[1]||.6)*.60+.24;
        if(dist<safe&&dist>.005){x+=dx/dist*(safe-dist);z+=dz/dist*(safe-dist);}
      }
      particlePositions[i*3]=x;
      particlePositions[i*3+1]=.16+.15*Math.sin(t*2+p.delta)+.07*p.lane;
      particlePositions[i*3+2]=z;
    }
    particles.geometry.attributes.position.needsUpdate=true;
    if(field.children[0])field.rotation.y=Math.sin(elapsed*.38)*.065;
  }
  requestAnimationFrame(animate);
  return {get wallMode(){return wallMode;},onPlan};
}
