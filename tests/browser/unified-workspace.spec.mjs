import {test,expect} from '@playwright/test';

test('single Studio workspace switches project, furniture, analysis and renderer without URL navigation',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/studio.html');
 const initial=page.url();
 await expect(page.locator('[data-panel]')).toHaveCount(6);
 const mine=await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'));
 await page.locator('[data-panel="projects"]').click();
 await expect(page.locator('[data-sidebar="projects"]')).toBeVisible();
 await expect(page.locator('[data-project]')).toHaveCount(3);
 await page.locator('[data-project="sunlit"]').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible({timeout:24000});
 await expect(page.locator('#studio-active-project')).toContainText('日光都市公寓');
 expect(page.url()).toBe(initial);
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page.locator('#studio-flow-status')).toContainText('已计算');
 await expect(page.locator('#studio-flow-overlay circle')).toHaveCount(2);
 await page.locator('#studio-bagua').check();
 await expect(page.locator('#studio-flow-overlay text[data-bagua]')).toHaveCount(8);
 await page.locator('#studio-bagua').uncheck();
 await expect(page.locator('[data-sidebar="analysis"]')).toBeVisible();
 await page.locator('[data-panel="library"]').click();
 await page.getByRole('button',{name:/单椅/}).click();
 await expect(page.locator('[data-furniture-id]')).toHaveCount(9);
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('#studio-flow-overlay circle')).toHaveCount(2);
 await page.locator('[data-panel="projects"]').click();
 await page.locator('#open-personal').click();
 await expect(page.locator('#studio-active-project')).toContainText('我的项目');
 expect(await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'))).toBe(mine);
 expect(page.url()).toBe(initial);
 expect(errors).toEqual([]);
});
test('render is a lazy embedded view and switching tabs unloads GPU work',async({page})=>{
 await page.goto('/studio.html');
 await expect(page.locator('#studio-render-frame')).toBeHidden();
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#studio-render-frame')).toBeVisible();
 await expect(page.locator('#studio-render-frame')).toHaveAttribute('src',/photoreal\.html\?embed=1/);
 await expect(page.locator('[data-sidebar="render"]')).toBeVisible();
 await page.locator('[data-panel="materials"]').click();
 await expect(page.locator('#studio-render-frame')).toBeHidden();
 await expect(page.locator('#studio-render-frame')).toHaveAttribute('src','about:blank');
 await expect(page.locator('#plan-svg')).toBeVisible();
 await expect(page).toHaveURL(/\/studio\.html$/);
});
test('solar calculator validates missing coordinates without blanking the canvas',async({page})=>{
 await page.goto('/studio.html');
 await page.locator('[data-panel="analysis"]').click();
 await page.locator('#studio-sun-calc').click();
 await expect(page.locator('#studio-sun-status')).toContainText('请先填写');
 await expect(page.locator('#plan-svg')).toBeVisible();
 await page.locator('#studio-lat').fill('31.2304');
 await page.locator('#studio-lon').fill('121.4737');
 await page.locator('#studio-date').fill('2026-10-22');
 await page.locator('#studio-sun-calc').click();
 await expect(page.locator('#studio-sun-status')).toContainText('太阳高度');
});
test('all six modules fit mobile without 4 separate navigation links',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/studio.html');
 for(const mode of ['projects','structure','library','materials','analysis','render']){
  await page.locator('[data-panel="'+mode+'"]').click();
  await expect(page.locator('[data-sidebar="'+mode+'"]')).toBeVisible();
  const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
  expect(sizes[0],mode).toBeLessThanOrEqual(sizes[1]+3);
 }
});
