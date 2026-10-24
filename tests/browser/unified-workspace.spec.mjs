import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
test('all Studio functions use one address and one project context',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('[data-panel="structure"]')).toBeVisible();
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('#studio-analysis-result')).toContainText('门洞 / 窗洞');
 await expect(page).toHaveURL(/studio.html\?template=sunlit/);
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#integrated-preview')).toBeVisible();
 await expect(page.locator('#integrated-render-frame')).toHaveAttribute('src','./photoreal.html?template=sunlit');
 await expect(page).toHaveURL(/studio.html\?template=sunlit/);
 await page.locator('[data-panel="library"]').click();
 await expect(page.locator('#integrated-preview')).toBeHidden();
 await expect(page.locator('#furniture-library')).toBeVisible();
 const p=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect(p.openings.length).toBeGreaterThan(0);
});
test('single workspace in mobile viewport remains reachable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/studio.html');
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('#studio-analysis-result')).toBeVisible();
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#integrated-preview')).toBeVisible();
 await page.locator('#render-return').click();
 await expect(page.locator('#integrated-preview')).toBeHidden();
});

test('3D button must show a real WebGL canvas, not the 2D SVG',async({page})=>{
 await page.goto('/studio.html?template=sunlit');
 await page.locator('[data-view="3d"]').click();
 const selected=await page.locator('[data-view="3d"]').getAttribute('aria-pressed');
 if(selected==='true'){
   await expect(page.locator('#plan-svg')).toBeHidden();
   await expect(page.locator('#three-viewport')).toBeVisible();
   await expect(page.locator('#three-viewport canvas')).toBeVisible();
   const pixels=await page.locator('#three-viewport canvas').evaluate(canvas=>{
     const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
     return Boolean(gl&&canvas.width>0&&canvas.height>0);
   });
   expect(pixels,'3D mode needs a real WebGL drawing surface').toBeTruthy();
 }else{
   await expect(page.locator('[data-view="2d"]')).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('#status-text')).toContainText('3D 无法启动');
 }
});

test('3D navigation controls switch camera tools without leaving workspace',async({page})=>{
 await page.goto('/studio.html?template=sunlit');
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.locator('#camera-pan').click();
 await expect(page.locator('#camera-pan')).toHaveAttribute('aria-pressed','true');
 await page.locator('#camera-pan').click();
 await expect(page.locator('#camera-pan')).toHaveAttribute('aria-pressed','false');
 await page.locator('#camera-eye').click();
 await expect(page.locator('#status-text')).toContainText('室内视角');
 await page.locator('#camera-top').click();
 await expect(page.locator('#status-text')).toContainText('俯视 3D');
 await page.locator('#reset-camera').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await expect(page).toHaveURL(/studio\.html/);
});

test('material sidebar lighting presets respond without navigation',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.locator('[data-panel="materials"]').click();
 for(const preset of ['day','evening','showcase']){
   await page.locator('[data-lighting="'+preset+'"]').click();
   await expect(page.locator('[data-lighting="'+preset+'"]')).toHaveClass(/active/);
   expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')).lightingMode)).toBe(preset);
 }
 await expect(page.locator('#plan-svg')).toBeHidden();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
});

test('lighting mode and surfaces survive 2D/3D and full reload',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await page.locator('[data-panel="materials"]').click();
 await page.locator('[data-lighting="evening"]').click();
 await page.locator('[data-floor="#bda58a"]').click();
 await page.locator('[data-view="2d"]').click();
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.reload();
 await page.locator('[data-panel="materials"]').click();
 await expect(page.locator('[data-lighting="evening"]')).toHaveClass(/active/);
 const project=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect(project.lightingMode).toBe('evening');
 expect(project.floor).toBe('#bda58a');
});

test('3D geometry cache prevents rebuild for view switching and light edits',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 const count=()=>page.locator('#three-viewport').getAttribute('data-scene-rebuilds');
 const before=Number(await count());
 expect(before).toBeGreaterThan(0);
 await page.locator('[data-view="2d"]').click();
 await page.locator('[data-view="3d"]').click();
 expect(Number(await count())).toBe(before);
 await page.locator('[data-panel="materials"]').click();
 await page.locator('[data-lighting="evening"]').click();
 expect(Number(await count())).toBe(before);
 await page.locator('[data-floor="#bda58a"]').click();
 expect(Number(await count())).toBeGreaterThan(before);
});

