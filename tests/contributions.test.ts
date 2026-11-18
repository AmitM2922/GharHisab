import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contributionAllocation,automaticContributor} from '../src/lib/contributors';
import {totals} from '../src/lib/accounting';
import {seed} from '../src/data';
const expenses=(amount:number,paid=amount)=>[{...seed[0],amount,paid}];
const records=(entries:[string,number][])=>entries.map(([name,amount],i)=>({id:String(i),name,amount,date:'2026-11-18'}));

test('Amit automatically receives the remaining expense share from the user example',()=>{
 const result=contributionAllocation(expenses(100000),records([['Sumit Mulmule',25000],['Government',39000]]));
 assert.deepEqual(result.people.map(p=>[p.name,p.amount]),[['Amit Mulmule',36000],['Sumit Mulmule',25000],['Government',39000]]);
 assert.equal(result.allocated,100000);assert.equal(result.excess,0);assert(result.people[0].automatic);
 assert.equal(totals(expenses(100000,40000)).pending,60000,'An automatic expense allocation must not settle vendor dues');
});
test('expense changes and contribution changes recompute the residual without manual Amit double counting',()=>{
 const entries=records([['Amit',50000],['Amit Mulmule',40000],['Sumit',25000],['Goverment',39000]]);
 const result=contributionAllocation(expenses(100000),entries);assert.equal(result.people[0].amount,36000);assert.equal(result.historicalAmit,90000);
 assert.equal(contributionAllocation(expenses(110000),entries).people[0].amount,46000);
 assert.equal(contributionAllocation(expenses(100000),[...entries,...records([['Government',10000]])]).people[0].amount,26000);
 assert.equal(entries.length,4,'Source history is not mutated');
});
test('Amit stays non-negative; excess funding and historical contributors remain visible',()=>{
 const result=contributionAllocation(expenses(50000),records([['Sumit Mulmule',25000],['Government',39000]]));
 assert.equal(result.people[0].amount,0);assert.equal(result.excess,14000);assert.equal(result.allocated,64000);
 const zero=contributionAllocation([],[]);assert.equal(zero.people.length,3);assert.equal(zero.allocated,0);
 const legacy=contributionAllocation(expenses(100),records([['Other relative',30.1],['Sumit',20.2]]));
 assert.equal(legacy.people.find(p=>p.name===automaticContributor)!.amount,49.7);assert(legacy.people.some(p=>p.name==='Other relative'));
});

test('unpaid invoices and unpaid portions are excluded from automatic paid expense shares',()=>{
 const invoices=[...expenses(50000,30000),...expenses(10000,0),...expenses(5000,5000)];
 const result=contributionAllocation(invoices,records([['Sumit',10000]]));
 assert.equal(result.paid,35000);assert.equal(result.people[0].amount,25000);
 assert.equal(totals(invoices).pending,30000);
 const afterPayment=contributionAllocation(invoices.map((e,i)=>i===0?{...e,paid:50000}:e),records([['Sumit',10000]]));
 assert.equal(afterPayment.paid,55000);assert.equal(afterPayment.people[0].amount,45000);
 assert.equal(contributionAllocation(expenses(50000,0),[]).people[0].amount,0);
});
