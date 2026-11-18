import {useState} from 'react';
import {Plus,Pencil,CreditCard} from 'lucide-react';
import {useWorkspace} from '../app/Workspace';
import {Expense,money} from '../data';
import {Payment} from '../types';
import {today} from '../lib/accounting';
import RecordEditor from './RecordEditor';
export default function Payments({expense}:{expense:Expense}){
 const w=useWorkspace();const [editing,setEditing]=useState<Payment|null|undefined>();const payments=w.data!.payments.filter(p=>p.expense_id===expense.id).sort((a,b)=>b.date.localeCompare(a.date));
 return <section className="transaction-section"><div className="detail-section-title"><h3>Payment history</h3>{w.admin&&<button className="btn" onClick={()=>setEditing(null)}><Plus size={14}/>Record payment</button>}</div>{payments.length?payments.map(p=><div className="payment-history-row" key={p.id}><CreditCard size={16}/><div><strong>{money(p.amount)}</strong><small>{p.date} · {p.method}</small>{w.admin&&p.reference&&<small>Reference: {p.reference}</small>}</div>{w.admin&&<button className="icon-btn" aria-label="Correct payment" onClick={()=>setEditing(p)}><Pencil size={14}/></button>}</div>):<p className="muted">No payments recorded yet.</p>}{editing!==undefined&&w.admin&&<RecordEditor title={editing?'Correct payment':'Record payment'} initial={editing?{...editing}:{expense_id:expense.id,date:today(),method:'UPI'}} fields={[{key:'date',label:'Payment date',type:'date',required:true},{key:'amount',label:'Amount paid (₹)',type:'number',min:.01,max:expense.amount,step:'.01',required:true,hint:'The database rejects payments exceeding the remaining invoice balance.'},{key:'method',label:'Method',type:'select',options:['Cash','UPI','Bank Transfer','Cheque','Other'],required:true},{key:'reference',label:'Reference number · private'},{key:'notes',label:'Payment notes · private',type:'textarea'}]} save={(p,key)=>w.saveRecord('payments',p,key)} remove={editing?()=>w.remove('payments',editing.id):undefined} close={()=>setEditing(undefined)}/>}</section>
}