test('moving furniture updates 3D objects without rebuilding static room geometry',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 const count=()=>page.locator('#three-viewport').getAttribute('data-scene-rebuilds');
 const initial=Number(await count());
 await page.locator('[data-view="2d"]').click();
 const furniture=page.locator('[data-furniture-id] rect').last();
 await expect(furniture).toBeVisible();
 await furniture.click();
 const x=page.locator('[data-prop="x"]');
 await expect(x).toBeVisible();
 const before=Number(await x.inputValue());
 await x.fill(String(before+.3));
 await x.dispatchEvent('change');
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 expect(Number(await count())).toBe(initial);
 expect(Number(await page.locator('#three-viewport').getAttribute('data-furniture-updates'))).toBeGreaterThan(0);
});

test('2D furniture rotation handle rotates and persists into 3D',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 const furniture=page.locator('[data-furniture-id] rect').last();
 await expect(furniture).toBeVisible();
 await furniture.click();
 const handle=page.locator('[data-rotate-id]').first();
 await expect(handle).toBeVisible();
 const before=Number(await page.locator('[data-prop="angle"]').inputValue());
 const bb=await handle.boundingBox();
 expect(bb).toBeTruthy();
 await page.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);
 await page.mouse.down();
 await page.mouse.move(bb.x+bb.width/2+80,bb.y+bb.height/2+30,{steps:7});
 await page.mouse.up();
 const after=Number(await page.locator('[data-prop="angle"]').inputValue());
 expect(after).not.toBe(before);
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.reload();
 await page.locator('[data-view="2d"]').click();
 await page.locator('[data-furniture-id] rect').last().click();
 expect(Number(await page.locator('[data-prop="angle"]').inputValue())).toBeCloseTo(after,0);
});

test('P1 self-contained GLB imports as real geometry and persists on reload',async({page})=>{
 const pos=Buffer.alloc(36),values=[0,0,0,1,0,0,0,1,1];
 values.forEach((n,i)=>pos.writeFloatLE(n,i*4));
 const gltf={asset:{version:'2.0'},buffers:[{byteLength:pos.length}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:pos.length,target:34962}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,1]}],
  meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],nodes:[{mesh:0}],
  scenes:[{nodes:[0]}],scene:0};
 const json=Buffer.from(JSON.stringify(gltf));const padding=(4-json.length%4)%4;
 const chunk=Buffer.concat([json,Buffer.alloc(padding,32)]);
 const head=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);
 head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(12+8+chunk.length+8+pos.length,8);
 jsonHeader.writeUInt32LE(chunk.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);
 binHeader.writeUInt32LE(pos.length,0);binHeader.writeUInt32LE(0x004e4942,4);
 const glb=Buffer.concat([head,jsonHeader,chunk,binHeader,pos]);
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-furniture-id] rect').last().click();
 await page.locator('[data-panel="library"]').click();
 await page.locator('#file-glb').setInputFiles({name:'triangle.glb',mimeType:'model/gltf-binary',buffer:glb});
 await expect(page.locator('#toast')).toContainText('按原始米制尺寸导入',{timeout:15000});
 const bound=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')).furniture.find(f=>f.modelData));
 expect(bound).toBeTruthy();
 expect([bound.width,bound.height,bound.depth]).toEqual([1,1,1]);
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await expect.poll(async()=>Number(await page.locator('#three-viewport').getAttribute('data-glb-loaded'))).toBeGreaterThan(0);
 await page.reload();
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await expect.poll(async()=>Number(await page.locator('#three-viewport').getAttribute('data-glb-loaded'))).toBeGreaterThan(0);
});

