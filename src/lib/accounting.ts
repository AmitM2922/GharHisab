import Decimal from 'decimal.js';
import {Expense} from '../data';
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function periodStart(range:string,now=today()){
 const first=now.slice(0,7)+'-01';
 if(range==='This month')return first;
 if(range==='Last 2 months'){const date=new Date(first+'T12:00:00Z');date.setUTCMonth(date.getUTCMonth()-1);return date.toISOString().slice(0,10)}
 return '';
}
export const roundMoney=(value:Decimal.Value)=>new Decimal(value).toDecimalPlaces(2,Decimal.ROUND_HALF_UP).toNumber();
export const purchaseAmount=(quantity:Decimal.Value,rate:Decimal.Value,roundToRupee=false)=>new Decimal(quantity).mul(rate).toDecimalPlaces(roundToRupee?0:2,Decimal.ROUND_HALF_UP).toNumber();
export function paymentProgress(amount:number,paid:number){
 if(amount<=0)return {pending:0,percentage:0,label:'No expenses yet'};
 const pending=roundMoney(new Decimal(amount).minus(paid));
 const percentage=amount?Math.min(new Decimal(paid).div(amount).mul(100).toNumber(),100):0;
 return {pending,percentage:pending>0?Math.min(percentage,99):percentage,label:pending<=0?'100% paid':percentage>=99.5?'Almost paid':`${Math.round(percentage)}% paid`};
}
export const sumMoney=(items:number[])=>items.reduce((s,n)=>s.add(n),new Decimal(0)).toDecimalPlaces(2).toNumber();
export const totals=(expenses:Expense[])=>{const incurred=sumMoney(expenses.map(e=>e.amount)),paid=sumMoney(expenses.map(e=>e.paid));return {incurred,paid,pending:roundMoney(new Decimal(incurred).minus(paid))}};
export function csvCell(value:unknown){let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
export function downloadCsv(name:string,rows:unknown[][]){const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
