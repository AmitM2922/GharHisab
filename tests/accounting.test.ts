import {test} from 'node:test';
import assert from 'node:assert/strict';
import {purchaseAmount,sumMoney,periodStart,csvCell,totals} from '../src/lib/accounting';
import {seed} from '../src/data';
test('decimal calculations, sample ledger and reporting safety',()=>{
 assert.equal(purchaseAmount('0.3','0.5'),.15);assert.equal(purchaseAmount('1','1.005'),1.01);assert.equal(sumMoney([.1,.2]),.3);
 assert.deepEqual(totals(seed),{incurred:667600,paid:618300,pending:49300});
 assert.equal(periodStart('Last 2 months','2027-01-17'),'2026-12-01');assert.equal(periodStart('This month','2026-11-17'),'2026-11-01');
 assert.equal(csvCell('=WEBSERVICE("bad")'),'"\'=WEBSERVICE(""bad"")"');assert.equal(csvCell('Sand, steel'),'"Sand, steel"');
});
