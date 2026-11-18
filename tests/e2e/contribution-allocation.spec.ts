import {test,expect} from '@playwright/test';

test('automatic Amit share updates with expenses and other contributions, and matches reports',async({page})=>{
 await page.goto('/');
 const amit=page.locator('.contributor').filter({has:page.locator('strong',{hasText:'Amit Mulmule'})});
 await expect(amit.locator('.contributor-heading>b')).toHaveText('₹3,68,300');
 await expect(amit.getByText('Automatic',{exact:true})).toBeVisible();
 for(const [name,value,expected] of [['Government','39000','₹3,29,300'],['Sumit Mulmule','25000','₹3,04,300']]){
  await page.locator('.contribution-add').click();const dialog=page.getByRole('dialog',{name:'Add contribution'});
  await dialog.getByLabel('Contributor name').selectOption(name);await dialog.getByLabel('Amount contributed').fill(value);await dialog.getByRole('button',{name:'Save record'}).click();await expect(dialog).toHaveCount(0);
  await expect(amit.locator('.contributor-heading>b')).toHaveText(expected);
 }
 await expect(page.locator('.contribution-total strong')).toHaveText('₹6,18,300');
 await page.evaluate(()=>{location.hash='/reports'});await page.getByRole('combobox',{name:'Report type',exact:true}).selectOption('Contributions');
 const reportRow=page.locator('.report-scroll tbody tr').filter({hasText:'Amit Mulmule'});await expect(reportRow.locator('td').nth(1)).toHaveText('₹3,04,300');await expect(reportRow).toContainText('Automatic paid expense balance');
 await page.getByRole('combobox',{name:'Report type',exact:true}).selectOption('Contribution history');await expect(page.locator('.report-scroll tbody tr')).toHaveCount(6);
 await page.getByRole('button',{name:'Add expense',exact:true}).first().click();const expense=page.getByRole('dialog',{name:'Expense form'});await expense.getByLabel('Expense title').fill('Automatic share test expense');await expense.getByLabel('Expense type').selectOption('Other');await expense.getByLabel('Agreed total cost').fill('1000');await expense.getByLabel('Vendor / contractor').fill('Local test supplier');await expense.getByLabel('Initial amount paid').fill('400');await expense.getByRole('button',{name:'Save expense'}).click();await expect(expense).toHaveCount(0);
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Home'}).click();await expect(amit.locator('.contributor-heading>b')).toHaveText('₹3,04,700');await expect(page.locator('.contribution-total strong')).toHaveText('₹6,18,700');
});
