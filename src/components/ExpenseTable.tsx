import {format} from 'date-fns';
import {Building2,Receipt,Search} from 'lucide-react';
import {Expense, money, status} from '../data';
import type {Payment} from '../types';
import CategoryPhoto from './CategoryPhoto';

export default function ExpenseTable({rows, open, filtered, payments = false, today = false, clear}: {
 rows: {expense: Expense; payment?: Payment; paymentCount: number; imageCount: number}[];
 open: (expense: Expense, paymentId?: string) => void;
 filtered: boolean;
 payments?: boolean;
 today?: boolean;
 clear?: () => void;
}) {
 const item = payments ? 'payments' : 'expenses';
 if (!rows.length) return <div className="empty history-empty">
  <Search size={23} />
  <h3>{filtered ? `No matching ${item}` : today ? 'No payments today' : `No ${item} yet`}</h3>
  <p>{filtered ? 'Try another search or clear the filters.' : today ? 'Completed payments will appear here as they are recorded.' : `Recorded ${item} will appear here.`}</p>
  {clear&&<button className="btn" type="button" onClick={clear}>Clear filters</button>}
 </div>;

 return <div className="table-wrap expense-table"><table>
  <thead><tr><th scope="col">{payments ? 'Payment date' : 'Date'}</th><th scope="col">Item</th><th scope="col">Payee / Payment method</th><th scope="col">Status</th><th scope="col" className="right">{payments ? 'Amount paid' : 'Invoice amount'}</th></tr></thead>
  <tbody>{rows.map(({expense,payment,paymentCount,imageCount}) => {
   const label = payment ? 'Completed' : status(expense);
   const date = payment?.date ?? expense.date;
   const method = payment?.method ?? expense.method;
   const title = payment ? `payment for ${expense.title}` : expense.title;
   return <tr key={payment?.id ?? expense.id} onClick={() => open(expense,payment?.id)} aria-label={`View ${title}`}>
    <td><time dateTime={date}>{format(new Date(date + 'T12:00:00'), 'd MMM yyyy')}</time></td>
    <td><div className="expense-cell">
     <CategoryPhoto category={expense.category} className="expense-category-photo"/>
     <div>
      <button className="expense-title" type="button" onClick={event => {
       event.stopPropagation();
       event.currentTarget.focus({preventScroll:true});
       open(expense,payment?.id);
      }} aria-label={`Open ${title}`}>
       {expense.title}{!payment&&expense.proof&&<span className="has-proof" title="Invoice receipt attached" role="img" aria-label="Invoice receipt attached"><Receipt size={12} /></span>}
      </button>
      <small className="expense-record-meta"><span>{expense.category}</span>
       {paymentCount>0&&<span>{paymentCount} {paymentCount===1?'payment':'payments'}</span>}
       {imageCount>0&&<span>{imageCount} payment {imageCount===1?'image':'images'}</span>}
      </small>
      <small className="mobile-vendor-name"><Building2 size={12} /><span>{expense.vendor}{method&&` · ${method}`}</span></small>
     </div>
    </div></td>
    <td className="vendor-col"><span>{expense.vendor}</span>{method&&<small className="expense-method">{method}</small>}</td>
    <td><span className={`badge ${label.toLowerCase().replace(' ', '-')}`}><i />{label}</span></td>
    <td className="right"><strong>{money(payment?.amount ?? expense.amount)}</strong></td>
   </tr>;
  })}</tbody>
 </table></div>;
}
