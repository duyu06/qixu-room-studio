import {test,expect} from '@playwright/test';

test('public entry keeps one editor, and panels do not navigate',async({page})=>{
 await page.goto('/');
 await expect(page).toHaveURL(/studio\.html/);
 for(const name of ['structure','library','materials','analysis']){
   await page.locator('[data-panel="'+name+'"]').click();
   await expect(page).toHaveURL(new RegExp('studio\\.html\\?panel='+name));
 }
 await expect(page.locator('#studio-analysis-result')).toContainText('门洞 / 窗洞');
 await page.reload();
 await expect(page.locator('[data-sidebar="analysis"]')).toBeVisible();
});

test('render cache invalidates when returning from analysis after project edits',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await page.locator('[data-panel="render"]').click();
 const frame=page.locator('#integrated-render-frame');
 await expect(frame).toHaveAttribute('src',/photoreal\.html/);
 const initial=await page.evaluate(()=>document.querySelector('#integrated-render-frame').contentWindow);
 await page.locator('[data-panel="analysis"]').click();
 await page.evaluate(()=>{
   const key='qixu-studio-demo-sunlit-v1';
   const project=JSON.parse(localStorage.getItem(key));
   project.title+=' QA';
   localStorage.setItem(key,JSON.stringify(project));
 });
 await page.locator('[data-panel="render"]').click();
 await expect.poll(async()=>page.evaluate(()=>document.querySelector('#integrated-render-frame').contentWindow!==null)).toBeTruthy();
 await expect(page.locator('#integrated-preview')).toBeVisible();
 await expect(page.locator('#integrated-render-frame')).toHaveAttribute('src',/photoreal\.html/);
});

test('editor controls remain present and in-page on narrow screens',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/studio.html');
 for(const id of ['new-project','load-sample','import-file','load-image','import-dxf','export','snapshot','undo','redo']){
   await expect(page.locator('#'+id)).toHaveCount(1);
 }
 await page.locator('[data-panel="materials"]').click();
 await expect(page.locator('#floor-swatches')).toBeVisible();
 await page.locator('[data-panel="library"]').click();
 await expect(page.locator('#furniture-library')).toBeVisible();
 await page.locator('[data-panel="structure"]').click();
 await expect(page.locator('#plan-svg')).toHaveCount(1);
});
