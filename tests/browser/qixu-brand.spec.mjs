import {test,expect} from '@playwright/test';

test('official user logo displays on showcase, editor, legacy and renderer',async({page})=>{
 for(const url of ['/showcase.html','/studio.html','/index.html?legacy=1','/photoreal.html']){
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
test('product landing and legacy modules link to one primary studio',async({page})=>{
 for(const path of ['/showcase.html','/index.html?legacy=1','/photoreal.html']){
  await page.goto(path);
  await page.getByText('设计工作台',{exact:true}).click();
  await expect(page.locator('.qx-hub-links a')).toHaveCount(1);
 }
 await page.goto('/studio.html');
 await expect(page.locator('[data-panel]')).toHaveCount(5);
 await expect(page.locator('.qx-hub-menu')).toHaveCount(0);
});
test('showcase uses same editable project in embedded rendering',async({page})=>{
 await page.goto('/studio.html');
 const personal=await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'));
 await page.goto('/studio.html?template=sunlit&view=2d');
 await expect(page.locator('.studio-demo-banner')).toBeVisible();
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#integrated-preview')).toBeVisible();
 await expect(page.locator('#integrated-render-frame')).toHaveAttribute('src','./photoreal.html?template=sunlit');
 await expect(page).toHaveURL(/studio\.html\?template=sunlit/);
 expect(await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'))).toBe(personal);
});
test('responsive logo and unified tools work on 390px mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const url of ['/showcase.html','/studio.html','/index.html?legacy=1']){
  await page.goto(url);
  await expect(page.locator('[data-qixu-brand] img').first()).toBeVisible();
  if(url==='/studio.html')await expect(page.locator('[data-panel]')).toHaveCount(5);
  else {
   await page.getByText('设计工作台',{exact:true}).click();
   await expect(page.locator('.qx-hub-links a')).toHaveCount(1);
  }
  const widths=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
  expect(widths[0],url+' horizontal overflow').toBeLessThanOrEqual(widths[1]+3);
 }
});
