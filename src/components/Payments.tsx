import {useState} from 'react';
import {Plus,Pencil,CreditCard,ImagePlus} from 'lucide-react';
import {useWorkspace} from '../app/Workspace';
import {Expense,money} from '../data';
import {Payment} from '../types';
import PaymentEditor from './PaymentEditor';
import PaymentImages from './PaymentImages';
import {displayDate} from '../lib/history-filters';

type Props={
 expense:Expense;
 payments:Payment[];
 selectedId?:string;
 showImages:boolean;
 onSaved:()=>void;
};

export default function Payments({expense,payments,selectedId,showImages,onSaved}:Props){
 const w=useWorkspace();
 const [editing,setEditing]=useState<Payment|null|undefined>();

 return <section className="transaction-section payment-timeline">
  <div className="detail-section-title">
   <div><h3>Payment history</h3>
    {payments.length>0&&<p className="payment-history-hint">{payments.length} {payments.length===1?'payment':'payments'} recorded</p>}
   </div>
   {w.admin&&<button type="button" className="btn" onClick={()=>setEditing(null)} disabled={expense.paid>=expense.amount}><Plus size={14}/>Record payment</button>}
  </div>
  {payments.length?payments.map(payment=><div className="payment-history-row" key={payment.id} data-payment-id={payment.id} data-selected={payment.id===selectedId||undefined}>
   <span className="payment-row-symbol"><CreditCard size={16}/></span>
   <div className="payment-row-content">
    <div className="payment-row-heading"><strong>{money(payment.amount)}</strong>
     {w.admin&&<button type="button" className="icon-btn" aria-label="Correct payment" title="Edit payment details or images" onClick={()=>setEditing(payment)}><Pencil size={14}/></button>}
    </div>
    <small><time dateTime={payment.date}>{displayDate(payment.date)}</time> · {payment.method}</small>
    {payment.id===selectedId&&<small>Paid to {expense.vendor}</small>}
    {w.admin&&payment.reference&&<small>Reference: {payment.reference}</small>}
    {w.admin&&payment.notes&&<p className="payment-private-notes">{payment.notes}</p>}
    {payment.proofs?.length
     ? showImages&&<PaymentImages proofs={payment.proofs} date={payment.date}/>
     : w.admin&&<button type="button" className="payment-attach-link" onClick={()=>setEditing(payment)}><ImagePlus size={13}/>Attach payment images</button>}
   </div>
  </div>):<p className="muted">No payments recorded yet.</p>}
  {editing!==undefined&&w.admin&&<PaymentEditor expense={expense} record={editing} onSaved={onSaved} close={()=>setEditing(undefined)}/>}
 </section>;
}