test('P2 IFC STEP wall geometry imports through local web-ifc WASM',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/studio.html?view=2d');
 page.on('dialog',dialog=>dialog.accept());
 await page.locator('#file-ifc').setInputFiles({
   name:'upstream-example.ifc',mimeType:'application/x-step',
   buffer:readFileSync('tests/fixtures/web-ifc-example.ifc')
 });
 await expect(page.locator('#project-title')).toHaveValue('IFC 墙体户型',{timeout:65000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')));
 expect(saved.walls.length).toBeGreaterThan(0);
 expect(saved.walls.every(w=>w.id.startsWith('ifc-')&&w.ifcExpressId)).toBeTruthy();
 expect(errors).toEqual([]);
});

test('airflow preview toggles without losing 3D scene and floor textures persist',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-panel="simulation"]').click();
 await page.locator('#airflow-toggle').check();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await expect(page.locator('#three-viewport')).toHaveAttribute('data-airflow-active','true');
 await page.locator('#airflow-toggle').uncheck();
 await expect(page.locator('#three-viewport')).toHaveAttribute('data-airflow-active','false');
 await page.locator('[data-panel="materials"]').click();
 await page.locator('[data-floor-pattern="tile"]').click();
 const project=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect((await project()).floorPattern).toBe('tile');
 await page.locator('[data-view="2d"]').click();
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.reload();
 expect((await project()).floorPattern).toBe('tile');
});

test('wall PBR texture mode persists after scene redraw and reload',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.locator('[data-panel="materials"]').click();
 await page.locator('[data-wall-pattern="wallpaper"]').click();
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect(saved.wallPattern).toBe('wallpaper');
 await page.reload();
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect(saved.wallPattern).toBe('wallpaper');
 await page.locator('[data-view="3d"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
});

test('pressure boundary controls and custom floor texture persist in one studio project',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await page.locator('[data-panel="simulation"]').click();
 await page.locator('#flow-pressure').fill('12');
 await page.locator('#flow-pressure').dispatchEvent('change');
 await page.locator('#flow-inlet').fill('55');
 await page.locator('#flow-inlet').dispatchEvent('change');
 const key='qixu-studio-demo-sunlit-v1';
 let doc=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(doc.flowPressurePa).toBe(12);
 expect(doc.flowInlet).toBeCloseTo(.55,2);
 await page.locator('[data-panel="materials"]').click();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1WQAAAABJRU5ErkJggg==','base64');
 await page.locator('#texture-file').setInputFiles({name:'wood.png',mimeType:'image/png',buffer:png});
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 doc=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(doc.floorTexture).toBeFalsy();
 await page.locator('#texture-floor').click();
 await page.locator('#texture-file').setInputFiles({name:'wood.png',mimeType:'image/png',buffer:png});
 await expect.poll(async()=>{
   const stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
   return Boolean(stored.floorTexture?.startsWith('data:image/png;base64,'));
 }).toBe(true);
 await page.reload();
 doc=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(doc.flowPressurePa).toBe(12);
 expect(doc.floorTexture).toContain('data:image/png;base64,');
});

test('CFD export offers validated solver input, not fabricated flow results',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await page.locator('[data-panel="simulation"]').click();
 const downloadPromise=page.waitForEvent('download');
 await page.locator('details:has(#cfd-export) summary').click();
 await page.locator('#cfd-export').click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toBe('qixu-openfoam-input.json');
 await expect(page.locator('#cfd-result-status')).toContainText('尚无 OpenFOAM 结果');
});

test('CFD STL export downloads actual 3D obstacle geometry',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await page.locator('[data-panel="simulation"]').click();
 const pending=page.waitForEvent('download');
 await page.locator('details:has(#cfd-export-stl) summary').click();
 await page.locator('#cfd-export-stl').click();
 const download=await pending;
 expect(download.suggestedFilename()).toBe('qixu-obstacles.stl');
 await expect(page.locator('#cfd-result-status')).toContainText('流体域网格');
});

test('selected furniture offers precise 90 degree rotation and keyboard duplication',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-furniture-id] rect').last().dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:320,clientY:320});
 const angle=page.locator('[data-prop="angle"]');
 const original=Number(await angle.inputValue());
 await page.locator('[data-rotate-right]').click();
 let current=Number(await angle.inputValue());
 const expected=(original+90+180)%360-180;
 expect(Math.abs(current-expected)).toBeLessThan(1);
 const before=await page.locator('[data-furniture-id]').count();
 await page.locator('#plan-svg').press('Control+d');
 await expect(page.locator('[data-furniture-id]')).toHaveCount(before+1);
 await page.reload();
 await page.locator('[data-view="2d"]').click();
 await expect(page.locator('[data-furniture-id]')).toHaveCount(before+1);
});

