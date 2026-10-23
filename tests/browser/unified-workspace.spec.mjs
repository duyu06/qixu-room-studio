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
 await page.locator('[data-panel="analysis"]').click();
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
