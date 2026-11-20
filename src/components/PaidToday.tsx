import {useEffect, useState} from 'react';
import {CalendarCheck, Receipt} from 'lucide-react';
import {NavLink} from 'react-router-dom';
import {money} from '../data';
import {sumMoney} from '../lib/accounting';
import {displayDate} from '../lib/history-filters';
import type {PaymentEntry} from '../lib/payment-ledger';

type Props = {
 entries: PaymentEntry[];
 arrivals: PaymentEntry[];
 openPayment: (entry: PaymentEntry) => void;
 day: string;
};

export default function PaidToday({entries, arrivals, openPayment, day}: Props) {
 const batch = arrivals[0]?.payment.id;
 const [dismissed, setDismissed] = useState<string>();
 const [animated, setAnimated] = useState<string>();
 const [focused, setFocused] = useState<string>();
 useEffect(() => {
  if (!batch) return;
  const timer = setTimeout(() => setDismissed(batch), 4500);
  const animationTimer = setTimeout(() => setAnimated(batch), 1000);
  return () => {clearTimeout(timer);clearTimeout(animationTimer)};
 }, [batch]);

 const count = entries.length;
 const total = sumMoney(entries.map(({payment}) => payment.amount));
 const arriving = new Set(batch!==animated?arrivals.map(({payment}) => payment.id):[]);
 const message = batch && batch !== dismissed
  ? `${arrivals.length} new ${arrivals.length === 1 ? 'payment' : 'payments'} · ${money(sumMoney(arrivals.map(({payment}) => payment.amount)))} paid`
  : '';
 let revealIndex = 0;
 const focusedEntry = focused&&entries.find(({payment})=>payment.id===focused);
 const latest = entries.slice(0,3);
 if(focusedEntry&&!latest.includes(focusedEntry))latest[2]=focusedEntry;

 return <section className="card paid-today" data-empty={!count||undefined} aria-labelledby="paid-today-heading">
  <div className="paid-today-header">
   <span className="balance-icon" aria-hidden="true"><CalendarCheck size={19} /></span>
   <div><h2 id="paid-today-heading">Paid today</h2><p>{count ? `${count} ${count === 1 ? 'payment' : 'payments'} · ${displayDate(day,'d MMM')}` : 'No payments today'}</p></div>
   <strong className="paid-today-total">{money(total)}</strong>
  </div>
  <div role="status" className={message && arrivals.length > 1 && count ? 'paid-today-message' : 'sr-only'}>
   {message && count > 0 && <span key={batch}>{message}</span>}
  </div>
  {count > 0 && <ul className="recent-payment-list paid-today-list">
   {latest.map(entry => {
    const {payment, expense} = entry;
    const isNew = arriving.has(payment.id);
    const delay = isNew ? revealIndex++ * 45 : 0;
    return <li key={payment.id} data-arriving={isNew || undefined} style={{animationDelay: `${delay}ms`}}>
     <button type="button" onFocus={()=>setFocused(payment.id)} onBlur={event=>{
      if(!event.relatedTarget?.closest('[role="dialog"]'))setFocused(undefined);
     }} onClick={event => {
      event.currentTarget.focus({preventScroll:true});
      openPayment(entry);
     }}>
      <span className="recent-payment-icon"><Receipt size={16} /></span>
      <span className="recent-payment-name"><strong>{expense.title}</strong><small>{expense.vendor}</small></span>
      <span className="recent-payment-value"><strong>{money(payment.amount)}</strong></span>
     </button>
    </li>;
   })}
  </ul>}
  {(count > 3 || Boolean(message&&arrivals.length>1&&count)) && <div className="recent-payment-footer">
   <NavLink to="/expenses?payments=today">View all {count} payments</NavLink>
  </div>}
 </section>;
}
