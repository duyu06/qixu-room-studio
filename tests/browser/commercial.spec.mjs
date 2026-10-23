import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('main editor boots as 3D and exposes editable tools', async ({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/?legacy=1');
  await expect(page).toHaveTitle(/栖序/);
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#photo-input')).toHaveAttribute('accept',/image/);
  expect(pageErrors).toEqual([]);
});

test('unrelated picture of same K4 size must not activate K4 walls',async ({page})=>{
  await page.goto('/?legacy=1');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=474;c.height=514;
    const cx=c.getContext('2d');cx.fillStyle='#fafafa';cx.fillRect(0,0,474,514);
    cx.fillStyle='#202020';cx.fillRect(45,45,160,20);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#photo-input').setInputFiles({name:'unknown-floorplan.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.locator('#plan-status')).toContainText('示意', {timeout:15000});
  await expect(page.locator('#plan-status')).not.toContainText('K-4');
});

test('invalid uploaded image shows recovery feedback',async ({page})=>{
  await page.goto('/?legacy=1');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  await page.locator('#photo-input').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not a png')});
  await expect(page.locator('#plan-status')).toContainText('无法解码');
});

test('high quality page explains missing saved floorplan',async ({page})=>{
  await page.goto('/photoreal.html');
  await expect(page.locator('#overlay')).toContainText('尚无已保存户型图');
});

test('privacy clear action exists and requires confirmation',async ({page})=>{
  await page.goto('/?legacy=1');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  const button=page.getByRole('button',{name:'删除本机保存的户型与图片'});
  await expect(button).toBeVisible();
  page.once('dialog',async dialog=>{ expect(dialog.type()).toBe('confirm');await dialog.dismiss(); });
  await button.click();
  await expect(button).toBeVisible();
});

test('full blueprint export retains source and geometry',async ({page})=>{
  await page.goto('/?legacy=1');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  const data=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=474;c.height=514;
    const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,474,514);
    ctx.fillStyle='#222';ctx.fillRect(90,50,300,8);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#photo-input').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.locator('#plan-status')).toContainText('示意',{timeout:15000});
  const waiter=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载完整户型项目 JSON'}).click();
  const saved=await waiter;
  const project=JSON.parse(readFileSync(await saved.path(),'utf8'));
  expect(project.schema).toBe('qixu-blueprint');
  expect(project.version).toBe(1);
  expect(project.plan.walls.length).toBeGreaterThan(0);
  expect(project.image).toMatch(/^data:image\/jpeg;base64,/);
});

test('measured scale is stored in the complete blueprint project',async ({page})=>{
  await page.goto('/?legacy=1');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  const data=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=474;canvas.height=514;
    const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,474,514);
    c.fillStyle='#161616';c.fillRect(40,40,300,9);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#photo-input').setInputFiles({
    name:'measured-room.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')
  });
  await expect(page.locator('#qixu-scale-result')).toContainText('尚未校准',{timeout:15000});
  await page.locator('#qixu-known-length').fill('2');
  await page.getByRole('button',{name:'开始两点标定'}).click();
  const viewport=page.locator('#viewport canvas').first();
  const r=await viewport.boundingBox();
  expect(r).toBeTruthy();
  await viewport.click({position:{x:r.width*.43,y:r.height*.51}});
  await expect(page.locator('#qixu-scale-result')).toContainText('已选起点');
  await viewport.click({position:{x:r.width*.57,y:r.height*.51}});
  await expect(page.locator('#qixu-scale-result')).toContainText('校准成功');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-blueprint-v6')));
  expect(saved.plan.calibration.measuredByUser).toBe(true);
  expect(saved.plan.calibration.distanceMeters).toBe(2);
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载完整户型项目 JSON'}).click();
  const file=await download;
  const json=JSON.parse(readFileSync(await file.path(),'utf8'));
  expect(json.plan.calibration.measuredByUser).toBe(true);
  expect(json.plan.calibration.distanceMeters).toBe(2);
});

test('3D editor works without external script access',async ({page})=>{
  const foreign=[];
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin==='http://127.0.0.1:4173')return route.continue();
    foreign.push(url.href);
    return route.abort('blockedbyclient');
  });
  await page.goto('/?legacy=1');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:25000});
  await expect(page.locator('#fatal')).toBeHidden();
  expect(foreign.filter(x=>/\.js(\?|$)|\/npm\/|\/modules\//.test(x))).toEqual([]);
});
