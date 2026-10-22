import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('studio 2D wall/door/window editor, save, and 3D geometry',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/studio.html');
 await expect(page).toHaveTitle(/栖序 Studio/);
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page.locator('[data-wall-id]')).toHaveCount(5);
 await expect(page.locator('[data-opening-id]')).toHaveCount(3);
 await page.locator('[data-tool="wall"]').click();
 await page.evaluate(()=>{
   const svg=document.querySelector('#plan-svg');
   for(const p of [[-3.8,-1.8],[-3.8,1.7]]){
     const loc=new DOMPoint(...p).matrixTransform(svg.getScreenCTM());
     svg.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:loc.x,clientY:loc.y}));
   }
 });
 await expect(page.locator('[data-wall-id]')).toHaveCount(6);
 await page.locator('[data-tool="door"]').click();
 await page.evaluate(()=>{
   const svg=document.querySelector('#plan-svg');
   const wall=document.querySelectorAll('[data-wall-id]')[1];
   const saved=JSON.parse(localStorage.getItem('qixu-studio-v1'));
   const w=saved.walls[1],pos=[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2];
   const xy=new DOMPoint(...pos).matrixTransform(svg.getScreenCTM());
   wall.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:xy.x,clientY:xy.y}));
 });
 await expect(page.locator('[data-opening-id]')).toHaveCount(4);
 await page.getByRole('button',{name:/3D 立体/}).click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible({timeout:25000});
 await page.waitForTimeout(1500);
 await testInfo.attach('studio-3d.png',{body:await page.locator('#three-viewport').screenshot(),contentType:'image/png'});
 const download=page.waitForEvent('download');
 await page.locator('#export').click();
 const file=await download;
 const obj=JSON.parse(readFileSync(await file.path(),'utf8'));
 expect(obj.walls).toHaveLength(6);expect(obj.openings).toHaveLength(4);
 expect(obj.schema).toBe('qixu-studio');
 expect(errors).toEqual([]);
});
test('studio furniture catalog, object properties, undo and redo',async({page})=>{
 await page.goto('/studio.html');
 await page.locator('[data-panel="library"]').click();
 await page.getByRole('button',{name:/双人床/}).click();
 await expect(page.locator('[data-furniture-id]')).toHaveCount(1);
 await expect(page.locator('[data-prop="fWidth"]')).toBeVisible();
 await page.locator('[data-prop="fWidth"]').fill('2.1');
 await page.locator('[data-prop="fWidth"]').press('Tab');
 await expect(page.locator('[data-prop="fWidth"]')).toHaveValue('2.1');
 await page.locator('#undo').click();
 await expect(page.locator('[data-prop="fWidth"]')).toHaveCount(0);
 await page.locator('#redo').click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')));
 expect(saved.furniture[0].width).toBe(2.1);
 await page.reload();
 await expect(page.locator('[data-furniture-id]')).toHaveCount(1);
});
test('studio imported invalid document is rejected without project loss',async({page})=>{
 await page.goto('/studio.html');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')));
 await page.locator('#file-json').setInputFiles({name:'wrong.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schema:'bad',version:1}))});
 await expect(page.locator('#toast')).toContainText('导入失败');
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')));
 expect(after).toEqual(before);
});
test('studio mobile 390px layout and tools are reachable',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/studio.html');
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page.locator('[data-tool="door"]')).toBeVisible();
 await expect(page.locator('#property-body')).toBeVisible();
 await testInfo.attach('studio-mobile.png',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 expect(sizes.scroll).toBeLessThanOrEqual(sizes.client+2);
});
test('studio model remains accessible without external scripts',async({page})=>{
 const foreign=[];
 await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin==='http://127.0.0.1:4173')return route.continue();
   foreign.push(url.href);return route.abort();
 });
 await page.goto('/studio.html');
 await expect(page.locator('[data-wall-id]')).toHaveCount(5);
 await page.getByRole('button',{name:/3D 立体/}).click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible({timeout:25000});
 expect(foreign).toEqual([]);
});
