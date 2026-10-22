import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Investor showcase: authentic plan cards and working walkthrough entry',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/showcase.html');
 await expect(page).toHaveTitle(/栖序/);
 await expect(page.locator('.project')).toHaveCount(3);
 await expect(page.locator('.project-art svg')).toHaveCount(3);
 await expect(page.locator('#hero-plan svg')).toBeVisible();
 const initial=await page.locator('#hero-name').textContent();
 await page.locator('#hero-next').click();
 await expect(page.locator('#hero-name')).not.toHaveText(initial);
 await expect(page.locator('.hero-buttons .primary')).toHaveAttribute('href',/template=compact/);
 const card=page.locator('.project').first();
 await expect(card.locator('svg line')).not.toHaveCount(0);
 await expect(card.locator('.project-action')).toHaveAttribute('href',/template=sunlit/);
 await testInfo.attach('showcase-desktop.png',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 expect(errors).toEqual([]);
});

test('Demo click opens furnished 3D while keeping private project separate',async({page},testInfo)=>{
 await page.goto('/studio.html');
 const old=await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'));
 expect(old).not.toBeNull();
 await page.goto('/showcase.html');
 await page.locator('.project').first().locator('.project-action').click();
 await expect(page).toHaveURL(/studio\.html\?template=sunlit&view=3d/);
 await expect(page.locator('.studio-demo-banner')).toContainText('日光都市公寓');
 await expect(page.getByRole('button',{name:'显示完整墙体'})).toBeVisible();
 await expect(page.locator('#three-viewport canvas')).toBeVisible({timeout:25000});
 await testInfo.attach('demo-3d.png',{body:await page.locator('#three-viewport').screenshot(),contentType:'image/png'});
 await page.getByRole('button',{name:'显示完整墙体'}).click();
 await expect(page.getByRole('button',{name:'开启透视墙'})).toBeVisible();
 await expect(page.locator('[data-furniture-id]')).toHaveCount(8);
 const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect(current.title).toContain('日光都市公寓');
 expect(current.openings.length).toBeGreaterThan(2);
 expect(await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'))).toBe(old);
});

test('Saving template as personal project requires explicit confirmation',async({page})=>{
 await page.goto('/studio.html');
 const previous=await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'));
 await page.goto('/studio.html?template=compact&view=2d');
 await expect(page.locator('.studio-demo-banner')).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:/另存为我的项目/}).click();
 expect(await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'))).toBe(previous);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:/另存为我的项目/}).click();
 await expect(page).toHaveURL(/\/studio\.html$/);
 const project=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')));
 expect(project.title).toContain('木色小家');
});

test('Showcase is mobile-responsive and needs no external runtime',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 const external=[];
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='http://127.0.0.1:4173')return route.continue();
  external.push(url.href);return route.abort();
 });
 await page.goto('/showcase.html');
 await expect(page.locator('.project')).toHaveCount(3);
 await expect(page.locator('#hero-plan svg')).toBeVisible();
 const measures=await page.evaluate(()=>({screen:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 expect(measures.scroll,JSON.stringify(measures)).toBeLessThanOrEqual(measures.screen+2);
 await testInfo.attach('showcase-mobile.png',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 expect(external).toEqual([]);
});
