import type {Contribution} from '../types';
import type {Expense} from '../data';
import {sumMoney} from './accounting';

export const contributorNames=['Amit Mulmule','Sumit Mulmule','Government'];
export const automaticContributor=contributorNames[0];
export const manualContributorNames=contributorNames.slice(1);

export function contributorName(name:string){
 const trimmed=name.trim().replace(/\s+/g,' '),key=trimmed.toLowerCase();
 if(['amit','amit mulmule'].includes(key))return automaticContributor;
 if(['sumit','sumit mulmule'].includes(key))return contributorNames[1];
 if(['government','goverment','govt','govt.'].includes(key))return contributorNames[2];
 return trimmed;
}

// Allocate actual paid expenses. An allocation never creates a vendor payment.
// Historical Amit entries remain in storage/history but must not be counted twice.
export function contributionAllocation(expenses:Expense[],records:Contribution[]){
 const paid=sumMoney(expenses.map(e=>e.paid));
 const amounts=new Map<string,number>();let historicalAmit=0;
 for(const record of records){
  const name=contributorName(record.name);
  if(name===automaticContributor){historicalAmit=sumMoney([historicalAmit,record.amount]);continue}
  amounts.set(name,sumMoney([amounts.get(name)||0,record.amount]));
 }
 const others=sumMoney([...amounts.values()]);
 const remainder=sumMoney([paid,-others]);
 const names=[...manualContributorNames,...[...amounts.keys()].filter(name=>!manualContributorNames.includes(name))];
 const people=[{name:automaticContributor,amount:Math.max(0,remainder),automatic:true},...names.map(name=>({name,amount:amounts.get(name)||0,automatic:false}))];
 return {people,paid,others,historicalAmit,excess:Math.max(0,-remainder),allocated:sumMoney(people.map(p=>p.amount))};
}
