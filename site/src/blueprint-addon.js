import * as THREE from 'three';
import {validateFloorplanFile,DECODE_LIMIT_PIXELS,recognizeKnownK4,makePreviewLuma} from './image-integrity.js';
import {makeBlueprintPacket,validateBlueprintPacket,MAX_PROJECT_FILE_BYTES} from './blueprint-project.js';
import {calibrateFloorplan} from './scale-calibration.js';
import { createVentilationStudio } from './ventilation-v8.js';
import { createAtmosphere } from './atmosphere-v7.js';
/* V6: turn raster floor plans into schematic, editable 3D walls.
   All recognition is local. The result is not a measured BIM model. */
export function attachBlueprint({scene,camera,orbit,renderer,state}) {
  const $=id=>document.getElementById(id);
  const container=$('viewport');
  const library=$('catalog');
  let overlay=null,plan=null,bitmap=null,editing=false,first=null,objects=[],moving=null,loadSequence=0;
  let measuring=false, measurePoints=[];
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
  const atmosphere=createAtmosphere({scene,renderer,state,host:pane,onWallModeChange:()=>renderPlan(false)});
  const physics=createVentilationStudio({scene,renderer,state,host:pane,camera,orbit});
  const planStatus=pane.querySelector('#plan-status');
  const scalePanel=document.createElement('section');
  scalePanel.className='qixu-scale-panel';
  scalePanel.innerHTML='<b>实际尺寸标定</b><p class="qixu-scale-note">俯视模式依次点击一段已知实际长度的起点、终点。示例墙体尺寸未经测量，请勿用于施工。</p>'+
    '<div class="qixu-scale-row"><label for="qixu-known-length">已知长度（米）</label><input id="qixu-known-length" type="number" min="0.1" max="40" step="0.1" value="3" /></div>'+
    '<div class="qixu-scale-row"><button type="button" id="qixu-measure-start">开始两点标定</button><button type="button" id="qixu-measure-cancel" disabled>取消</button></div>'+
    '<p id="qixu-scale-result" role="status">尚未用实际尺寸校准</p>';
  pane.insertBefore(scalePanel, pane.children[2]);
  const scaleResult=scalePanel.querySelector('#qixu-scale-result');
  const knownLength=scalePanel.querySelector('#qixu-known-length');
  const measureStart=scalePanel.querySelector('#qixu-measure-start');
  const measureCancel=scalePanel.querySelector('#qixu-measure-cancel');
  const displayCalibration=()=>{
    if(!plan){scaleResult.textContent='请先导入户型图。';return;}
    scaleResult.textContent=(plan.calibration?'已使用已知尺寸校准':'估算尺寸 · 尚未校准')+
      ' · 宽 '+plan.w.toFixed(2)+' 米 × 深 '+plan.d.toFixed(2)+' 米';
  };
  function stopMeasure(){
    measuring=false;measurePoints.length=0;
    measureStart.disabled=false;measureCancel.disabled=true;
  }
  measureStart.addEventListener('click',()=>{
    if(!plan){scaleResult.textContent='请先上传户型图。';return;}
    if(!Number.isFinite(knownLength.valueAsNumber)||knownLength.valueAsNumber<.1||knownLength.valueAsNumber>40){
      scaleResult.textContent='请输入 0.1–40 米的已知长度。';return;
    }
    if(editing){editing=false;first=null;pane.querySelector('#plan-edit').textContent='补画墙体';}
    measuring=true;measurePoints=[];measureStart.disabled=true;measureCancel.disabled=false;
    const top=$('view-buttons')?.querySelector('[data-view="top"]');top?.click();
    scaleResult.textContent='点击已知尺寸的第一个端点。';
  });
  measureCancel.addEventListener('click',()=>{stopMeasure();displayCalibration();});
  const sampleBox={left:46,top:44,right:421,bottom:482};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const pxWorld=(x,y)=>({x:(x-plan.crop.left)/(plan.crop.right-plan.crop.left)*plan.w-plan.w/2,z:(y-plan.crop.top)/(plan.crop.bottom-plan.crop.top)*plan.d-plan.d/2});
  function clear(){
    if(overlay){scene.remove(overlay);overlay.traverse(o=>{o.geometry?.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose();m.dispose();})}});overlay=null;}
    objects=[];moving=null;
  }
  function renderPlan(recenter=true){
    if(!plan||!bitmap)return;
    clear();overlay=new THREE.Group();overlay.name='imported-floorplan-v6';scene.add(overlay);
    const tex=new THREE.CanvasTexture(bitmap);tex.colorSpace=THREE.SRGBColorSpace;
    const crop=plan.crop;tex.repeat.set((crop.right-crop.left)/bitmap.width,(crop.bottom-crop.top)/bitmap.height);
    tex.offset.set(crop.left/bitmap.width,1-crop.bottom/bitmap.height);
    const slab=new THREE.Mesh(new THREE.PlaneGeometry(plan.w,plan.d),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false}));
    slab.rotation.x=-Math.PI/2;slab.position.y=.025;slab.receiveShadow=false;overlay.add(slab);
    const wallMode=atmosphere.wallMode;
    const height=wallMode==='cutaway'?1.22:2.52;
    const mat=new THREE.MeshStandardMaterial({color:'#fffaee',roughness:.83,transparent:wallMode==='ghost',opacity:wallMode==='ghost'?.34:1,depthWrite:wallMode!=='ghost',side:THREE.DoubleSide});
    const capMat=new THREE.MeshStandardMaterial({color:'#d9b993',roughness:.85});
    for(const [x1,y1,x2,y2] of plan.walls){
      const a=pxWorld(x1,y1),b=pxWorld(x2,y2),len=Math.hypot(b.x-a.x,b.z-a.z);
      if(len<.10)continue;
      const wall=new THREE.Mesh(new THREE.BoxGeometry(len,height,.105),mat);
      wall.position.set((a.x+b.x)/2,height/2+.026,(a.z+b.z)/2);
      wall.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
      wall.castShadow=wallMode!=='ghost';wall.receiveShadow=true;overlay.add(wall);
      if(wallMode!=='ghost'){
        const cap=new THREE.Mesh(new THREE.BoxGeometry(len,.027,.133),capMat);
        cap.rotation.y=wall.rotation.y;cap.position.set(wall.position.x,height+.037,wall.position.z);
        cap.castShadow=false;overlay.add(cap);
      }
    }

    for(const [idx,item] of (plan.furniture||[]).entries()){
      const dims=item.dims||[1.5,.7,.8];
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(dims[0],dims[2],dims[1]),new THREE.MeshStandardMaterial({color:item.color||'#b5a081',roughness:.85}));
      mesh.position.set(item.x,dims[2]/2+.08,item.z);mesh.rotation.y=item.angle||0;
      mesh.castShadow=true;mesh.userData.floorObjectIndex=idx;mesh.name='movable-'+item.label;
      overlay.add(mesh);objects.push(mesh);
    }
    const original=scene.getObjectByName('editable-room');if(original)original.visible=false;
    state.items.forEach(o=>o.group.visible=false);
    // Built-in demo furniture is hidden when importing a distinct plan.
    if(recenter){camera.position.set(plan.w*.75,Math.max(11,plan.d*1.25),plan.d*1.05);
    orbit.target.set(0,0,0);orbit.update();}
    planStatus.textContent=plan.note+' · '+plan.walls.length+' 段墙体。'+
      (plan.calibration?'已按用户标尺校准整体比例（墙线位置仍需核对）。':'尺寸为示意估算，非真实测量。');
    displayCalibration();
    atmosphere.onPlan(plan,overlay);
    physics.onPlan(plan);
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
  const persist=()=>{
    if(!bitmap||!plan)return false;
    try{
      localStorage.setItem('qixu-blueprint-v6',JSON.stringify({plan,image:bitmap.toDataURL('image/jpeg',.72)}));
      return true;
    }catch(err){
      planStatus.textContent='浏览器存储空间不足，方案尚未自动保存。请缩小图片或清理旧方案后重试。';
      console.warn('Floorplan autosave failed',err);
      return false;
    }
  };

  function activate(source,fromRestore=false,restoredPlan=null){
    const sequence=++loadSequence;stopMeasure();
    const img=new Image();
    img.onload=()=>{
      if(sequence!==loadSequence)return;
      if(img.width<128||img.height<128||img.width*img.height>DECODE_LIMIT_PIXELS){
        planStatus.textContent='图片尺寸无效；之前的方案未受影响。';return;
      }
      try{
        const nextBitmap=document.createElement('canvas');
        const scale=Math.min(1,900/Math.max(img.width,img.height));
        nextBitmap.width=Math.max(1,Math.round(img.width*scale));
        nextBitmap.height=Math.max(1,Math.round(img.height*scale));
        const ctx=nextBitmap.getContext('2d',{willReadFrequently:true});
        if(!ctx)throw Error('无法创建图片画布');
        ctx.drawImage(img,0,0,nextBitmap.width,nextBitmap.height);
        let nextPlan=restoredPlan;
        if(!fromRestore){
          const known=recognizeKnownK4(img.width,img.height,makePreviewLuma(nextBitmap));
          const crop=known?sampleBox:{left:Math.round(nextBitmap.width*.04),top:Math.round(nextBitmap.height*.04),
            right:Math.round(nextBitmap.width*.96),bottom:Math.round(nextBitmap.height*.96)};
          nextPlan={w:known?11.2:9.6,d:known?13.08:9.6*nextBitmap.height/nextBitmap.width,
            crop,walls:known?sample.map(a=>a.slice()):genericWalls(ctx,nextBitmap.width,nextBitmap.height),
            furniture:[],note:known?'K-4 示意墙线 · 待核对':'自动提线初稿 · 待人工核对'};
          if(!nextPlan.walls.length)nextPlan.walls=[
            [crop.left,crop.top,crop.right,crop.top],[crop.right,crop.top,crop.right,crop.bottom],
            [crop.right,crop.bottom,crop.left,crop.bottom],[crop.left,crop.bottom,crop.left,crop.top]];
        }
        if(!nextPlan||!Number.isFinite(nextPlan.w)||!Number.isFinite(nextPlan.d)||
          nextPlan.w<=0||nextPlan.d<=0||!nextPlan.crop||!Array.isArray(nextPlan.walls))
          throw Error('户型几何数据无效');
        // No old project is changed until image decode and geometry checks succeed.
        bitmap=nextBitmap;plan=nextPlan;
        $('analysis-card').hidden=false;
        $('analysis-card').querySelector('b').textContent='户型图已转换为立体墙线';
        $('analysis-card').querySelector('.analysis-body').textContent='自动建模为示意初稿，需核对墙体与尺寸。';
        $('photo-preview').hidden=false;
        $('photo-preview').style.backgroundImage='url('+bitmap.toDataURL('image/jpeg',.65)+')';
        $('upload-main').textContent='更换户型图';
        renderPlan();persist();
      }catch(err){console.warn('Import rejected',err);
        planStatus.textContent='导入失败：'+err.message+'；之前的方案未受影响。';}
    };
    img.onerror=()=>{if(sequence===loadSequence)
      planStatus.textContent='图片无法解码，之前的方案未受影响。';};
    img.src=source;
  }

  library.addEventListener('click',e=>{
    if(!plan)return;
    const button=e.target.closest('button');if(!button)return;
    e.preventDefault();e.stopImmediatePropagation();
    const label=button.title?.replace(/^添加/,'')||button.textContent.trim();
    const isBed=/床/.test(label),isSeat=/沙发/.test(label),isRug=/地毯/.test(label);
    const dims=isBed?[1.8,2.1,.45]:isSeat?[1.95,.86,.72]:isRug?[2,1.5,.04]:
      /收纳柜/.test(label)?[1.3,.48,.9]:/书桌/.test(label)?[1.4,.68,.75]:
      /餐桌/.test(label)?[1.2,1.2,.75]:[.65,.65,.65];
    const color=isBed?'#c5a48e':isSeat?'#aa937a':isRug?'#d5c4ac':
      /绿植/.test(label)?'#698966':'#bda786';
    plan.furniture=plan.furniture||[];
    plan.furniture.push({label,dims,color,x:0,z:0,angle:0});
    renderPlan(false);persist();
    planStatus.textContent='已添加 '+label+'，请在 3D 场景中拖动以改变位置。';
  },true);
  const uploadImage=(f)=>{
    const err=validateFloorplanFile(f);
    if(err){planStatus.textContent=err;return;}
    const fr=new FileReader();
    fr.onerror=()=>{planStatus.textContent='图片读取失败，请重试。'};
    fr.onload=()=>activate(fr.result);
    fr.readAsDataURL(f);
  };
  $('photo-input').addEventListener('change',e=>{
    const f=e.target.files?.[0];if(!f)return;
    e.stopImmediatePropagation();uploadImage(f);
    e.target.value='';
  },true);
  $('dropzone').addEventListener('drop',e=>{
    const f=e.dataTransfer.files?.[0];if(!f)return;
    e.preventDefault();e.stopImmediatePropagation();
    uploadImage(f);
  },true);
  // Complete editable blueprint export, unlike the legacy demo-only JSON project.
  const projectActions=document.createElement('div');
  projectActions.className='qixu-project-actions';
  const exportBtn=document.createElement('button');
  exportBtn.type='button';exportBtn.textContent='下载完整户型项目 JSON';
  const importBtn=document.createElement('button');
  importBtn.type='button';importBtn.textContent='导入完整户型项目';
  const projectInput=document.createElement('input');
  projectInput.type='file';projectInput.accept='.json,application/json';projectInput.hidden=true;
  projectActions.append(exportBtn,importBtn,projectInput);
  pane.append(projectActions);
  const exportBlueprint=()=>{
    if(!plan||!bitmap){planStatus.textContent='请先上传或导入户型图。';return;}
    try{
      const packet=makeBlueprintPacket(plan,bitmap.toDataURL('image/jpeg',.76));
      const blob=new Blob([JSON.stringify(packet)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='qixu-blueprint-full.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
      planStatus.textContent='已导出完整户型项目（含底图、墙线、家具、风口位置）；妥善保管，勿公开上传私人户型。';
    }catch(err){planStatus.textContent='导出失败：'+err.message;}
  };
  exportBtn.addEventListener('click',exportBlueprint);
  importBtn.addEventListener('click',()=>projectInput.click());
  projectInput.addEventListener('change',async e=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!file)return;
    if(file.size>MAX_PROJECT_FILE_BYTES){planStatus.textContent='项目文件超过 18 MB，已拒绝导入。';return;}
    try{
      const packet=JSON.parse(await file.text());
      const error=validateBlueprintPacket(packet);
      if(error){planStatus.textContent='导入失败：'+error;return;}
      activate(packet.image,true,structuredClone(packet.plan));
    }catch(err){planStatus.textContent='无法读取项目：'+err.message;}
  });
  $('export-project')?.addEventListener('click',e=>{
    if(!plan)return;
    e.preventDefault();e.stopImmediatePropagation();exportBlueprint();
  },true);
  const privacy=document.createElement('button');
  privacy.type='button';privacy.className='qixu-clear-data';
  privacy.textContent='删除本机保存的户型与图片';
  privacy.addEventListener('click',()=>{
    if(!confirm('确定删除此浏览器保存的户型图、家具和设计进度？删除后无法恢复。'))return;
    try{
      localStorage.removeItem('qixu-blueprint-v6');
      localStorage.removeItem('qixu-space-studio-v4.autosave');
    }catch(err){console.warn('Could not clear local data',err);}
    window.location.reload();
  });
  pane.append(privacy);
  pane.querySelector('#plan-edit').addEventListener('click',()=>{
    stopMeasure();editing=!editing;first=null;pane.querySelector('#plan-edit').textContent=editing?'结束绘墙':'补画墙体';
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
    if(!plan||e.button!==0)return;
    if(measuring){
      e.preventDefault();e.stopImmediatePropagation();
      if(!fromPointer(e))return;
      const c=plan.crop;
      const x=clamp((hit.x/plan.w+.5)*(c.right-c.left)+c.left,c.left,c.right);
      const y=clamp((hit.z/plan.d+.5)*(c.bottom-c.top)+c.top,c.top,c.bottom);
      measurePoints.push([x,y]);
      if(measurePoints.length===1){
        scaleResult.textContent='已选起点，请点击第二个端点。';return;
      }
      try{
        if(!plan.ventilation)plan.ventilation=physics.getPorts();
        plan=calibrateFloorplan(plan,measurePoints[0],measurePoints[1],knownLength.valueAsNumber);
        stopMeasure();renderPlan(true);persist();
        scaleResult.textContent='校准成功 · 宽 '+plan.w.toFixed(2)+' 米 × 深 '+plan.d.toFixed(2)+' 米';
      }catch(err){stopMeasure();scaleResult.textContent='校准失败：'+err.message;}
      return;
    }
    if(physics.isMarking()){
      if(fromPointer(e)){physics.place(hit.x,hit.z);persist();}
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    if(!editing){
      const rect=renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      const selected=ray.intersectObjects(objects,false)[0];
      if(selected){
        e.preventDefault();e.stopImmediatePropagation();
        moving=selected.object.userData.floorObjectIndex;plan.selectedIndex=moving;
        orbit.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);
        planStatus.textContent='已选中 '+plan.furniture[moving].label+'，拖动可调整位置，按 R 可旋转。';
      }
      return;
    }
    e.stopImmediatePropagation();e.preventDefault();
    if(!fromPointer(e))return;
    const x=clamp((hit.x/plan.w+.5)*(plan.crop.right-plan.crop.left)+plan.crop.left,plan.crop.left,plan.crop.right);
    const y=clamp((hit.z/plan.d+.5)*(plan.crop.bottom-plan.crop.top)+plan.crop.top,plan.crop.top,plan.crop.bottom);
    if(!first)first=[x,y];else{
      const second=[x,y];if(Math.abs(x-first[0])<Math.abs(y-first[1]))second[0]=first[0];else second[1]=first[1];
      plan.walls.push([...first,...second]);first=null;renderPlan();persist();
    }
  },true);

  renderer.domElement.addEventListener('pointermove',e=>{
    if(moving===null||!plan)return;
    if(!fromPointer(e))return;
    const item=plan.furniture[moving];
    item.x=clamp(hit.x,-plan.w/2+.2,plan.w/2-.2);
    item.z=clamp(hit.z,-plan.d/2+.2,plan.d/2-.2);
    const mesh=objects[moving];
    if(mesh){mesh.position.x=item.x;mesh.position.z=item.z;}
    e.stopImmediatePropagation();
  },true);
  renderer.domElement.addEventListener('pointerup',e=>{
    if(moving===null)return;
    moving=null;orbit.enabled=true;persist();physics.rebuild();e.stopImmediatePropagation();
  },true);
  window.addEventListener('keydown',e=>{
    if(!plan||moving!==null||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(!Number.isInteger(plan.selectedIndex))return;
    const idx=plan.selectedIndex,obj=plan.furniture?.[idx];
    if(!obj)return;
    if(e.key.toLowerCase()==='r'){obj.angle=(obj.angle||0)+Math.PI/4;e.stopImmediatePropagation();renderPlan(false);persist();}
    if(e.key==='Delete'){plan.furniture.splice(idx,1);delete plan.selectedIndex;e.stopImmediatePropagation();renderPlan(false);persist();}
  },true);
  // Hide the old three-room template if another control rebuilt it.
  const tick=()=>{
    if(plan){const room=scene.getObjectByName('editable-room');if(room)room.visible=false;state.items.forEach(i=>i.group.visible=false);}
    requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
  try{const saved=JSON.parse(localStorage.getItem('qixu-blueprint-v6')||'null');
    if(saved?.plan&&saved?.image&&Array.isArray(saved.plan.walls)){activate(saved.image,true,saved.plan);}
  }catch(e){console.warn('Plan restore skipped',e)}
}
