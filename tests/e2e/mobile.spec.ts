import {test,expect} from '@playwright/test';
test('layouts fit phones, tablet and desktop with usable navigation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,360,390,768,1440]){
 await page.setViewportSize({width,height:900});
 for(const route of ['/','/expenses','/materials','/contractors','/vendors','/reports','/project']){
 await page.goto('/#'+route);await expect(page.getByRole('heading',{level:1})).toBeVisible();
 if(route==='/')await expect(page.getByRole('heading',{name:'Recent transactions'})).toBeVisible();
 if(route==='/materials')await expect(page.getByRole('heading',{name:'Material usage history'})).toBeVisible();
 if(route==='/reports')await expect(page.getByRole('heading',{name:'Daily expenses'})).toBeVisible();
 const overflow=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth+1,elements:[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width>0).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));
 expect(overflow.fits,`${width}px ${route} overflows: ${JSON.stringify(overflow.elements)}`).toBe(true);
 }
 }
 expect(errors).toEqual([]);await page.setViewportSize({width:390,height:844});await page.goto('/');await page.screenshot({path:'test-results/mobile-overview.png',fullPage:true});
});
test('mobile expense, receipt, partial payment, contribution and viewer workflows',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Add expense',exact:true}).first().click();
 const form=page.getByRole('dialog',{name:'Expense form'});await form.getByLabel('Expense title').fill('Mobile test service');await form.getByLabel('Expense type').selectOption('Other');await form.getByLabel('Agreed total cost').fill('1000');await form.getByLabel('Vendor / contractor').fill('Mobile test vendor');await form.getByLabel('Initial amount paid').fill('400');
 await form.getByLabel('Upload receipt or payment screenshot').setInputFiles({name:'upi-proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
 await expect(form.getByText('upi-proof.png')).toBeVisible();await form.getByRole('button',{name:'Save expense'}).click();await expect(form).toHaveCount(0);
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Expenses'}).click();await page.getByRole('textbox',{name:'Search transactions'}).fill('Mobile test service');await page.getByRole('row',{name:'View Mobile test service'}).click();
 const details=page.getByRole('dialog',{name:'Transaction details'});await expect(details.getByRole('heading',{name:'Mobile test service'})).toBeVisible();await expect(details.getByAltText('Payment proof for Mobile test service')).toBeVisible();await expect(details.getByText('₹600',{exact:true})).toBeVisible();
 await details.getByRole('button',{name:'Record payment'}).click();const payment=page.getByRole('dialog',{name:'Record payment'});await payment.getByLabel('Amount paid (₹)').fill('600');await payment.getByRole('button',{name:'Save record'}).click();await expect(payment).toHaveCount(0);await expect(details.locator('.transaction-id .badge')).toHaveText('Paid');
 await details.getByRole('button',{name:'Edit expense'}).click();await expect(page.getByRole('dialog',{name:'Expense form'})).toBeVisible();await page.getByRole('dialog',{name:'Expense form'}).getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Home'}).click();await page.locator('.contribution-add').click();const contribution=page.getByRole('dialog',{name:'Add contribution'});await contribution.getByLabel('Contributor name').fill('Mobile contributor');await contribution.getByLabel('Amount contributed').fill('5000');await contribution.getByRole('button',{name:'Save record'}).click();await expect(page.locator('.contribution-people').getByText('Mobile contributor')).toBeVisible();
 await page.getByRole('button',{name:'Preview as viewer',exact:true}).click();await expect(page.getByRole('button',{name:'Add expense',exact:true})).toHaveCount(0);await expect(page.locator('.contribution-add')).toHaveCount(0);
});
test('pending cards filter records and viewers cannot see attachment controls',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'View pending dues records'}).click();await expect(page.getByLabel('Payment status')).toHaveValue('Pending dues');await expect(page.locator('tbody tr')).toHaveCount(4);
 await page.getByRole('button',{name:'Preview as viewer',exact:true}).click();await page.locator('tbody tr').first().click();const details=page.getByRole('dialog',{name:'Transaction details'});await expect(details.getByText('Private attachments',{exact:true})).toBeVisible();await expect(details.getByRole('button',{name:'Edit expense'})).toHaveCount(0);
});