test('custom wind source and wider airflow coverage persist',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await page.locator('[data-panel="simulation"]').click();
 await page.locator('#airflow-source').selectOption('custom');
 await page.locator('#airflow-source-x').fill('-2');
 await page.locator('#airflow-source-x').dispatchEvent('change');
 await page.locator('#airflow-source-z').fill('0.5');
 await page.locator('#airflow-source-z').dispatchEvent('change');
 await page.locator('#airflow-spread').fill('2.6');
 await page.locator('#airflow-spread').dispatchEvent('change');
 await page.locator('#airflow-toggle').check();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 const key='qixu-studio-demo-sunlit-v1';
 let p=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(p.airflowSource).toBe('custom');expect(p.airflowX).toBe(-2);
 expect(p.airflowSpread).toBe(2.6);
 await page.reload();
 p=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 expect(p.airflowSource).toBe('custom');expect(p.airflowZ).toBe(.5);
});

test('simulation panel lets user place wind source with a 2D click and preview in 3D',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await page.locator('[data-panel="simulation"]').click();
 await expect(page.locator('#place-wind-source')).toBeVisible();
 await page.locator('#place-wind-source').click();
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page.locator('#place-wind-source')).toHaveAttribute('aria-pressed','true');
 await page.locator('#plan-svg').click({position:{x:220,y:180}});
 await expect(page.locator('#place-wind-source')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('[data-wind-source="true"]')).toHaveCount(1);
 const key='qixu-studio-demo-sunlit-v1';
 const point=await page.evaluate(k=>{const d=JSON.parse(localStorage.getItem(k));return [d.airflowSource,d.airflowX,d.airflowZ];},key);
 expect(point[0]).toBe('custom');
 expect(point.slice(1).every(Number.isFinite)).toBe(true);
 await page.locator('#preview-wind-3d').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await expect(page.locator('[data-sidebar="simulation"]')).toBeVisible();
 await page.reload();
 await page.locator('[data-panel="simulation"]').click();
 await page.locator('[data-view="2d"]').click();
 await expect(page.locator('[data-wind-source="true"]')).toHaveCount(1);
 const saved=await page.evaluate(k=>{const d=JSON.parse(localStorage.getItem(k));return [d.airflowX,d.airflowZ];},key);
 expect(saved).toEqual(point.slice(1));
});
test('wind placement can be cancelled without changing project data',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-panel="simulation"]').click();
 const key='qixu-studio-demo-sunlit-v1';
 const before=await page.evaluate(k=>localStorage.getItem(k),key);
 await page.locator('#place-wind-source').click();
 await page.locator('#plan-svg').press('Escape');
 await expect(page.locator('#place-wind-source')).toHaveAttribute('aria-pressed','false');
 expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(before);
});

test('2D and docked 3D preview remain live side by side during furniture edits',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-view="split"]').click();
 await expect(page.locator('#canvas-wrap')).toHaveClass(/dual-view/);
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 const before=Number(await page.locator('#three-viewport').getAttribute('data-furniture-updates')||0);
 await page.locator('[data-furniture-id] rect').last().click();
 const x=page.locator('[data-prop="x"]');
 const initial=Number(await x.inputValue());
 await x.fill(String(initial+.2));await x.dispatchEvent('change');
 await expect.poll(async()=>Number(await page.locator('#three-viewport').getAttribute('data-furniture-updates'))).toBeGreaterThan(before);
 await expect(page.locator('#plan-svg')).toBeVisible();
 await page.locator('#dock-expand').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await expect(page.locator('#plan-svg')).toBeHidden();
 await page.locator('[data-view="split"]').click();
 await page.locator('#dock-close').click();
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page.locator('#three-viewport')).toBeHidden();
});

test('dual view resize handle and selected furniture focus work without view navigation',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-view="split"]').click();
 const grip=page.locator('#split-resizer');
 await expect(grip).toBeVisible();
 await grip.focus();await page.keyboard.press('ArrowLeft');
 await expect(grip).toHaveAttribute('aria-valuenow','41');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.locator('[data-furniture-id] rect').last().dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:320,clientY:320});
 await page.locator('#dock-focus').click();
 await expect(page.locator('#status-text')).toContainText('镜头已定位');
 await expect(page.locator('#plan-svg')).toBeVisible();
});

