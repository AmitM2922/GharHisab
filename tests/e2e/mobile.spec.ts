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
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Home'}).click();await page.locator('.contribution-add').click();const contribution=page.getByRole('dialog',{name:'Add contribution'});await expect(contribution.getByLabel('Contributor name').locator('option')).toHaveText(['Select…','Amit Mulmule','Sumit Mulmule','Government']);await contribution.getByLabel('Contributor name').selectOption('Government');await contribution.getByLabel('Amount contributed').fill('5000');await contribution.getByRole('button',{name:'Save record'}).click();await expect(page.locator('.contribution-people').getByText('Government',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Preview as viewer',exact:true}).click();await expect(page.getByRole('button',{name:'Add expense',exact:true})).toHaveCount(0);await expect(page.locator('.contribution-add')).toHaveCount(0);
});
test('pending cards filter records and viewers cannot see attachment controls',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'View pending dues records'}).click();await expect(page.getByLabel('Payment status')).toHaveValue('Pending dues');await expect(page.locator('tbody tr')).toHaveCount(4);
 await page.getByRole('button',{name:'Preview as viewer',exact:true}).click();await page.locator('tbody tr').first().click();const details=page.getByRole('dialog',{name:'Transaction details'});await expect(details.getByText('Private attachments',{exact:true})).toBeVisible();await expect(details.getByRole('button',{name:'Edit expense'})).toHaveCount(0);
});
test('multiple materials and manual entry remain one invoice with correct stock and mobile vendor',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/');
 await expect(page.locator('.recent .mobile-vendor-name').first()).toBeVisible();await expect(page.locator('.recent .mobile-vendor-name').first()).toContainText('Sharma Building Supply');
 await page.getByRole('button',{name:'Add expense',exact:true}).first().click();const form=page.getByRole('dialog',{name:'Expense form'});
 await form.getByLabel('Expense title').fill('Mixed material delivery');await form.getByRole('button',{name:'Choose materials'}).click();await form.getByRole('checkbox',{name:'Cement',exact:true}).check();await form.getByRole('checkbox',{name:'Steel',exact:true}).check();await form.getByRole('button',{name:'Done selecting'}).click();
 await form.getByLabel('Cement quantity',{exact:true}).fill('10');await form.getByLabel('Cement rate per unit').fill('400');await form.getByLabel('Steel quantity',{exact:true}).fill('50');await form.getByLabel('Steel rate per unit').fill('60');
 await form.getByRole('button',{name:'Other / enter a material manually'}).click();await form.getByLabel('Custom material name').fill('Waterproofing compound');await form.getByRole('button',{name:'Add material',exact:true}).click();
 await form.getByLabel('Waterproofing compound quantity',{exact:true}).fill('2');await form.getByLabel('Waterproofing compound unit',{exact:true}).selectOption('litres');await form.getByLabel('Waterproofing compound rate per unit').fill('350');
 await form.getByLabel('Vendor / contractor').fill('Mixed delivery supplier');await form.getByLabel('Initial amount paid').fill('2000');await expect(form.locator('.calculated strong')).toHaveText('₹7,700');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await form.getByRole('button',{name:'Save expense'}).click();await expect(form).toHaveCount(0);await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Expenses'}).click();await page.getByLabel('Search transactions').fill('Mixed material delivery');await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('.mobile-vendor-name').filter({hasText:'Mixed delivery supplier'})).toBeVisible();await page.getByRole('row',{name:'View Mixed material delivery'}).click();
 const details=page.getByRole('dialog',{name:'Transaction details'});await expect(details.locator('.invoice-material-row')).toHaveCount(3);await expect(details.locator('.transaction-amount h3')).toHaveText('₹7,700');await expect(details.locator('.payment-duo strong').last()).toHaveText('₹5,700');await details.getByRole('button',{name:'Edit expense'}).click();await expect(form.getByLabel('Cement quantity',{exact:true})).toHaveValue('10');await expect(form.getByLabel('Waterproofing compound rate per unit')).toHaveValue('350');await form.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Materials',exact:true}).click();const inventory=page.locator('.inventory').filter({has:page.getByRole('heading',{name:'Waterproofing compound',exact:true})});await expect(inventory.locator('.stock-number')).toContainText('2');await expect(inventory).toContainText('₹700');
});
test('whole-rupee totals settle correctly and exact paise balances never show 100% paid',async({page})=>{
 for(const rounded of [true,false]){
  await page.goto('/');await page.getByRole('button',{name:'Add expense',exact:true}).first().click();
  const form=page.getByRole('dialog',{name:'Expense form'});const title=rounded?'Rounded steel cost':'Exact steel cost';
  await form.getByLabel('Expense title').fill(title);await form.getByRole('button',{name:'Choose materials'}).click();await form.getByRole('checkbox',{name:'Steel',exact:true}).check();await form.getByRole('button',{name:'Done selecting'}).click();
  await form.getByLabel('Steel quantity',{exact:true}).fill('1.5');await form.getByLabel('Steel rate per unit').fill('6526.67');await expect(form.getByRole('checkbox',{name:'Steel round total to whole rupees'})).toBeChecked();
  if(!rounded)await form.getByRole('checkbox',{name:'Steel round total to whole rupees'}).uncheck();
  await expect(form.locator('.calculated strong')).toHaveText(rounded?'₹9,790':'₹9,790.01');await form.getByLabel('Vendor / contractor').fill('Steel rounding supplier');await form.getByLabel('Initial amount paid').fill('9790');await form.getByRole('button',{name:'Save expense'}).click();await expect(form).toHaveCount(0);
  await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Expenses'}).click();await page.getByLabel('Search transactions').fill(title);await page.getByRole('row',{name:`View ${title}`}).click();
  const details=page.getByRole('dialog',{name:'Transaction details'});await expect(details.locator('.transaction-id .badge')).toHaveText(rounded?'Paid':'Partially paid');await expect(details.locator('.payment-duo strong').last()).toHaveText(rounded?'₹0':'₹0.01');await expect(details.locator('.payment-breakdown .detail-section-title>span')).toHaveText(rounded?'100% paid':'Almost paid');
  await details.getByRole('button',{name:'Close transaction details'}).click();
 }
});
