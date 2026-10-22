import {test,expect} from '@playwright/test';
const fixture=async page=>page.evaluate(()=>{
 const c=document.createElement('canvas');c.width=540;c.height=600;
 const g=c.getContext('2d');g.fillStyle='#fff8ed';g.fillRect(0,0,540,600);
 g.strokeStyle='#252525';g.lineWidth=10;g.strokeRect(35,30,470,540);
 g.beginPath();g.moveTo(260,30);g.lineTo(260,270);g.stroke();
 return c.toDataURL('image/png').split(',')[1];
});
async function startPlan(page){
 await page.goto('/');
 await expect(page.locator('#viewport canvas')).toBeVisible({timeout:23000});
 const image=await fixture(page);
 await page.locator('#photo-input').setInputFiles({name:'qa-plan.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await expect(page.locator('#plan-status')).toContainText('墙体',{timeout:20000});
}
test('@desktop 3D and wall-mode functionality',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await startPlan(page);
 await expect(page.getByRole('button',{name:'定位进风门'})).toBeVisible();
 await expect(page.locator('#v7-flow-choices')).toHaveCount(0);
 for(const name of ['真实立面','轻透墙','暖白剖切'])await page.getByRole('button',{name}).click();
 await expect(page.getByRole('button',{name:'暖白剖切'})).toHaveClass(/active/);
 await testInfo.attach('desktop.png',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 expect(errors).toEqual([]);
});
test('@mobile 390px viewport renders tools without horizontal overflow',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 await startPlan(page);
 await expect(page.locator('#qixu-known-length')).toBeVisible();
 await expect(page.getByRole('button',{name:'重算气流'})).toBeVisible();
 const widths=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 await testInfo.attach('mobile.png',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 expect(widths[0],JSON.stringify(widths)).toBeLessThanOrEqual(widths[1]+2);
});
test('@data broken project image preserves previous project',async({page})=>{
 await startPlan(page);
 const old=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-blueprint-v6')));
 const broken={schema:'qixu-blueprint',version:1,plan:old.plan,image:'data:image/jpeg;base64,aGVsbG8='};
 await page.locator('.qixu-project-actions input[type="file"]').setInputFiles({
 name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});
 await expect(page.locator('#plan-status')).toContainText('图片无法解码',{timeout:14000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-blueprint-v6')));
 expect(saved).toEqual(old);
});
test('@data corrupt local backup gives safe recovery on WebGPU page',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>localStorage.setItem('qixu-blueprint-v6','{broken'));
 await page.goto('/photoreal.html');
 await expect(page.locator('#overlay')).toContainText('损坏');
 await expect(page.getByRole('link',{name:/返回实时/})).toBeVisible();
});
test('@science pressure model and local SunCalc update on controls',async({page})=>{
 await startPlan(page);
 await expect(page.locator('#v8-solver-info')).toContainText('二维势流场已计算',{timeout:20000});
 await expect(page.locator('#v8-sun-status')).toContainText('太阳高度',{timeout:18000});
 await page.locator('#v8-lat').fill('31.2');
 await page.locator('#v8-lon').fill('121.5');
 await page.getByRole('button',{name:'计算实际太阳方位'}).click();
 await expect(page.locator('#v8-sun-status')).toContainText('真北方位');
 await page.getByRole('button',{name:'定位进风门'}).click();
 await expect(page.locator('#v8-solver-info')).toContainText('点击门洞中心');
});
