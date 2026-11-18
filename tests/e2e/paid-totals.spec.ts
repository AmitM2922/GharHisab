import {test,expect} from '@playwright/test';
import {seed,money} from '../../src/data';
import {totals,sumMoney} from '../../src/lib/accounting';

test('expense totals count actual payments and exclude all unpaid balances without changing invoice values',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const base=totals(seed),otherBase=sumMoney(seed.filter(e=>e.category==='Other').map(e=>e.paid));
 const total=page.getByRole('button',{name:'View total expenses records',exact:true}).locator('h2');
 const other=page.getByRole('button',{name:'View other expenses records',exact:true}).locator('h2');
 const pending=page.getByRole('button',{name:'View pending dues records',exact:true}).locator('h2');
 await expect(total).toHaveText(money(base.paid));await expect(page.locator('.donut-center strong')).toHaveText(money(base.paid));
 for(const [title,amount,paid] of [['Unpaid invoice test','10000','0'],['Partial invoice test','50000','30000']]){
  await page.getByRole('button',{name:'Add expense',exact:true}).first().click();const form=page.getByRole('dialog',{name:'Expense form'});
  await form.getByLabel('Expense title').fill(title);await form.getByLabel('Expense type').selectOption('Other');await form.getByLabel('Agreed total cost').fill(amount);await form.getByLabel('Vendor / contractor').fill('Paid total supplier');await form.getByLabel('Initial amount paid').fill(paid);await form.getByRole('button',{name:'Save expense'}).click();await expect(form).toHaveCount(0);
 }
 await expect(total).toHaveText(money(sumMoney([base.paid,30000])));await expect(other).toHaveText(money(sumMoney([otherBase,30000])));await expect(pending).toHaveText(money(sumMoney([base.pending,30000])));await expect(page.locator('.donut-center strong')).toHaveText(money(sumMoney([base.paid,30000])));
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Expenses'}).click();await expect(page.locator('.summary-row>div').nth(0)).toContainText(money(sumMoney([base.paid,30000])));await expect(page.locator('.summary-row>div').nth(1)).toContainText(money(sumMoney([base.incurred,60000])));
 await page.getByLabel('Search transactions').fill('Partial invoice test');await expect(page.locator('tbody tr')).toHaveCount(1);await page.getByRole('row',{name:'View Partial invoice test'}).click();const details=page.getByRole('dialog',{name:'Transaction details'});await expect(details.locator('.transaction-amount h3')).toHaveText('₹50,000');
 await details.getByRole('button',{name:'Record payment',exact:true}).click();const payment=page.getByRole('dialog',{name:'Record payment',exact:true});await payment.getByLabel('Amount paid (₹)').fill('20000');await payment.getByRole('button',{name:'Save payment'}).click();await expect(payment).toHaveCount(0);await expect(details.locator('.transaction-id .badge')).toHaveText('Paid');await expect(details.locator('.transaction-amount h3')).toHaveText('₹50,000');await expect(details.locator('.payment-history-row')).toHaveCount(2);await details.getByRole('button',{name:'Close transaction details'}).click();await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Home'}).click();await expect(total).toHaveText(money(sumMoney([base.paid,50000])));await expect(pending).toHaveText(money(sumMoney([base.pending,10000])));await expect(page.locator('.donut-center strong')).toHaveText(money(sumMoney([base.paid,50000])));await expect(page.locator('.contribution-total strong')).toHaveText(money(sumMoney([base.paid,50000])));
 await page.getByRole('button',{name:'Preview as viewer',exact:true}).click();await expect(total).toHaveText(money(sumMoney([base.paid,50000])));
});
