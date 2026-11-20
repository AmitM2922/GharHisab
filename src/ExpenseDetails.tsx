import {useEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowDownLeft,X,Receipt,CalendarDays,Building2,CreditCard,Package,Check,Clock3,Pencil,Trash2,LockKeyhole,Image,Maximize2,Minimize2,Download,ShieldCheck,Copy,HardHat,FileText,ArrowUpRight} from 'lucide-react';
import {format} from 'date-fns';
import ModalPortal from './components/ModalPortal';
import MaterialBreakdown from './components/MaterialBreakdown';
import Payments from './components/Payments';
import PaymentImages from './components/PaymentImages';
import {paymentProgress} from './lib/accounting';
import {displayDate} from './lib/history-filters';
import {materialLines} from './lib/materials';
import {useWorkspace} from './app/Workspace';
import {Expense,money,status} from './data';
import {proofDownloadUrl,visiblePaymentProofs} from './lib/payment-images';
import {latestPayment,paymentsForExpenses} from './lib/payment-ledger';
import {useDialog} from './useDialog';

const sections=[{name:'Overview',icon:FileText},{name:'Payments',icon:CreditCard},{name:'Receipts',icon:Image}] as const;
type DetailSection=(typeof sections)[number]['name'];

export default function ExpenseDetails({expense:e,paymentId,admin,close,edit,remove,onPaymentSaved}:{expense:Expense;paymentId?:string;admin:boolean;onPaymentSaved:()=>void;close:()=>void;edit:()=>void;remove:()=>void|Promise<void>}){
 const w=useWorkspace(),reduced=useReducedMotion();
 const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[copyMessage,setCopyMessage]=useState(''),[active,setActive]=useState<DetailSection>(paymentId?'Payments':'Overview'),[receiptError,setReceiptError]=useState(''),[failedUrl,setFailedUrl]=useState(''),[refreshing,setRefreshing]=useState(false);
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width: 800px)').matches);
 const panel=useRef<HTMLElement>(null);
 const overview=useRef<HTMLDivElement>(null),payments=useRef<HTMLDivElement>(null),receipt=useRef<HTMLElement>(null);
 useDialog(true,()=>{if(!busy)close()});
 useEffect(()=>{
  const media=window.matchMedia('(max-width: 800px)');
  const update=()=>setMobile(media.matches);
  media.addEventListener('change',update);
  return ()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  if(!paymentId||!panel.current)return;
  const row=payments.current?.querySelector<HTMLElement>(`[data-payment-id="${CSS.escape(paymentId)}"]`);
  const target=row??payments.current;
  const nav=panel.current.querySelector('nav');
  if(target&&nav)panel.current.scrollTop+=target.getBoundingClientRect().top-nav.getBoundingClientRect().bottom-12;
 },[paymentId]);
 const {pending:due,percentage:percent,label:progressLabel}=paymentProgress(e.amount,e.paid);
 const categoryIcon=e.category==='Materials'?<Package size={25}/>:e.category==='Contractor costs'?<HardHat size={25}/>:<Receipt size={25}/>;
 function jump(name:DetailSection){
  setActive(name);
  requestAnimationFrame(()=>{
   const node=name==='Payments'?payments.current:name==='Receipts'?receipt.current:overview.current;
   node?.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'});
  });
 }
 const reference=e.id.startsWith('GH-')?e.id:e.id.slice(0,8).toUpperCase();
 const proof=e.proof;
 const invoicePayments=paymentsForExpenses(w.data!.payments,[e]).sort(latestPayment)
  .map(({payment})=>({...payment,proofs:visiblePaymentProofs(payment.proofs,admin)}));
 const galleryPayments=admin?invoicePayments:invoicePayments.filter(payment=>payment.proofs.length>0);
 const paymentImageCount=galleryPayments.reduce((count,payment)=>count+payment.proofs.length,0);
 const receiptCount=paymentImageCount+Number(Boolean(proof));
 const offscreen=mobile?{y:'100%',x:0}:{x:'100%',y:0};
 const transition={duration:reduced?0:.22,ease:'easeOut' as const};

 return <ModalPortal><motion.div className="overlay transaction-overlay" initial={reduced?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={transition} onClick={()=>{if(!busy)close()}}>
  <motion.section ref={panel} className="drawer transaction-drawer polished-expense" role="dialog" aria-modal="true" aria-label="Transaction details" initial={reduced?false:offscreen} animate={{x:0,y:0}} exit={reduced?{x:0,y:0}:offscreen} transition={transition} onClick={event=>event.stopPropagation()}>
   <div className="transaction-header"><div className="expense-drawer-heading"><span><Receipt size={18}/></span><div><strong>{paymentId?'Payment details':'Expense details'}</strong></div></div><button className="icon-btn" aria-label="Close transaction details" disabled={busy} onClick={close}><X size={18}/></button></div>
   <nav className="expense-section-nav" aria-label="Expense detail sections">{sections.map(({name,icon:Icon})=>{
    const count=name==='Payments'?invoicePayments.length:name==='Receipts'?receiptCount:0;
    return <button type="button" key={name} className={active===name?'active':''} aria-pressed={active===name}
     aria-description={count?`${count} ${name==='Payments'?(count===1?'payment':'payments'):(count===1?'image':'images')}`:undefined}
     onClick={()=>jump(name)}><Icon size={15} aria-hidden="true"/>{name}{count>0&&<span className="expense-section-count" aria-hidden="true">{count}</span>}</button>;
   })}</nav>
   <div className="transaction-body">
    <div ref={overview} className="expense-detail-anchor">
     <div className="transaction-id"><span>REF · {reference}</span><span className={'badge '+status(e).replace(' ','-').toLowerCase()}><i/>{status(e)}</span></div>
     <div className="transaction-title"><span className="transaction-category-icon">{categoryIcon}</span><div><span className="eyebrow">{e.category}</span><h2>{e.title}</h2></div></div>
     <section className="transaction-amount"><div className="amount-heading"><span>INVOICE AMOUNT</span><span className="currency-label">INR</span></div><h3>{money(e.amount)}</h3><div className="amount-meta"><span><CalendarDays size={13}/>{format(new Date(e.date+'T12:00:00'),'d MMM yyyy')}</span><span><Building2 size={13}/>{e.vendor}</span></div></section>
     <section className="payment-breakdown"><div className="detail-section-title"><h3>Payment summary</h3><span className={due>0?'pending-progress-label':''}>{progressLabel}</span></div><div className="payment-duo"><div><span className="paid-icon"><ArrowDownLeft size={15}/></span><small>Amount paid</small><strong>{money(e.paid)}</strong></div><div className={due===0?'balance-cleared':''}><span className="due-icon">{due>0?<Clock3 size={15}/>:<Check size={15}/>}</span><small>Pending dues</small><strong>{money(due)}</strong></div></div><div className="payment-progress"><motion.i initial={reduced?false:{width:0}} animate={{width:`${percent}%`}} transition={{duration:reduced?0:.22}}/></div><p className="payment-status-message">{due>0?<Clock3 size={12}/>:<Check size={12}/>} {due>0?`${money(due)} remaining on this invoice.`:'All settled. This invoice is paid in full.'}</p></section>
     <section className="transaction-section expense-info-section"><div className="detail-section-title"><h3>Expense information</h3>{admin&&<button type="button" className="inline-edit" onClick={edit}><Pencil size={12}/>Edit</button>}</div><dl className="expense-info-grid"><div><dt><Building2 size={14}/>Vendor / contractor</dt><dd>{e.vendor}</dd></div><div><dt><CreditCard size={14}/>Payment method</dt><dd><span className="method-pill">{e.method}</span></dd></div><div><dt><CalendarDays size={14}/>Expense date</dt><dd>{format(new Date(e.date+'T12:00:00'),'dd MMM yyyy')}</dd></div><div><dt><Package size={14}/>Category</dt><dd>{e.category}{e.category==='Materials'?` · ${materialLines(e).length} ${materialLines(e).length===1?'item':'items'}`:''}</dd></div><div className="expense-full-reference"><dt><FileText size={14}/>Transaction ID</dt><dd><span>{e.id}</span><button className="icon-btn" type="button" aria-label="Copy transaction ID" onClick={async()=>{try{await navigator.clipboard.writeText(e.id);setCopyMessage('Transaction ID copied.')}catch{setCopyMessage('Select and copy the transaction ID shown here.')}}}><Copy size={13}/></button></dd>{copyMessage&&<small role="status">{copyMessage}</small>}</div>{e.created_at&&<div className="expense-created"><dt>Created</dt><dd>{format(new Date(e.created_at),'dd MMM yyyy, h:mm a')}</dd></div>}</dl><MaterialBreakdown expense={e}/></section>
     {e.description&&<section className="expense-note"><div><FileText size={15}/><h3>Description</h3></div><p>{e.description}</p></section>}
     {admin&&e.notes&&<section className="expense-note private"><div><LockKeyhole size={15}/><h3>Private notes</h3><span>Only you</span></div><p>{e.notes}</p></section>}
    </div>
    <div ref={payments} className="expense-detail-anchor"><Payments expense={e} payments={invoicePayments} selectedId={paymentId} showImages={active!=='Receipts'} onSaved={onPaymentSaved}/></div>
    <section ref={receipt} className="transaction-section proof-section expense-detail-anchor">
     {active==='Receipts'&&galleryPayments.length>0&&<section className="payment-proof-section" aria-labelledby="payment-proof-heading">
      <div className="detail-section-title"><h3 id="payment-proof-heading">Payment images</h3><span>{paymentImageCount} {paymentImageCount===1?'image':'images'}</span></div>
      <ul className="payment-proof-groups">
       {galleryPayments.map(payment=><li className="payment-proof-group" key={payment.id}>
        <div className="payment-proof-date"><time dateTime={payment.date}>{displayDate(payment.date)}</time><strong>{money(payment.amount)}</strong></div>
        {payment.proofs?.length?<PaymentImages proofs={payment.proofs} date={payment.date}/>:<p className="muted">No images attached</p>}
       </li>)}
      </ul>
     </section>}
     <div className="detail-section-title"><h3>Expense receipt</h3>{admin&&e.proof&&e.is_public===false&&<span className="private-tag"><LockKeyhole size={10}/>Admin only</span>}</div>
     {proof?.url&&proof.url!==failedUrl?<div className="receipt-card">
      <div className="proof-file"><span><Image size={17}/></span><div><strong>{proof.name}</strong></div><a className="icon-btn" href={proof.url} target="_blank" rel="noopener noreferrer" aria-label="Open original receipt"><ArrowUpRight size={16}/></a><a className="icon-btn" href={proofDownloadUrl(proof)} download={proof.name} aria-label="Download receipt"><Download size={16}/></a></div>
      <div className={expanded?'proof-image expanded':'proof-image'}><img src={proof.url} alt={'Receipt for '+e.title} onError={()=>setFailedUrl(proof.url)}/></div>
      <button type="button" className="proof-expand" aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={14}/>:<Maximize2 size={14}/>} {expanded?'Compact preview':'Expand image'}</button>
     </div>:e.proof?<div className="proof-empty"><Image size={23}/><strong>Receipt preview unavailable</strong>
      <button className="btn" disabled={refreshing} onClick={async()=>{
       setRefreshing(true);setReceiptError('');
       try{await w.refresh();setFailedUrl('')}catch{setReceiptError('Could not refresh the receipt. Please try again.')}finally{setRefreshing(false)}
      }}>{refreshing?'Refreshing…':'Reload receipt'}</button>{receiptError&&<p role="alert">{receiptError}</p>}
     </div>:<div className="proof-empty"><Image size={25}/><strong>No receipt attached</strong>{admin&&<button type="button" className="btn" onClick={edit}>Attach receipt<ArrowUpRight size={13}/></button>}</div>}
    </section>
    <div className="transaction-disclaimer"><ShieldCheck size={16}/><p>{w.demo?'Sample transaction. ':''}Payment entries reduce pending dues; they never increase the expense total.</p></div>
   </div>
   <div className="transaction-footer">{admin?<><button type="button" className="btn detail-delete" disabled={busy} onClick={async()=>{setBusy(true);try{await remove()}finally{setBusy(false)}}}><Trash2 size={15}/>{busy?'Deleting…':'Delete'}</button><button type="button" className="btn primary" disabled={busy} onClick={edit}><Pencil size={15}/>Edit expense</button></>:<button type="button" className="btn full" onClick={close}>Close details</button>}</div>
  </motion.section>
 </motion.div></ModalPortal>
}
