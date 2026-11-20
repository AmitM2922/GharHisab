import {Search,ChevronDown,Download} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import type {Expense} from '../data';
import {money} from '../data';
import type {Payment} from '../types';
import {dateRanges,downloadCsv,inPeriod,paymentProgress,sumMoney,totals} from '../lib/accounting';
import {displayDate,paymentMethods} from '../lib/history-filters';
import {isAmountOnly,materialLines} from '../lib/materials';
import {visiblePaymentProofs} from '../lib/payment-images';
import {latestPayment,type PaymentEntry} from '../lib/payment-ledger';
import ExpenseTable from '../components/ExpenseTable';

const statuses=['All statuses','Pending dues','Paid','Partially paid','Unpaid'];
const sorts=['Newest first','Oldest first','Highest amount'];
const categories=['Materials','Contractor costs','Other'];
const pageSize=8;
function dateValue(value:string|null){
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value)))return '';
 return new Date(value).toISOString().slice(0,10)===value?value:'';
}

type Props={
 expenses:Expense[];
 entries:PaymentEntry[];
 day:string;
 contractor:boolean;
 demo:boolean;
 admin:boolean;
 error:Error|null;
 open:(expense:Expense,paymentId?:string)=>void;
 refresh:()=>Promise<void>;
 notify:(message:string)=>void;
};

export function exportExpenseCsv(expenses:Expense[],demo:boolean){
 downloadCsv('gharhisab-'+(demo?'demo-':'')+'expenses',[
  ['ID','Date','Title','Category','Material','Quantity','Unit','Rate INR','Vendor','Invoice value INR','Paid INR','Pending dues INR','Description','Material lines'],
  ...expenses.map(expense=>{
   const lines=materialLines(expense);
   const itemDetails=lines.map(line=>isAmountOnly(line)?`${line.material}: ${line.amount} (amount only)`:
    `${line.material}: ${line.quantity} ${line.unit} × ${line.rate} = ${line.amount}`).join('; ');
   const hasBreakdown=lines.length>1||lines.some(isAmountOnly);
   return [expense.id,expense.date,expense.title,expense.category,expense.material,hasBreakdown?'':expense.quantity,
    expense.unit,hasBreakdown?'':expense.rate,expense.vendor,expense.amount,expense.paid,
    sumMoney([expense.amount,-expense.paid]),expense.description,itemDetails];
  }),
 ]);
}

function matchesStatus(expense:Expense,status:string){
 if(status==='Pending dues')return expense.paid<expense.amount;
 if(status==='Paid')return expense.paid>=expense.amount;
 if(status==='Partially paid')return expense.paid>0&&expense.paid<expense.amount;
 if(status==='Unpaid')return expense.paid===0;
 return true;
}

function FilterSelect({label,value,change,options}:{label:string;value:string;change:(value:string)=>void;options:readonly string[]}){
 return <label className="history-filter-field">
  <span>{label}</span>
  <span className="history-select"><select value={value} onChange={event=>change(event.target.value)}>
   {options.map(option=><option key={option}>{option}</option>)}
  </select><ChevronDown size={15} aria-hidden="true"/></span>
 </label>;
}

