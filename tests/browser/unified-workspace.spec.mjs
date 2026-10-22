import {test,expect} from '@playwright/test';
test('all Studio functions use one address and one project context',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('[data-panel="structure"]')).toBeVisible();
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('#studio-analysis-result')).toContainText('门洞 / 窗洞');
 await expect(page).toHaveURL(/studio.html\?template=sunlit/);
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#integrated-preview')).toBeVisible();
 await expect(page.locator('#integrated-render-frame')).toHaveAttribute('src','./photoreal.html?template=sunlit');
 await expect(page).toHaveURL(/studio.html\?template=sunlit/);
 await page.locator('[data-panel="library"]').click();
 await expect(page.locator('#integrated-preview')).toBeHidden();
 await expect(page.locator('#furniture-library')).toBeVisible();
 const p=await page.evaluate(()=>JSON.parse(localStorage.getItem('qixu-studio-demo-sunlit-v1')));
 expect(p.openings.length).toBeGreaterThan(0);
});
test('single workspace in mobile viewport remains reachable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/studio.html');
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('#studio-analysis-result')).toBeVisible();
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#integrated-preview')).toBeVisible();
 await page.locator('#render-return').click();
 await expect(page.locator('#integrated-preview')).toBeHidden();
});
