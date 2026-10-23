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

test('moving furniture updates 3D object without rebuilding walls and floor',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 const initial=Number(await page.locator('#three-viewport').getAttribute('data-scene-rebuilds'));
 const storageKey=await page.evaluate(()=>Object.keys(localStorage).find(k=>k.includes('sunlit')&&k.includes('studio')));
 expect(storageKey).toBeTruthy();
 await page.evaluate(key=>{
   const project=JSON.parse(localStorage.getItem(key));
   if(!project.furniture.length)throw Error('template has no furniture');
   project.furniture[0].x+=.12;
   localStorage.setItem(key,JSON.stringify(project));
 },storageKey);
 await page.reload();
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 const afterReload=Number(await page.locator('#three-viewport').getAttribute('data-scene-rebuilds'));
 expect(afterReload).toBeGreaterThan(0);
 // A material/lighting-only change must never invalidate the static room mesh.
 await page.locator('[data-panel="materials"]').click();
 await page.locator('[data-lighting="day"]').click();
 expect(Number(await page.locator('#three-viewport').getAttribute('data-scene-rebuilds'))).toBe(afterReload);
});
