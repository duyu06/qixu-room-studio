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
test('all four product surfaces share a single reachable navigation map',async({page})=>{
 for(const path of ['/showcase.html','/studio.html','/index.html','/photoreal.html']){
  await page.goto(path);
  const summary=page.getByText('切换模块',{exact:true});
  await expect(summary).toBeVisible();
  await summary.click();
  const entries=page.locator('.qx-hub-links a');
  await expect(entries).toHaveCount(4);
  for(const name of ['产品展示','专业设计','空间分析','光照预览']){
   await expect(entries.getByText(name,{exact:true})).toBeVisible();
  }
  const current=await page.evaluate(()=>location.pathname.split('/').pop());
  const active=await page.locator('.qx-hub-links a[aria-current="page"]').count();
  expect(active,current).toBe(1);
 }
});
test('3D showcase project flows to correct WebGPU preview, not personal project',async({page})=>{
 await page.goto('/studio.html');
 const before=await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'));
 await page.goto('/studio.html?template=sunlit&view=2d');
 await expect(page.locator('.studio-demo-banner')).toBeVisible();
 const demo=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect(demo?.title).toContain('日光都市公寓');
 const renderLink=page.locator('[data-qixu-render-link]');
 await expect(renderLink).toHaveAttribute('href','./photoreal.html?template=sunlit');
 // Simulate a browser without WebGPU; accepted demo data reaches the capability gate.
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined}));
 await renderLink.click();
 await expect(page).toHaveURL(/photoreal\.html\?template=sunlit/);
 await expect(page.locator('#overlay')).toContainText('没有启用 WebGPU',{timeout:10000});
 await expect(page.locator('[data-qixu-studio-link]')).toHaveAttribute('href','./studio.html?template=sunlit&view=3d');
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
