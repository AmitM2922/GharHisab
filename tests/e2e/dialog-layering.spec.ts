import {test,expect} from '@playwright/test';

test('contribution modal covers transactions and navigation while the dashboard is scrolled',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});
  await page.goto('/');
  const add=page.locator('.contribution-add');
  await add.scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.recent').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  await add.click();
  const dialog=page.getByRole('dialog',{name:'Add contribution'});
  await expect(dialog).toBeVisible();
  const overlay=dialog.locator('..');
  await expect.poll(()=>overlay.boundingBox()).toEqual({x:0,y:0,width,height:844});
  const save=dialog.getByRole('button',{name:'Save record'});
  await expect(save).toBeVisible();
  await expect.poll(()=>save.evaluate(button=>{
   const rect=button.getBoundingClientRect();
   return button.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));
  })).toBe(true);
  expect(await overlay.evaluate(el=>{
   const points=[[8,innerHeight-8],[innerWidth-8,innerHeight-8],[innerWidth/2,innerHeight/2]];
   return points.every(([x,y])=>el.contains(document.elementFromPoint(x,y)));
  })).toBe(true);
  await expect(page.locator('body')).toHaveCSS('overflow','hidden');
  await dialog.getByRole('button',{name:'Close form',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
 }
});
