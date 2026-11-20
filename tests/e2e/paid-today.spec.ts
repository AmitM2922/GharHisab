import {expect, test, type Page} from '@playwright/test';

const fixedTime = new Date('2026-11-20T08:00:00Z');
const paidToday = (page: Page) => page.getByRole('region', {name: 'Paid today'});
const total = (page: Page) => paidToday(page).locator('.paid-today-total');
const announcement = (page: Page) => paidToday(page).getByRole('status');

async function addInvoice(page: Page, title: string, amount: string, paid: string) {
 await page.getByRole('button', {name: 'Add expense', exact: true}).first().click();
 const form = page.getByRole('dialog', {name: 'Expense form'});
 await form.getByLabel('Expense title').fill(title);
 await form.getByLabel('Expense type').selectOption('Other');
 await form.getByLabel('Agreed total cost').fill(amount);
 await form.getByLabel('Vendor / contractor').fill('Today test supplier');
 await form.getByLabel('Initial amount paid').fill(paid);
 await form.getByRole('button', {name: 'Save expense'}).click();
 await expect(form).toHaveCount(0);
}

// Stage several data changes without React Query fetching until the next refresh.
async function stagePayments(page: Page, payments: {title: string; date: string; amount: number}[]) {
 return page.evaluate(async payments => {
  const url = '/src/services/demo.ts';
  const demo = await import(url) as typeof import('../../src/services/demo');
  for (const payment of payments) {
   const expense = demo.readDemo().expenses.find(expense => expense.title === payment.title);
   if (!expense) throw Error('Fixture invoice not found');
   await demo.saveDemoRecord('payments', {expense_id: expense.id, date: payment.date, amount: payment.amount, method: 'Cash'}, crypto.randomUUID());
  }
  return demo.readDemo().payments;
 }, payments);
}

test('paid today animates a single payment and one batch, opens every payment, and does not replay', async ({page}) => {
 await page.setViewportSize({width: 360, height: 820});
 await page.emulateMedia({reducedMotion: 'no-preference'});
 await page.clock.setFixedTime(fixedTime);
 await page.goto('/');
 const panel = paidToday(page);
 await expect(panel).toContainText('No payments today');
 await expect(total(page)).toHaveText('₹0');
 await expect(panel.locator('li')).toHaveCount(0);

 await addInvoice(page, 'Tile invoice', '500', '500');
 await expect(panel).toContainText('1 payment');
 await expect(total(page)).toHaveText('₹500');
 const tile = panel.getByRole('button', {name: /Tile invoice/});
 await expect(tile.locator('..')).toHaveCSS('animation-name', 'payment-arrival, payment-highlight');
 await expect(announcement(page)).toHaveText('1 new payment · ₹500 paid');
 await tile.click();
 const details = page.getByRole('dialog', {name: 'Transaction details'});
 await expect(details.getByRole('button', {name: 'Payments', exact: true})).toHaveAttribute('aria-pressed', 'true');
 await expect.poll(async () => (await details.boundingBox())?.y ?? 0).toBeGreaterThan(0);
 await details.getByRole('button', {name: 'Close transaction details'}).click();
 await expect(tile).toBeFocused();

 // This invoice is from an earlier day and is still only partly paid after the new payments.
 const title = 'First floor masonry work';
 const snapshot=await stagePayments(page, [100, 200, 300, 400].map(amount => ({title, date:'2026-11-20', amount})));
 const expected=snapshot.filter(p=>p.date==='2026-11-20').sort((a,b)=>
  Date.parse(b.created_at!)-Date.parse(a.created_at!)||a.id.localeCompare(b.id));
 await page.getByRole('button', {name: 'Refresh records'}).click();
 await expect(panel).toContainText('5 payments');
 await expect(total(page)).toHaveText('₹1,500');
 await expect(announcement(page)).toHaveText('4 new payments · ₹1,000 paid');
 await expect(panel.locator('li')).toHaveCount(3);
 const newRows=panel.locator('li[data-arriving]');
 await expect(panel.locator('li').nth(0)).toContainText('₹'+expected[0].amount);
 await expect(newRows.nth(1)).toHaveCSS('animation-delay', '0.045s');
 expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

 await panel.getByRole('link', {name: 'View all 5 payments'}).click();
 await expect(page.getByRole('list', {name: 'Active filters'})).toContainText('Paid today');
 await expect(page.locator('tbody tr')).toHaveCount(5);
 await expect(page.locator('tbody time')).toHaveText(Array(5).fill('20 Nov 2026'));
 await expect(page.locator('tbody td.right')).toHaveText(expected.map(p=>'₹'+p.amount));
 await page.getByRole('navigation', {name: 'Mobile navigation'}).getByRole('link', {name: 'Home'}).click();
 await expect(panel.locator('li[data-arriving]')).toHaveCount(0);
 await expect(announcement(page)).toBeEmpty();
 await page.getByRole('button', {name: 'Refresh records'}).click();
 await expect(total(page)).toHaveText('₹1,500');
 await expect(announcement(page)).toBeEmpty();

 await page.setViewportSize({width:1440,height:900});
 const latest = panel.locator('li button').first();
 await latest.click();
 await expect.poll(async () => {
  const box = await details.boundingBox();
  return box && {y:box.y,right:Math.round(box.x+box.width)};
 }).toEqual({y:0,right:1440});
 await page.keyboard.press('Escape');
 await expect(latest).toBeFocused();

 await page.clock.setFixedTime(new Date('2026-11-17T08:00:00Z'));
 await page.reload();
 await expect(total(page)).toHaveText('₹38,500');
 await expect(panel.locator('li[data-arriving]')).toHaveCount(0);
 await expect(announcement(page)).toBeEmpty();
});