test('editor exposes alignment snapping and keyboard nudge in shared 2D/3D mode',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await expect(page.locator('#snap-furniture')).toBeChecked();
 await page.locator('[data-view="split"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.locator('[data-furniture-id] rect').last().dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:320,clientY:320});
 const field=page.locator('[data-prop="x"]');
 await expect(field).toBeVisible();
 const before=Number(await field.inputValue());
 await page.locator('#plan-svg').focus();
 await page.keyboard.press('ArrowRight');
 await expect.poll(async()=>Number(await page.locator('[data-prop="x"]').inputValue())).toBeGreaterThan(before);
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
});

test('existing 3D auto-sync needs no generation button and geometry checks live in analysis',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await expect(page.locator('#infer-3d-model')).toHaveCount(0);
 await page.locator('[data-view="split"]').click();
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('#studio-analysis-result')).toContainText('三维几何检查');
});

test('drag a furniture catalog item directly into the 2D plan without changing page',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-panel="library"]').click();
 const item=page.locator('[data-furniture-type="chair"]');
 await expect(item).toBeVisible();
 const before=await page.locator('[data-furniture-id]').count();
 await item.dragTo(page.locator('#plan-svg'),{targetPosition:{x:350,y:270}});
 await expect(page.locator('[data-furniture-id]')).toHaveCount(before+1);
 await expect(page.locator('.furniture-drop-preview')).toHaveCount(0);
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page).toHaveURL(/studio.html\?template=sunlit/);
 await page.reload();
 await expect(page.locator('[data-furniture-id]')).toHaveCount(before+1);
});

test('selected furniture can be grouped and ungrouped without losing project state',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-panel="library"]').click();
 const furniture=page.locator('[data-furniture-id] rect');
 await furniture.nth(0).dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:300,clientY:260});
 await furniture.nth(1).dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:310,clientY:270,shiftKey:true});
 await expect(page.locator('#batch-selection-count')).toContainText('2 件');
 await page.locator('#group-furniture').click();
 const groups=await page.evaluate(()=>{
  const key=Object.keys(localStorage).find(k=>k.startsWith('qixu-studio')&&k.includes('sunlit'));
  if(!key)return [];
  return JSON.parse(localStorage.getItem(key)).furniture.filter(f=>f.groupId).map(f=>f.groupId);
 });
 expect(groups.length).toBeGreaterThanOrEqual(2);
 expect(groups[0]).toBe(groups[1]);
 await page.locator('#ungroup-furniture').click();
 await expect(page.locator('#batch-selection-count')).toContainText('2 件');
});

test('group rotation and batch duplicate actions preserve original furniture IDs',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-panel="library"]').click();
 const furniture=page.locator('[data-furniture-id] rect');
 await furniture.nth(0).dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:300,clientY:260});
 await furniture.nth(1).dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:310,clientY:270,shiftKey:true});
 await expect(page.locator('#batch-selection-count')).toContainText('2 件');
 await expect(page.locator('#rotate-group-right')).toBeVisible();
 await page.locator('#group-furniture').click();
 await page.locator('#rotate-group-right').click();
 const prior=await page.locator('[data-furniture-id]').count();
 await page.locator('#duplicate-furniture-selection').click();
 await expect(page.locator('[data-furniture-id]')).toHaveCount(prior+2);
});

test('per-wall thickness and height edit through property inspector and sync to 3D',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-wall-id]').first().dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:300,clientY:270});
 await expect(page.locator('[data-prop="wallThickness"]')).toBeVisible();
 await page.locator('[data-prop="wallThickness"]').fill('0.22');
 await page.locator('[data-prop="wallThickness"]').dispatchEvent('change');
 await expect(page.locator('[data-prop="wallThickness"]')).toHaveValue('0.22');
 await page.locator('[data-view="split"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
});

