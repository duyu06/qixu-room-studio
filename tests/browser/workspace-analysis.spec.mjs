import {test,expect} from '@playwright/test';
test('single workspace supports editing, cultural analysis and render without navigation',async({page})=>{
 await page.goto('/studio.html?template=sunlit&view=3d');
 await expect(page.locator('#three-viewport canvas')).toBeVisible();
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('.qixu-direction-insights')).toBeVisible();
 await expect(page.locator('.qixu-compass-grid button')).toHaveCount(8);
 await page.getByRole('button',{name:/东南/}).click();
 await expect(page.locator('.qixu-direction-insights')).toContainText('通透');
 await expect(page).toHaveURL(/studio.html/);
 await page.locator('[data-panel="render"]').click();
 await expect(page.locator('#integrated-preview')).toBeVisible();
 await expect(page).toHaveURL(/studio.html/);
 await page.locator('[data-panel="library"]').click();
 await expect(page.locator('#integrated-preview')).toBeHidden();
 await expect(page.locator('#furniture-library')).toBeVisible();
});
test('mobile integrated cultural insights are reachable without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/studio.html?template=compact');
 await page.locator('[data-panel="analysis"]').click();
 await expect(page.locator('.qixu-compass-grid button')).toHaveCount(8);
 const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 expect(sizes[0]).toBeLessThanOrEqual(sizes[1]+2);
});