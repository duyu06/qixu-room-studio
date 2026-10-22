import { test, expect } from '@playwright/test';

test('main editor boots as 3D and exposes editable tools', async ({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/栖序/);
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#photo-input')).toHaveAttribute('accept',/image/);
  expect(pageErrors).toEqual([]);
});

test('unrelated picture of same K4 size must not activate K4 walls',async ({page})=>{
  await page.goto('/');
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
  await page.goto('/');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  await page.locator('#photo-input').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not a png')});
  await expect(page.locator('#plan-status')).toContainText('无法解码');
});

test('high quality page explains missing saved floorplan',async ({page})=>{
  await page.goto('/photoreal.html');
  await expect(page.locator('#overlay')).toContainText('尚无已保存户型图');
});

test('privacy clear action exists and requires confirmation',async ({page})=>{
  await page.goto('/');
  await expect(page.locator('#viewport canvas')).toBeVisible({timeout:22000});
  const button=page.getByRole('button',{name:'删除本机保存的户型与图片'});
  await expect(button).toBeVisible();
  page.once('dialog',async dialog=>{ expect(dialog.type()).toBe('confirm');await dialog.dismiss(); });
  await button.click();
  await expect(button).toBeVisible();
});