test('reduced motion announces a save once and leaves edits, deletions and failed saves silent', async ({page}) => {
 await page.clock.setFixedTime(fixedTime);
 await page.goto('/');
 await addInvoice(page, 'Paint labour', '500', '100');
 const panel = paidToday(page);
 const row = panel.getByRole('button', {name: /Paint labour/});
 await expect(row.locator('..')).toHaveCSS('animation-name', 'none');
 await expect(announcement(page)).toHaveText('1 new payment · ₹100 paid');

 const details = page.getByRole('dialog', {name: 'Transaction details'});
 await row.click();
 await details.getByRole('button', {name: 'Correct payment'}).click();
 const correction = page.getByRole('dialog', {name: 'Correct payment'});
 await correction.getByLabel('Amount paid').fill('250');
 await correction.getByRole('button', {name: 'Save payment'}).click();
 await expect(correction).toHaveCount(0);
 await expect(total(page)).toHaveText('₹250');
 await expect(announcement(page)).toBeEmpty();
 await details.getByRole('button', {name: 'Correct payment'}).click();
 page.once('dialog', dialog => dialog.accept());
 await correction.getByRole('button', {name: 'Delete payment'}).click();
 await expect(correction).toHaveCount(0);
 await expect(panel).toContainText('No payments today');

 await details.getByRole('button', {name: 'Record payment'}).click();
 const editor = page.getByRole('dialog', {name: 'Record payment'});
 // Simulate another administrator committing an older payment while the editor is open.
 await stagePayments(page, [{title:'Paint labour',date:'2026-11-19',amount:400}]);
 await editor.getByLabel('Amount paid').fill('200');
 await editor.getByRole('button', {name:'Save payment'}).click();
 await expect(editor.getByRole('alert')).toHaveText('Payment exceeds the invoice amount');
 await expect(total(page)).toHaveText('₹0');
 await expect(announcement(page)).toBeEmpty();
 page.once('dialog', dialog => dialog.accept());
 await editor.getByRole('button', {name: 'Close payment form'}).click();
 await details.getByRole('button', {name: 'Close transaction details'}).click();
 await page.getByRole('button', {name: 'Refresh records'}).click();
 await expect(total(page)).toHaveText('₹0');
 await expect(announcement(page)).toBeEmpty();
});

test('a background refresh keeps keyboard focus on an older payment',async({page})=>{
 await page.clock.install({time:fixedTime});
 await page.setViewportSize({width:360,height:820});
 await page.goto('/');
 await addInvoice(page,'Focused payment','500','500');
 const trigger=paidToday(page).getByRole('button',{name:/Focused payment/});
 await trigger.focus();
 await page.clock.runFor(100);
 await stagePayments(page,[100,200,300,400].map(amount=>({title:'First floor masonry work',date:'2026-11-20',amount})));
 await page.clock.fastForward(60_500);
 await expect(total(page)).toHaveText('₹1,500');
 await expect(trigger).toBeFocused();
 await expect(paidToday(page).locator('li')).toHaveCount(3);
 await expect(announcement(page)).toHaveText('4 new payments · ₹1,000 paid');
 await page.keyboard.press('Tab');
 await expect(paidToday(page).getByRole('link',{name:'View all 5 payments'})).toBeFocused();
 await expect(trigger).toHaveCount(0);
});

test('paid today rolls over at midnight IST and checks the day when focus returns', async ({page}) => {
 const beforeMidnight = new Date('2026-11-17T18:29:50Z');
 await page.clock.install({time:new Date(beforeMidnight.getTime()-1000)});
 await page.clock.pauseAt(beforeMidnight);
 await page.goto('/');
 await page.clock.runFor(200);
 await expect(total(page)).toHaveText('₹38,500');
 await page.clock.fastForward(11_000);
 await expect(paidToday(page)).toContainText('No payments today');
 await expect(total(page)).toHaveText('₹0');
 await page.clock.setSystemTime(new Date('2026-11-17T18:29:50Z'));
 await page.evaluate(() => window.dispatchEvent(new Event('focus')));
 await expect(total(page)).toHaveText('₹38,500');
 await page.clock.setSystemTime(new Date('2026-11-18T20:00:00Z'));
 await page.evaluate(() => window.dispatchEvent(new Event('focus')));
 await expect(paidToday(page)).toContainText('No payments today');
 await expect(announcement(page)).toBeEmpty();
});
