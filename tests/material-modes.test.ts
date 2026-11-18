import {test} from 'node:test';
import assert from 'node:assert/strict';
import {materialLines,isAmountOnly,materialTotals,amountOnlyUnit} from '../src/lib/materials';
import {seed} from '../src/data';
test('amount-only material mode survives a database-style snapshot without the UI flag',()=>{
 const expense={...seed[0],material:'Other',unit:amountOnlyUnit,quantity:1,rate:700,amount:700,items:[{material:'Other',unit:amountOnlyUnit,quantity:1,rate:700,amount:700}]};
 const line=materialLines(expense)[0];assert(isAmountOnly(line));assert.equal(line.amount,700);
 const summary=materialTotals([expense])[0];assert(summary.amountOnly);assert.equal(summary.quantity,0);assert.equal(summary.cost,700);
 assert(!isAmountOnly(materialLines(seed[0])[0]),'Existing quantified materials retain their quantities');
});
