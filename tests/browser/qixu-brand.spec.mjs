import {test,expect} from '@playwright/test';

test('official user logo displays on showcase, editor, legacy and renderer',async({page})=>{
 for(const url of ['/showcase.html','/studio.html','/index.html','/photoreal.html']){
  await page.goto(url);
  const img=page.locator('[data-qixu-brand] img');
  await expect(img.first()).toBeVisible({timeout:18000});
  await expect(img.first()).toHaveAttribute('alt',/栖序/);
  const size=await img.first().evaluate(i=>({natural:i.naturalWidth,width:i.getBoundingClientRect().width}));
  expect(size.natural,url+' logo must have decoded bytes').toBeGreaterThan(100);
  expect(size.width,url+' logo must occupy visible space').toBeGreaterThan(70);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href','./assets/qixu-logo-mark.png');
 }
});
test('Studio is a single page workspace; legacy pages retain compatibility navigation',async({page})=>{
 await page.goto('/studio.html');
 await expect(page.locator('[data-panel]')).toHaveCount(6);
 await expect(page.locator('.qx-hub-menu')).toHaveCount(0);
 for(const path of ['/showcase.html','/index.html','/photoreal.html']){
  await page.goto(path);
  if(url==='/studio.html'){
   await expect(page.locator('[data-panel]')).toHaveCount(6);
   await expect(page.locator('.qx-hub-menu')).toHaveCount(0);
  }else{
   await page.getByText('切换模块',{exact:true}).click();
   await expect(page.locator('.qx-hub-links a')).toHaveCount(4);
  }
 }
});
test('Studio demo projects stay in one browser URL through inline GPU preview',async({page})=>{
 await page.goto('/studio.html');
 const before=await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'));
 await page.locator('[data-panel="projects"]').click();
 await page.locator('[data-project="sunlit"]').click();
 await expect(page).toHaveURL(/\/studio\.html$/);
 await expect(page.locator('#three-viewport canvas')).toBeVisible({timeout:20000});
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined}));
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#studio-render-frame')).toBeVisible();
 await expect(page.locator('#studio-render-frame')).toHaveAttribute('src',/photoreal\.html\?embed=1&template=sunlit/);
 await expect(page.frameLocator('#studio-render-frame').locator('#overlay'))
   .toContainText('没有启用 WebGPU',{timeout:12000});
 await expect(page).toHaveURL(/\/studio\.html$/);
 expect(await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'))).toBe(before);
});
test('shared header and switcher work on 390px mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const url of ['/showcase.html','/studio.html','/index.html']){
  await page.goto(url);
  await expect(page.locator('[data-qixu-brand] img').first()).toBeVisible();
  await page.getByText('切换模块',{exact:true}).click();
  await expect(page.locator('.qx-hub-links a')).toHaveCount(4);
  // No horizontal overflow should be introduced by the shared logo/menu.
  const widths=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
  expect(widths[0],url+' horizontal overflow').toBeLessThanOrEqual(widths[1]+3);
 }
});
