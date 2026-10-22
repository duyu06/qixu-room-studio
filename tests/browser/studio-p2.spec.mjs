import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function ready(page){
  await page.goto('/studio.html');
  await expect(page.locator('#plan-svg')).toBeVisible();
  await expect(page.locator('[data-wall-id]')).toHaveCount(5);
}
test('automatically computes adjacent enclosed rooms and areas',async({page})=>{
  await ready(page);
  await expect(page.locator('#studio-room-summary')).toContainText('2 个闭合空间');
  await expect(page.locator('#studio-room-summary')).toContainText('68.00');
  await expect(page.locator('text.room-label')).toHaveCount(2);
  await page.locator('#show-measures').uncheck();
  await expect(page.locator('text.wall-label')).toHaveCount(0);
  await page.locator('#show-measures').check();
  await expect(page.locator('text.wall-label')).toHaveCount(5);
});
test('downloads engineer-readable quantities and meters-based DXF',async({page})=>{
  await ready(page);
  const csvWait=page.waitForEvent('download');
  await page.locator('#export-bom').click();
  const csv=await csvWait;
  const data=readFileSync(await csv.path(),'utf8');
  expect(data).toContain('68');
  expect(data).toContain('净面积');
  const dxfWait=page.waitForEvent('download');
  await page.locator('#export-dxf').click();
  const dxf=await dxfWait;
  const bytes=readFileSync(await dxf.path(),'utf8');
  expect(bytes).toContain('$INSUNITS');
  expect(bytes).toContain('QIXU_WALLS');
  await page.locator('#file-dxf').setInputFiles({name:'qixu-plan.dxf',mimeType:'text/plain',buffer:Buffer.from(bytes)});
  await expect(page.locator('#toast')).toContainText('已导入');
  await expect(page.locator('[data-wall-id]')).toHaveCount(5);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')));
  expect(saved.walls).toHaveLength(5);
});
test('smart layout adds movable catalog models inside closed rooms',async({page})=>{
  await ready(page);
  await page.locator('#smart-layout').click();
  await expect(page.locator('#toast')).toContainText('规则布局');
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')));
  expect(data.furniture.length).toBeGreaterThan(0);
  await page.locator('[data-panel="library"]').click();
  await expect(page.locator('[data-furniture-id]')).toHaveCount(data.furniture.length);
  await page.locator('#undo').click();
  await expect(page.locator('[data-furniture-id]')).toHaveCount(0);
});
test('selected wall endpoint can be moved, persisted and undone',async({page})=>{
  await ready(page);
  await page.evaluate(()=>{
    const svg=document.querySelector('#plan-svg'),line=svg.querySelector('[data-wall-id]');
    const pos=new DOMPoint(-4.6,-3.4).matrixTransform(svg.getScreenCTM());
    line.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:pos.x,clientY:pos.y,pointerId:2}));
  });
  const handle=page.locator('[data-endpoint-wall]').first();
  await expect(handle).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')).walls[0].a);
  const outcome=await page.evaluate(()=>{
    const svg=document.querySelector('#plan-svg'),handle=svg.querySelector('[data-endpoint-wall]');
    const old=new DOMPoint(Number(handle.getAttribute('cx')),Number(handle.getAttribute('cy')));
    const start=old.matrixTransform(svg.getScreenCTM());
    const finish=new DOMPoint(old.x+.7,old.y+.35).matrixTransform(svg.getScreenCTM());
    handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:12,clientX:start.x,clientY:start.y}));
    svg.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,button:0,pointerId:12,clientX:finish.x,clientY:finish.y}));
    svg.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:12,clientX:finish.x,clientY:finish.y}));
    return JSON.parse(localStorage.getItem('qixu-studio-v1')).walls[0].a;
  });
  expect(outcome).not.toEqual(before);
  await page.locator('#undo').click();
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-v1')).walls[0].a);
  expect(restored).toEqual(before);
});
test('non-DXF file leaves project unchanged',async({page})=>{
  await ready(page);
  const before=await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'));
  await page.locator('#file-dxf').setInputFiles({
    name:'invalid.dxf',mimeType:'text/plain',buffer:Buffer.from('not a drawing')
  });
  await expect(page.locator('#toast')).toContainText('导入失败');
  expect(await page.evaluate(()=>localStorage.getItem('qixu-studio-v1'))).toBe(before);
});


test('first person walkthrough persists during W key and exits on Escape',async({page})=>{
 await ready(page);
 await page.locator('#tour-toggle').click();
 await expect(page.locator('#three-viewport canvas')).toBeVisible({timeout:25000});
 await expect(page.locator('#tour-toggle')).toHaveClass(/active/);
 await page.keyboard.down('w');
 await page.waitForTimeout(300);
 await page.keyboard.up('w');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await expect(page.locator('#tour-toggle')).toHaveClass(/active/);
 await page.keyboard.press('Escape');
 await expect(page.locator('#tour-toggle')).not.toHaveClass(/active/);
});
test('new Studio project is recognized by WebGPU preview with no legacy upload',async({page})=>{
 await ready(page);
 await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{configurable:true,value:undefined}));
 await page.goto('/photoreal.html');
 await expect(page.locator('#overlay')).toContainText('没有启用 WebGPU');
 await expect(page.locator('#overlay')).not.toContainText('尚无已保存户型');
});
