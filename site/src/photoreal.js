// Load heavy WebGPU imports after capability checks.
let Scene,Group,Color,PerspectiveCamera,BoxGeometry,PlaneGeometry,Mesh,MeshStandardMaterial,
CanvasTexture,SRGBColorSpace,RectAreaLight,ACESFilmicToneMapping,WebGPURenderer,
Vector3,OrbitControls,WebGPUPathTracer;

const viewer=document.querySelector('#viewer'),msg=document.querySelector('#overlay'),info=document.querySelector('#info');
let tracer=null,renderer=null,scene=null,camera=null,controls=null,mode='low',roomGroup=null;
const saved=JSON.parse(localStorage.getItem('qixu-blueprint-v6')||'null');
function fail(message) {msg.textContent=message;msg.classList.add('failure');info.textContent=message;info.classList.add('failure');}
function cropImage(src,crop){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.floor(crop.right-crop.left));canvas.height=Math.max(1,Math.floor(crop.bottom-crop.top));
      canvas.getContext('2d').drawImage(img,crop.left,crop.top,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
      resolve(canvas);
    };img.onerror=reject;img.src=src;
  });
}
async function rebuild(){
  if(!saved?.plan)return;
  if(roomGroup){scene.remove(roomGroup);roomGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()})}
  const p=saved.plan;roomGroup=new Group();roomGroup.name='renderable-floorplan';scene.add(roomGroup);
  const mat=new MeshStandardMaterial({color:0xfff7ea,roughness:.86,metalness:0});
  const crop=await cropImage(saved.image,p.crop);
  const texture=new CanvasTexture(crop);texture.colorSpace=SRGBColorSpace;
  const floor=new Mesh(new PlaneGeometry(p.w,p.d),new MeshStandardMaterial({map:texture,roughness:.84,metalness:0,side:2}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.01;roomGroup.add(floor);
  const coordinate=(x,y)=>({
    x:(x-p.crop.left)/(p.crop.right-p.crop.left)*p.w-p.w/2,
    z:(y-p.crop.top)/(p.crop.bottom-p.crop.top)*p.d-p.d/2
  });
  for(const [x1,y1,x2,y2] of p.walls){
    const a=coordinate(x1,y1),b=coordinate(x2,y2);
    const len=Math.hypot(b.x-a.x,b.z-a.z);
    if(len<.1)continue;
    const h=mode==='low'?1.20:2.55;
    const wall=new Mesh(new BoxGeometry(len,h,.11),mat.clone());
    wall.position.set((a.x+b.x)/2,h/2+.045,(a.z+b.z)/2);
    wall.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
    roomGroup.add(wall);
  }
  const palette=[0xaf9679,0x8b977d,0xb78d71,0x6e8891,0xa6a8a1];
  for(let i=0;i<(p.furniture||[]).length;i++){
    const f=p.furniture[i],d=f.dims||[.85,.85,.76],g=new BoxGeometry(d[0],d[2],d[1]);
    const object=new Mesh(g,new MeshStandardMaterial({color:palette[i%palette.length],roughness:.75,metalness:0}));
    object.position.set(f.x,d[2]/2+.07,f.z);object.rotation.y=f.angle||0;roomGroup.add(object);
  }
  const bound=new Mesh(new PlaneGeometry(Math.max(p.w,18)*2,Math.max(p.d,18)*2),
    new MeshStandardMaterial({color:'#d6d2ca',roughness:.9}));
  bound.rotation.x=-Math.PI/2;bound.position.y=-.10;roomGroup.add(bound);
  tracer.setScene(scene,camera);
  msg.textContent='WebGPU 光线追踪正在逐步积累 · 拖动可旋转 · 鼠标滚轮缩放';
}
async function init(){
  if(!saved?.plan?.walls?.length){fail('当前浏览器尚无已保存户型图。请返回编辑器上传户型图，然后再打开这个预览页。');return;}
  if(!navigator.gpu){fail('当前浏览器没有启用 WebGPU，请使用较新的 Chrome/Edge 和支持 WebGPU 的显卡驱动。主编辑器仍可正常使用。');return;}
  ({Scene,Group,Color,PerspectiveCamera,BoxGeometry,PlaneGeometry,Mesh,MeshStandardMaterial,CanvasTexture,SRGBColorSpace,RectAreaLight,ACESFilmicToneMapping,WebGPURenderer,Vector3}=await import('three/webgpu'));
  ({OrbitControls}=await import('three/addons/controls/OrbitControls.js'));
  ({WebGPUPathTracer}=await import('three-gpu-pathtracer/webgpu'));
  renderer=new WebGPURenderer({antialias:false});
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
  viewer.prepend(renderer.domElement);
  scene=new Scene();scene.background=new Color('#ddd9d1');
  renderer.toneMapping=ACESFilmicToneMapping;
  camera=new PerspectiveCamera(43,1,.1,200);
  const p=saved.plan;
  camera.position.set(p.w*.75,Math.max(9,p.d*.85),p.d*.9);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.target.set(0,0,0);controls.enableDamping=true;controls.maxDistance=50;controls.update();
  const key=new RectAreaLight('#fff2d9',9,5,5);
  key.position.set(-p.w*.48,6,-p.d*.3);key.lookAt(new Vector3(0,0,0));scene.add(key);
  const fill=new RectAreaLight('#dce8ff',3.5,5,5);
  fill.position.set(p.w*.46,4,p.d*.3);fill.lookAt(new Vector3(0,0,0));scene.add(fill);
  tracer=new WebGPUPathTracer(renderer);
  tracer.maxBounces=5;tracer.maxSamples=32;tracer.frameBudget=45000;
  const resize=()=>{
    const w=viewer.clientWidth,h=viewer.clientHeight;if(!w||!h)return;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
    tracer.updateCamera();
  };
  await rebuild();
  resize();new ResizeObserver(resize).observe(viewer);
  controls.addEventListener('change',()=>tracer.updateCamera());
  document.querySelector('#samples').addEventListener('click',e=>{
    const b=e.target.closest('[data-samples]');if(!b)return;
    tracer.maxSamples=Number(b.dataset.samples);tracer.reset();
    document.querySelectorAll('[data-samples]').forEach(x=>x.classList.toggle('active',x===b));
  });
  document.querySelector('#wall-mode').addEventListener('click',async e=>{
    const b=e.target.closest('[data-wall]');if(!b)return;
    mode=b.dataset.wall;document.querySelectorAll('[data-wall]').forEach(x=>x.classList.toggle('active',x===b));
    msg.textContent='正在重建墙体与光线路径……';
    try{await rebuild();}catch(err){fail('重新构建失败：'+err.message);}
  });
  renderer.setAnimationLoop(()=>{controls.update();tracer.renderSample()});
  info.textContent='高质量模式运行中。每次旋转视角或切换墙体后，路径追踪会重新开始采样；复杂方案可能需要较长的收敛时间。';
}
init().catch(e=>{console.error(e);fail('WebGPU 路径追踪初始化失败：'+(e?.message||e)+'. 可以继续使用普通编辑器。')});
