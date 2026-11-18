import {Expense,MaterialLine} from '../data';
import {sumMoney} from './accounting';
export const amountOnlyUnit='lump sum';
export const isAmountOnly=(line:{unit?:string;amountOnly?:boolean})=>line.amountOnly===true||line.unit===amountOnlyUnit;
export function materialLines(e:Expense):MaterialLine[]{
 if(e.category!=='Materials')return [];
 const items=e.items?.length?e.items:[{materialId:e.materialId,material:e.material,quantity:e.quantity,unit:e.unit,rate:e.rate,amount:e.amount,roundToRupee:false}];
 return items.map(item=>({...item,amountOnly:isAmountOnly(item)}));
}
export function materialPurchases(expenses:Expense[]){return expenses.flatMap(e=>materialLines(e).map(line=>({...line,expenseId:e.id,date:e.date,vendor:e.vendor})))}
export function materialTotals(expenses:Expense[]){
 return Object.values(materialPurchases(expenses).reduce((totals,line)=>{const key=line.material.toLowerCase()+'|'+line.unit;const row=totals[key]||{name:line.material,unit:line.unit,quantity:0,cost:0,amountOnly:isAmountOnly(line)};if(!row.amountOnly)row.quantity=Math.round((row.quantity+line.quantity)*1000)/1000;row.cost=sumMoney([row.cost,line.amount]);totals[key]=row;return totals},{} as Record<string,{name:string;unit:string;quantity:number;cost:number;amountOnly:boolean}>)).sort((a,b)=>b.cost-a.cost);
}
