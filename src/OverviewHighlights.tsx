import {useMemo} from 'react';
import {ArrowUpRight,Boxes,CalendarDays,ChevronDown,ChevronRight,Clock3,HandCoins,HardHat,ReceiptText,Wallet} from 'lucide-react';
import {NavLink} from 'react-router-dom';
import {money} from './data';
import {dateRanges,periodBounds,sumMoney,totals} from './lib/accounting';
import {displayBounds,displayDate,paymentHistoryLink} from './lib/history-filters';
import {latestPayment,type PaymentEntry} from './lib/payment-ledger';
import type {Snapshot} from './types';
import PaidToday from './components/PaidToday';
import CategoryPhoto from './components/CategoryPhoto';

type Props={
 data:Snapshot;
 day:string;
 range:string;
 setRange:(range:string)=>void;
 onPending:()=>void;
 entries:PaymentEntry[];
 todayEntries:PaymentEntry[];
 arrivals:PaymentEntry[];
 openPayment:(entry:PaymentEntry)=>void;
};

export default function OverviewHighlights({data,day,range,setRange,onPending,entries,todayEntries,arrivals,openPayment}:Props){
 const projectPaid=sumMoney(entries.map(({payment})=>payment.amount));
 const {pending}=totals(data.expenses);
 const received=sumMoney(data.contributions.map(contribution=>contribution.amount));
 const selected=periodBounds(range,day);
 const previous=periodBounds(range,day,true);
 const ordered=useMemo(()=>[...entries].sort(latestPayment),[entries]);
 const periodPayments=selected?ordered.filter(({payment})=>payment.date>=selected.from&&payment.date<=selected.to):ordered;
 const {date:lastDate} = ordered[0]?.payment??{};
 const {date:firstDate} = ordered.at(-1)?.payment??{};
 const bounds=selected??(firstDate&&lastDate?{from:firstDate,to:lastDate}:undefined);
 const rangePaid=sumMoney(periodPayments.map(({payment})=>payment.amount));
 const previousPaid=previous&&sumMoney(entries.filter(({payment})=>payment.date>=previous.from&&payment.date<=previous.to).map(({payment})=>payment.amount));
 const grouped=new Map<string,number[]>();
 for(const {payment,expense} of periodPayments){
  const values=grouped.get(expense.category)??[];
  values.push(payment.amount);
  grouped.set(expense.category,values);
 }
 const categories=[...grouped].map(([name,amounts])=>({name,amount:sumMoney(amounts)}))
  .sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name));
 const topCategory=categories[0];
 const recent=periodPayments.filter(({payment})=>payment.date!==day).slice(0,4);
 const rangeCaption=bounds?displayBounds(bounds):range;
 const comparison=previousPaid?Math.round((rangePaid-previousPaid)/previousPaid*100):undefined;
 const comparisonCopy=comparison===undefined?null:comparison===0?'About the same':
  `${Math.abs(comparison).toLocaleString('en-IN')}% ${comparison>0?'higher':'lower'}`;

 return <div className="overview-layout">
  <section className="card overview-summary" aria-labelledby="spent-label">
   <span className="overview-cover-photo category-photo" data-photo="plans" aria-hidden="true"/>
   <div className="overview-total">
    <h2 id="spent-label"><Wallet size={16} aria-hidden="true"/>Total spent</h2>
    <strong className="spent-value">{money(projectPaid)}</strong>
    <p>Project to date</p>
   </div>
   <button type="button" className="overview-metric" onClick={onPending} aria-label="View pending dues records">
    <span><Clock3 size={15} aria-hidden="true"/>Pending invoice dues<ChevronRight className="metric-chevron" size={15} aria-hidden="true"/></span><strong>{money(pending)}</strong>
   </button>
   <div className="overview-metric"><span><HandCoins size={15} aria-hidden="true"/>Contributions received</span><strong>{money(received)}</strong></div>
  </section>

  <section className="card overview-payment-feed" aria-label="Payment activity">
   <PaidToday entries={todayEntries} arrivals={arrivals} openPayment={openPayment} day={day}/>
   <section className="recent-payments overview-recent" aria-labelledby="recent-heading">
    <div className="overview-section-head"><div><h2 id="recent-heading">Recent payments</h2>{selected&&<p>{rangeCaption}</p>}</div></div>
    {recent.length?<ul className="recent-payment-list">
     {recent.map(entry=>{
      const Icon=entry.expense.category==='Materials'?Boxes:entry.expense.category==='Contractor costs'?HardHat:ReceiptText;
      return <li key={entry.payment.id}>
      <button type="button" onClick={event=>{event.currentTarget.focus({preventScroll:true});openPayment(entry)}}>
       <span className="payment-identity"><span className="recent-payment-icon" aria-hidden="true"><Icon size={16}/></span><span className="recent-payment-name"><strong>{entry.expense.title}</strong><small>{entry.expense.vendor}</small></span></span>
       <span className="recent-payment-value"><strong>{money(entry.payment.amount)}</strong>
        <time dateTime={entry.payment.date}>{displayDate(entry.payment.date,'d MMM')}</time>
       </span>
      </button>
     </li>})}
    </ul>:<p className="empty overview-empty">No earlier payments in this range.</p>}
    <div className="recent-payment-footer"><NavLink to={paymentHistoryLink(bounds)}>View expense history<ArrowUpRight size={15} aria-hidden="true"/></NavLink></div>
   </section>
  </section>

  <div className="overview-analysis">
   <section className="card spending-card overview-categories" aria-labelledby="categories-heading">
    <div className="overview-section-head">
     <div><h2 id="categories-heading">Where the money went</h2><p>{rangeCaption}</p></div>
     <label className="overview-range">
      <CalendarDays aria-hidden="true" size={16}/>
      <select aria-label="Date range" value={range} onChange={event=>setRange(event.target.value)}>
       {dateRanges.map(option=><option key={option}>{option}</option>)}
      </select>
      <ChevronDown aria-hidden="true" size={15}/>
     </label>
    </div>
    {categories.length>0&&<div className="category-stack" aria-hidden="true">
     {categories.map(({name,amount},index)=><span key={name} data-rank={index} style={{width:`${amount/rangePaid*100}%`}}/>)}
    </div>}
    {categories.length>0?<ul className="spending-bars">
     {categories.map(({name,amount})=>{
      const share=amount/rangePaid;
      const shareText=`${Math.round(share*100)}% of spending`;
      return <li key={name}>
       <NavLink to={paymentHistoryLink(bounds,name)} className="category-drill"
        aria-label={`${name} ${money(amount)}`} aria-description={shareText}>
        <CategoryPhoto category={name}/>
        <span className="category-data"><span>{name}</span><strong>{money(amount)}</strong><small>{shareText}</small></span>
        <ArrowUpRight className="category-action" size={16} aria-hidden="true"/>
       </NavLink>
      </li>})}
    </ul>:<p className="empty overview-empty">No payments in this range.</p>}
    {topCategory&&<NavLink className="spending-insight" to={paymentHistoryLink(bounds,topCategory.name)}>
     {topCategory.name} made up {Math.round(topCategory.amount/rangePaid*100)}% of payments in this range.<ArrowUpRight size={15} aria-hidden="true"/>
    </NavLink>}
    <div className="overview-range-total">
     <span><strong>{money(rangePaid)}</strong> paid in this range</span>
     {selected&&<button className="overview-text-button" type="button" onClick={()=>setRange('All time')}>Clear period</button>}
    </div>
   </section>

   {previous&&selected&&<section className="card overview-comparison" aria-labelledby="comparison-heading">
    <div className="overview-section-head"><div><h2 id="comparison-heading">Compare periods</h2></div></div>
    <div className="comparison-data">
     <NavLink to={paymentHistoryLink(selected)}><small>Selected range · {displayBounds(selected)}</small><strong>{money(rangePaid)}</strong></NavLink>
     <NavLink to={paymentHistoryLink(previous)}><small>Previous range · {displayBounds(previous)}</small><strong>{money(previousPaid??0)}</strong></NavLink>
     {comparisonCopy&&<span>{comparisonCopy}</span>}
    </div>
   </section>}
  </div>
 </div>;
}