test('wall face colors layer and lock are editable without leaving 2D 3D workspace',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-wall-id]').first().dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:300,clientY:270});
 await expect(page.locator('#wall-layer')).toBeVisible();
 await page.locator('#wall-layer').selectOption('decor');
 await page.locator('[data-wall-color="faceAColor"]').evaluate(input=>{input.value='#bbaacc';input.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('#wall-locked').check();
 await expect(page.locator('#wall-locked')).toBeChecked();
 await page.locator('[data-wall-layer-visible="decor"]').uncheck();
 await expect(page.locator('[data-wall-layer-visible="decor"]')).not.toBeChecked();
 await page.locator('[data-wall-layer-visible="decor"]').check();
 await page.locator('[data-view="split"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
});

test('wall face patterns and repeats independently persist in property inspector',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-wall-id]').first().dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:300,clientY:270});
 await expect(page.locator('[data-wall-face-pattern="faceAPattern"]')).toBeVisible();
 await page.locator('[data-wall-face-pattern="faceAPattern"]').selectOption('plaster');
 await page.locator('[data-wall-face-pattern="faceBPattern"]').selectOption('wallpaper');
 await page.locator('[data-prop="faceARepeat"]').fill('4');
 await page.locator('[data-prop="faceARepeat"]').dispatchEvent('change');
 await expect(page.locator('[data-wall-face-pattern="faceAPattern"]')).toHaveValue('plaster');
 await expect(page.locator('[data-wall-face-pattern="faceBPattern"]')).toHaveValue('wallpaper');
 await expect(page.locator('[data-prop="faceARepeat"]')).toHaveValue('4');
 await page.locator('[data-view="split"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
});

test('wall front and back PBR controls update independently in existing inspector',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.locator('[data-wall-id]').first().dispatchEvent('pointerdown',{button:0,pointerId:1,clientX:300,clientY:270});
 const front=page.locator('[data-prop="faceARoughness"]');
 const back=page.locator('[data-prop="faceBRoughness"]');
 await expect(front).toBeVisible();
 await front.fill('0.3');await front.dispatchEvent('change');
 await expect(front).toHaveValue('0.3');
 await expect(back).toHaveValue('0.94');
 await page.locator('[data-view="split"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
});

test('saved wall material gallery shows searchable draggable categorized thumbnails',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=2d');
 await page.evaluate(()=>localStorage.setItem('qixu-wall-material-presets-v1',JSON.stringify([
  {id:'mat-gallery-test',name:'奶油灰泥',values:{Color:'#ddccbb',Pattern:'plaster',Roughness:.75}},
  {id:'mat-gallery-paint',name:'静谧乳胶漆',values:{Color:'#ddeedd',Pattern:'paint'}}
 ])));
 await page.reload();
 await page.locator('[data-panel="materials"]').click();
 const gallery=page.locator('#material-preset-gallery');
 await expect(gallery.locator('.material-preset-card')).toHaveCount(2);
 await expect(gallery.locator('.material-preset-thumb')).toHaveCount(2);
 await expect(gallery.locator('[data-material-preset-id="mat-gallery-test"]')).toHaveAttribute('draggable','true');
 await page.locator('#material-preset-category').selectOption('plaster');
 await expect(gallery.locator('.material-preset-card')).toHaveCount(1);
 await page.locator('#material-preset-search').fill('不存在');
 await expect(gallery.locator('.material-preset-card')).toHaveCount(0);
 await page.locator('#material-preset-search').fill('奶油');
 await expect(gallery.locator('.material-preset-card')).toHaveCount(1);
 await gallery.locator('.material-preset-card').click();
 await expect(page.locator('#saved-wall-materials')).toHaveValue('mat-gallery-test');
 await page.evaluate(()=>{
  const wall=document.querySelector('#plan-svg [data-wall-id]');
  const svg=document.querySelector('#plan-svg');
  const x=(Number(wall.getAttribute('x1'))+Number(wall.getAttribute('x2')))/2;
  const y=(Number(wall.getAttribute('y1'))+Number(wall.getAttribute('y2')))/2;
  const screen=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());
  const data=new DataTransfer();data.setData('application/x-qixu-material','mat-gallery-test');
  svg.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientX:screen.x,clientY:screen.y}));
 });
 await expect(page.locator('#property-body [data-wall-face-pattern="faceAPattern"]')).toHaveValue('plaster');
});