export default function LedgerHistory({expenses,entries,day,contractor,demo,admin,error,open,refresh,notify}:Props){
 const [params,setParams]=useSearchParams();
 const mode=contractor?null:params.get('payments');
 const showToday=mode==='today';
 const showPayments=showToday||mode==='completed';
 const query=params.get('q')??'';
 const category=categories.find(option=>option===params.get('category'))??'';
 const method=paymentMethods.find(option=>option===params.get('method'))??'';
 const status=statuses.find(option=>option===params.get('status'))??statuses[0];
 const sort=sorts.find(option=>option===params.get('sort'))??sorts[0];
 const range=dateRanges.find(option=>option===params.get('range'))??dateRanges[0];
 const dateFrom=dateValue(params.get('from'));
 const dateTo=dateValue(params.get('to'));
 const term=query.trim().toLowerCase();
 const applyPeriod=inPeriod(range,day);
 const scopedExpenses=contractor?expenses.filter(expense=>expense.category==='Contractor costs'):expenses;

 function changeFilter(key:string,value:string,defaultValue='',replace=false){
  setParams(previous=>{
   const next=new URLSearchParams(previous);
   if(value===defaultValue)next.delete(key);
   else next.set(key,value);
   if(key!=='page')next.delete('page');
   if(key==='payments'){
    next.delete('status');
    if(value==='today'){
     next.delete('range');
     next.delete('from');
     next.delete('to');
    }
   }
   return next;
  },{replace});
 }

 const matchesExpense=(expense:Expense)=>
  (!category||expense.category===category)&&
  (!term||`${expense.title} ${expense.vendor} ${expense.id} ${expense.description??''} ${expense.material}`.toLowerCase().includes(term));
 const matchesDate=(date:string)=>showToday?date===day:applyPeriod(date)&&(!dateFrom||date>=dateFrom)&&(!dateTo||date<=dateTo);
 const filteredInvoices=scopedExpenses.filter(expense=>
  matchesExpense(expense)&&matchesDate(expense.date)&&matchesStatus(expense,status)&&(!method||expense.method===method))
  .sort((a,b)=>sort==='Highest amount'?b.amount-a.amount||b.date.localeCompare(a.date):
   sort==='Oldest first'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
 const unfilteredPayments=showToday?entries.filter(({payment})=>payment.date===day):entries;
 const filteredPayments=showPayments?unfilteredPayments.filter(({expense,payment})=>
  matchesExpense(expense)&&matchesDate(payment.date)&&(!method||payment.method===method))
  .sort((a,b)=>sort==='Highest amount'?b.payment.amount-a.payment.amount||latestPayment(a,b):
   sort==='Oldest first'?latestPayment(b,a):latestPayment(a,b)):[];
 const rows:{expense:Expense;payment?:Payment}[]=showPayments?filteredPayments:filteredInvoices.map(expense=>({expense}));
 const paymentStats=new Map<string,{count:number;images:number}>();
 if(!showPayments)for(const {expense,payment} of entries){
  const stats=paymentStats.get(expense.id)??{count:0,images:0};
  stats.count+=1;
  stats.images+=visiblePaymentProofs(payment.proofs,admin).length;
  paymentStats.set(expense.id,stats);
 }
 const {incurred,paid,pending}=totals(filteredInvoices);
 const progress=paymentProgress(incurred,paid);
 const totalPaid=showPayments?sumMoney(filteredPayments.map(({payment})=>payment.amount)):paid;
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
 const requestedPage=Number(params.get('page'));
 const page=Number.isSafeInteger(requestedPage)?Math.max(1,Math.min(requestedPage,totalPages)):1;
 const pageRows=rows.slice((page-1)*pageSize,page*pageSize).map(row=>{
  const stats=paymentStats.get(row.expense.id);
  return {...row,paymentCount:stats?.count??0,imageCount:row.payment?visiblePaymentProofs(row.payment.proofs,admin).length:stats?.images??0};
 });
 const activeFilters=[
  showToday&&'Paid today · '+displayDate(day),
  !showToday&&range!=='All time'&&range,
  term&&'Search: '+query.trim(),
  category,method,
  !showPayments&&status!==statuses[0]&&status,
  !showToday&&dateFrom&&'From '+displayDate(dateFrom),
  !showToday&&dateTo&&'To '+displayDate(dateTo),
 ].filter(Boolean);
 const hasData=showPayments?unfilteredPayments.length>0:scopedExpenses.length>0;
 const clear=()=>setParams({});
 const recordType=showToday?'Today’s payments':showPayments?'Completed payments':'Invoices';
 const exportCsv=()=>{
  if(showPayments){
   downloadCsv(showToday?'gharhisab-payments-'+day:'gharhisab-payments',[
    ['Payment ID','Payment date','Expense','Payee','Payment method','Amount paid INR'],
    ...filteredPayments.map(({payment,expense})=>[payment.id,payment.date,expense.title,expense.vendor,payment.method,payment.amount]),
   ]);
  }else exportExpenseCsv(filteredInvoices,demo);
  notify('Report downloaded');
 };

 return <>
  <div className="summary-row history-summary">
   <div><small>Amount paid in view</small><strong className="green-text">{money(totalPaid)}</strong></div>
   {!showPayments&&<>
    <div><small>Invoice value</small><strong>{money(incurred)}</strong></div>
    <div><small>Pending payments</small><strong className="amber-text">{money(pending)}</strong></div>
   </>}
   <div className="history-exports">
    <button className="btn" onClick={exportCsv}><Download size={16}/>Export CSV</button>
    <button className="btn" onClick={()=>window.print()}>Print report</button>
   </div>
   {!showPayments&&incurred>0&&<section className="history-paid-progress" aria-label="Invoice payment progress">
    <span>{progress.label} across invoices in view</span>
    <div className="history-paid-track" role="progressbar" aria-label="Invoice value paid" aria-valuenow={progress.percentage}>
     <i style={{width:`${progress.percentage}%`}}/>
    </div>
   </section>}
  </div>
  <section className="card history-card" aria-label={showPayments?'Payment history':'Expense history'}>
   <div className="history-controls" aria-label="Expense filters">
    <label className="history-filter-field history-search-field">
     <span>Search by item or payee</span>
     <span className="search"><Search size={17} aria-hidden="true"/>
      <input aria-label="Search transactions" type="search" placeholder="Search transactions" value={query}
       onChange={event=>changeFilter('q',event.target.value,'',true)}/>
     </span>
    </label>
    {!contractor&&<FilterSelect label="Record type" value={recordType}
     options={['Invoices','Completed payments','Today’s payments']}
     change={value=>changeFilter('payments',value==='Completed payments'?'completed':value==='Today’s payments'?'today':'')}/>}
    {!contractor&&<FilterSelect label="Category" value={category||'All categories'} options={['All categories',...categories]}
     change={value=>changeFilter('category',value,'All categories')}/>}
    <FilterSelect label="Payment method" value={method||'All methods'} options={['All methods',...paymentMethods]}
     change={value=>changeFilter('method',value,'All methods')}/>
    {!showPayments&&<FilterSelect label="Payment status" value={status} options={statuses} change={value=>changeFilter('status',value,statuses[0])}/>}
    {!showToday&&<>
     <FilterSelect label="Date range" value={range} options={dateRanges} change={value=>changeFilter('range',value,dateRanges[0])}/>
     <label className="history-filter-field date-filter"><span>From</span><input aria-label="From date" type="date"
      value={dateFrom} max={dateTo||undefined} onChange={event=>changeFilter('from',event.target.value)}/></label>
     <label className="history-filter-field date-filter"><span>To</span><input aria-label="To date" type="date" min={dateFrom||undefined}
      value={dateTo} onChange={event=>changeFilter('to',event.target.value)}/></label>
    </>}
    <FilterSelect label="Sort" value={sort} options={sorts} change={value=>changeFilter('sort',value,sorts[0])}/>
   </div>
   {error&&<div className="history-warning" role="alert">
    <span>Couldn’t refresh these records.</span><button className="btn" type="button" onClick={()=>void refresh()}>Try again</button>
   </div>}
   <div className="filter-results">
    <strong role="status">{rows.length} {showPayments?(rows.length===1?'payment':'payments'):(rows.length===1?'expense':'expenses')}</strong>
    {activeFilters.length>0&&<ul aria-label="Active filters">{activeFilters.map(filter=><li key={String(filter)}>{filter}</li>)}</ul>}
    {(activeFilters.length>0||sort!==sorts[0]||showPayments)&&rows.length>0&&
     <button className="btn" type="button" onClick={clear}>Clear filters</button>}
   </div>
   <ExpenseTable rows={pageRows} open={open} payments={showPayments}
    filtered={hasData&&activeFilters.length>0} today={showToday}
    clear={hasData&&activeFilters.length>0?clear:undefined}/>
   {rows.length>0&&<div className="pagination"><span>Page {page} of {totalPages}</span><div>
    <button className="btn" disabled={page===1} onClick={()=>changeFilter('page',String(page-1),'1')}>Previous</button>
    <button className="btn" disabled={page>=totalPages} onClick={()=>changeFilter('page',String(page+1),'1')}>Next</button>
   </div></div>}
  </section>
 </>;
}
