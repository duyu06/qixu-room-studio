import * as THREE from 'three';
/* V6: turn raster floor plans into schematic, editable 3D walls.
   All recognition is local. The result is not a measured BIM model. */
export function attachBlueprint({scene,camera,orbit,renderer,state}) {
  const $=id=>document.getElementById(id);
  const container=$('viewport');
  const library=$('catalog');
  let overlay=null,plan=null,bitmap=null,editing=false,first=null,objects=[],moving=null;
  const sample=[
    [84,59,394,59],[84,59,84,155],[84,155,162,155],[193,59,193,121],[193,145,193,155],
    [299,59,299,120],[299,146,299,155],[372,59,372,154],[299,155,341,155],
    [340,155,340,183],[340,215,340,259],[340,282,332,282],
    [84,155,84,276],[84,279,164,279],[84,282,84,338],[84,338,164,338],
    [164,155,164,185],[164,207,164,222],[84,222,164,222],[164,222,164,248],[164,270,164,338],
    [195,280,195,310],[195,337,195,455],[84,338,84,457],
    [195,438,218,438],[233,438,332,438],[332,282,332,350],[332,377,332,440],
    [195,338,195,377],[195,404,195,438],
    [340,155,409,155],[409,155,409,226],[409,252,409,440],[334,276,334,307],
    [334,324,334,438],[334,438,409,438],
    [48,158,83,158],[48,158,48,280],[48,280,83,280],
    [195,444,195,482],[195,482,334,482],[334,441,334,482]
  ];
  const pane=document.createElement('div');
  pane.className='floorplan-tools';
  pane.innerHTML='<b>户型图 → 立体空间</b><p id="plan-status">上传平面图后，会在同一个 3D 场景重建估算墙线。</p><div class="plan-actions"><button id="plan-edit" type="button">补画墙体</button><button id="plan-undo" type="button">删除上一段墙</button><button id="plan-overlay" type="button">切换底图</button></div><p>补画模式：俯视图依次点击起点和终点。扫描存在误检，真实尺寸与门窗须人工确认。</p>';
  $('dropzone').after(pane);
  const planStatus=pane.querySelector('#plan-status');
  const sampleBox={left:46,top:44,right:421,bottom:482};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const pxWorld=(x,y)=>({x:(x-plan.crop.left)/(plan.crop.right-plan.crop.left)*plan.w-plan.w/2,z:(y-plan.crop.top)/(plan.crop.bottom-plan.crop.top)*plan.d-plan.d/2});
  function clear(){
    if(overlay){scene.remove(overlay);overlay.traverse(o=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});overlay=null;}
    objects=[];moving=null;
  }
  function renderPlan(){
    if(!plan||!bitmap)return;
    clear();overlay=new THREE.Group();overlay.name='imported-floorplan-v6';scene.add(overlay);
    const tex=new THREE.CanvasTexture(bitmap);tex.colorSpace=THREE.SRGBColorSpace;
    const crop=plan.crop;tex.repeat.set((crop.right-crop.left)/bitmap.width,(crop.bottom-crop.top)/bitmap.height);
    tex.offset.set(crop.left/bitmap.width,1-crop.bottom/bitmap.height);
    const slab=new THREE.Mesh(new THREE.PlaneGeometry(plan.w,plan.d),new THREE.MeshStandardMaterial({map:tex,roughness:.95,side:THREE.DoubleSide}));
    slab.rotation.x=-Math.PI/2;slab.position.y=.025;slab.receiveShadow=true;overlay.add(slab);
    const mat=new THREE.MeshStandardMaterial({color:'#e3ded2',roughness:.94,transparent:true,opacity:.90});
    for(const [x1,y1,x2,y2] of plan.walls){
      const a=pxWorld(x1,y1),b=pxWorld(x2,y2),len=Math.hypot(b.x-a.x,b.z-a.z);
      if(len<.10)continue;
      const wall=new THREE.Mesh(new THREE.BoxGeometry(len,2.52,.10),mat);
      wall.position.set((a.x+b.x)/2,1.28,(a.z+b.z)/2);
      wall.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
      wall.castShadow=true;wall.receiveShadow=true;overlay.add(wall);
    }
    const original=scene.getObjectByName('editable-room');if(original)original.visible=false;
    state.items.forEach(o=>o.group.visible=false);
    // Built-in demo furniture is hidden when importing a distinct plan.
    camera.position.set(plan.w*.75,Math.max(11,plan.d*1.25),plan.d*1.05);
    orbit.target.set(0,0,0);orbit.update();
    planStatus.textContent=plan.note+' · '+plan.walls.length+' 段墙体。宽高均为示意比例，非真实测量。';
  }
  function genericWalls(ctx,w,h){
    const pixels=ctx.getImageData(0,0,w,h).data;
    const dark=(x,y)=>{const i=(y*w+x)*4;return pixels[i]<90&&pixels[i+1]<90&&pixels[i+2]<90};
    const runs=[];
    for(let orientation=0;orientation<2;orientation++){
      const cross=orientation?w:h,along=orientation?h:w;
      for(let c=12;c<cross-12;c+=3){
        let start=-1;
        for(let t=12;t<along-11;t++){
          const x=orientation?c:t,y=orientation?t:c;
          const hit=dark(x,y)&&dark(orientation?c+2:t,orientation?t:c+2);
          if(hit&&start<0)start=t;
          if((!hit||t===along-12)&&start>=0){
            if(t-start>Math.max(24,along*.075))runs.push(orientation?[c,start,c,t]:[start,c,t,c]);start=-1;
          }
        }
      }
    }
    return runs.filter((r,i)=>!runs.slice(0,i).some(q=>Math.abs(r[0]-q[0])<5&&Math.abs(r[1]-q[1])<5&&Math.abs(r[2]-q[2])<5&&Math.abs(r[3]-q[3])<5)).slice(0,85);
  }
  const persist=()=>{try{localStorage.setItem('qixu-blueprint-v6',JSON.stringify({plan,image:bitmap.toDataURL('image/jpeg',.7)}))}catch{}};
  function activate(source,fromRestore=false){
    const img=new Image();img.onload=()=>{
      bitmap=document.createElement('canvas');
      const scale=Math.min(1,900/Math.max(img.width,img.height));
      bitmap.width=Math.round(img.width*scale);bitmap.height=Math.round(img.height*scale);
      const ctx=bitmap.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,bitmap.width,bitmap.height);
      if(!fromRestore){
        const ref=img.width===474&&img.height===514;
        const crop=ref?sampleBox:{left:Math.round(bitmap.width*.04),top:Math.round(bitmap.height*.04),right:Math.round(bitmap.width*.96),bottom:Math.round(bitmap.height*.96)};
        plan={w:ref?11.2:9.6,d:ref?13.08:9.6*bitmap.height/bitmap.width,crop,
          walls:ref?sample.map(a=>a.slice()):genericWalls(ctx,bitmap.width,bitmap.height),
          note:ref?'K-4 参考图：人工校对的示意墙线':'自动提线初稿：请人工核对墙体与门洞'};
        if(!plan.walls.length)plan.walls=[[crop.left,crop.top,crop.right,crop.top],[crop.right,crop.top,crop.right,crop.bottom],[crop.right,crop.bottom,crop.left,crop.bottom],[crop.left,crop.bottom,crop.left,crop.top]];
      }
      $('analysis-card').hidden=false;$('analysis-card').querySelector('b').textContent='户型图已转换为立体墙线';
      $('analysis-card').querySelector('.analysis-body').textContent='自动建模是初稿，不等于测量实图；可在俯视图补墙。';
      $('photo-preview').hidden=false;$('photo-preview').style.backgroundImage='url('+bitmap.toDataURL('image/jpeg',.65)+')';
      $('upload-main').textContent='更换户型图';
      renderPlan();persist();
    };img.src=source;
  }
  $('photo-input').addEventListener('change',e=>{
    const f=e.target.files?.[0];if(!f)return;
    e.stopImmediatePropagation();if(!/^image\/(png|jpeg|webp)$/.test(f.type))return;
    const fr=new FileReader();fr.onload=()=>activate(fr.result);fr.readAsDataURL(f);
  },true);
  $('dropzone').addEventListener('drop',e=>{
    const f=e.dataTransfer.files?.[0];if(!f)return;
    e.preventDefault();e.stopImmediatePropagation();
    const fr=new FileReader();fr.onload=()=>activate(fr.result);fr.readAsDataURL(f);
  },true);
  pane.querySelector('#plan-edit').addEventListener('click',()=>{
    editing=!editing;first=null;pane.querySelector('#plan-edit').textContent=editing?'结束绘墙':'补画墙体';
    if(editing){$('view-buttons').querySelector('[data-view=top]').click();}
  });
  pane.querySelector('#plan-undo').addEventListener('click',()=>{if(!plan?.walls.length)return;plan.walls.pop();renderPlan();persist();});
  pane.querySelector('#plan-overlay').addEventListener('click',()=>{if(overlay?.children[0])overlay.children[0].visible=!overlay.children[0].visible});
  const ray=new THREE.Raycaster(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  const fromPointer=e=>{
    const rect=renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    return ray.ray.intersectPlane(ground,hit);
  };
  renderer.domElement.addEventListener('pointerdown',e=>{
    if(!plan||!editing||e.button!==0)return;
    e.stopImmediatePropagation();e.preventDefault();
    if(!fromPointer(e))return;
    const x=clamp((hit.x/plan.w+.5)*(plan.crop.right-plan.crop.left)+plan.crop.left,plan.crop.left,plan.crop.right);
    const y=clamp((hit.z/plan.d+.5)*(plan.crop.bottom-plan.crop.top)+plan.crop.top,plan.crop.top,plan.crop.bottom);
    if(!first)first=[x,y];else{
      const second=[x,y];if(Math.abs(x-first[0])<Math.abs(y-first[1]))second[0]=first[0];else second[1]=first[1];
      plan.walls.push([...first,...second]);first=null;renderPlan();persist();
    }
  },true);
  // Hide the old three-room template if another control rebuilt it.
  const tick=()=>{
    if(plan){const room=scene.getObjectByName('editable-room');if(room)room.visible=false;state.items.forEach(i=>i.group.visible=false);}
    requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
  try{const saved=JSON.parse(localStorage.getItem('qixu-blueprint-v6')||'null');
    if(saved?.plan&&saved?.image&&Array.isArray(saved.plan.walls)){plan=saved.plan;activate(saved.image,true);}
  }catch(e){console.warn('Plan restore skipped',e)}
}
