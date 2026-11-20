import {useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {Check,X,Trash2,CreditCard} from 'lucide-react';
import {motion,useReducedMotion} from 'framer-motion';
import ModalPortal from './ModalPortal';
import PaymentImagesUpload from './PaymentImagesUpload';
import {Expense,PaymentProof,money} from '../data';
import {Payment} from '../types';
import {useWorkspace} from '../app/Workspace';
import {useDialog} from '../useDialog';
import {roundMoney,sumMoney,today} from '../lib/accounting';
import {hasMatchingPayment,paymentsForExpenses,paymentSignature} from '../lib/payment-ledger';
import {paymentMethods} from '../lib/history-filters';

export default function PaymentEditor({expense,record,close,onSaved}:{expense:Expense;record:Payment|null;close:()=>void;onSaved:()=>void}){
 const w=useWorkspace();
 const canShare=w.data?.publicPaymentReceipts===true;
 const reduced=useReducedMotion();
 const request=useRef(crypto.randomUUID());
 const dirty=useRef(false);
 const submitting=useRef(false);
 const available=sumMoney([expense.amount,-expense.paid,record?.amount||0]);
 const [date,setDate]=useState(record?.date||today());
 const [amount,setAmount]=useState(record?String(record.amount):available>0?String(available):'');
 const [method,setMethod]=useState(record?.method||'UPI');
 const [reference,setReference]=useState(record?.reference||'');
 const [notes,setNotes]=useState(record?.notes||'');
 const [proofs,setProofs]=useState<PaymentProof[]>(record?.proofs||[]);
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const [duplicate,setDuplicate]=useState('');
 const numericAmount=Number(amount);
 const signature=Number.isFinite(numericAmount)&&numericAmount>0?paymentSignature(date,expense.vendor,numericAmount):'';
 const confirmDuplicate=Boolean(duplicate&&duplicate===signature);
 const exit=()=>{if(!submitting.current&&!uploading&&(!dirty.current||confirm('Discard unsaved payment changes?')))close()};
 useDialog(true,exit);
 const change=(setter:(value:string)=>void,value:string)=>{dirty.current=true;setter(value)};

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current||uploading)return;
  setError('');
  if(!date||!signature||roundMoney(numericAmount)>available){
   setError(`Enter a valid payment up to ${money(available)} and its actual date.`);
   return;
  }
  const original=record&&paymentSignature(record.date,expense.vendor,record.amount);
  const {payments,expenses}=w.data!;
  if(signature!==original&&!confirmDuplicate&&hasMatchingPayment(paymentsForExpenses(payments,expenses),signature,record?.id)){
   setDuplicate(signature);
   return;
  }
  submitting.current=true;
  setBusy(true);
  try{
   await w.saveRecord('payments',{
    id:record?.id,version:record?.version,expense_id:expense.id,date,amount:roundMoney(numericAmount),
    method,reference:reference.trim(),notes:notes.trim(),proofs,
   },request.current);
   onSaved();
   close();
  }catch(error){
   setError(error instanceof Error?error.message:'Could not save payment. Try again.');
  }finally{
   submitting.current=false;
   setBusy(false);
  }
 }

 async function remove(){
  if(!record||submitting.current||!confirm('Delete this payment and its linked images?'))return;
  submitting.current=true;
  setBusy(true);
  setError('');
  try{await w.remove('payments',record.id);close()}
  catch(error){setError(error instanceof Error?error.message:'Could not delete payment')}
  finally{submitting.current=false;setBusy(false)}
 }

 return <ModalPortal>
  <motion.div className="overlay" initial={reduced?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={exit}>
   <motion.section className="drawer payment-editor" role="dialog" aria-modal="true" aria-label={record?'Correct payment':'Record payment'}
    initial={reduced?false:{x:60}} animate={{x:0}} exit={reduced?{x:0}:{x:60}} transition={{duration:reduced?0:.22}} onClick={event=>event.stopPropagation()}>
    <div className="drawer-header">
     <div><h2>{record?'Correct payment':'Record payment'}</h2><p>{expense.title}</p></div>
     <button type="button" className="icon-btn" disabled={busy||uploading} aria-label="Close payment form" onClick={exit}><X/></button>
    </div>
    <form onSubmit={save}>
     <div className="form-body">
      <div className="payment-editor-summary"><CreditCard size={20}/>
       <div><small>{record?'Available amount including this payment':'Remaining invoice balance'}</small><strong>{money(available)}</strong></div>
       <span>Invoice {money(expense.amount)}</span>
      </div>
      <fieldset disabled={busy||uploading}>
       <div className="form-grid">
        <label>Payment date<input required type="date" value={date} onChange={event=>change(setDate,event.target.value)}/></label>
        <label>Amount paid (₹)<input required type="number" inputMode="decimal" min="0.01" max={available} step="0.01" value={amount}
         onChange={event=>change(setAmount,event.target.value)}/></label>
       </div>
       <label>Method<select value={method} onChange={event=>change(setMethod,event.target.value)}>
        {paymentMethods.map(option=><option key={option}>{option}</option>)}
       </select></label>
       <label>Reference number · private<input maxLength={120} placeholder="UPI / bank transaction reference" value={reference}
        onChange={event=>change(setReference,event.target.value)}/></label>
       <label>Payment notes · private<textarea maxLength={4000} rows={3} value={notes} onChange={event=>change(setNotes,event.target.value)}/></label>
       <PaymentImagesUpload proofs={proofs} change={images=>{dirty.current=true;setProofs(images)}} onBusy={setUploading}
        canShare={canShare} shareNewImages={canShare&&!record&&expense.is_public!==false}/>
      </fieldset>
      {confirmDuplicate&&<p className="duplicate-payment" role="alert">Possible duplicate payment. The ledger already has a payment with this date, payee, and amount.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
     </div>
     <div className="form-footer">
      {record?<button type="button" className="btn danger" disabled={busy||uploading} onClick={remove}><Trash2 size={15}/>Delete payment</button>:
       <button type="button" className="btn" disabled={busy||uploading} onClick={exit}>Cancel</button>}
      <button className="btn primary" disabled={busy||uploading}><Check size={16}/>{busy?'Saving…':confirmDuplicate?'Save anyway':'Save payment'}</button>
     </div>
    </form>
   </motion.section>
  </motion.div>
 </ModalPortal>;
}
