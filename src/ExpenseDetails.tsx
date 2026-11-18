import {useRef,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowDownLeft,X,Receipt,CalendarDays,Building2,CreditCard,Package,Check,Clock3,Pencil,Trash2,LockKeyhole,Image,Maximize2,Minimize2,Download,ShieldCheck,Copy,HardHat,FileText,ArrowUpRight} from 'lucide-react';
import {format} from 'date-fns';
import ModalPortal from './components/ModalPortal';
import MaterialBreakdown from './components/MaterialBreakdown';
import Payments from './components/Payments';
import {paymentProgress} from './lib/accounting';
import {materialLines} from './lib/materials';
import {useWorkspace} from './app/Workspace';
import {Expense,money,status} from './data';
import {useDialog} from './useDialog';

export default function ExpenseDetails({expense:e,admin,close,edit,remove}:{expense:Expense;admin:boolean;close:()=>void;edit:()=>void;remove:()=>void|Promise<void>}){
 const w=useWorkspace(),reduced=useReducedMotion();
 const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[copyMessage,setCopyMessage]=useState(''),[active,setActive]=useState('Overview'),[receiptError,setReceiptError]=useState('');
 const overview=useRef<HTMLDivElement>(null),payments=useRef<HTMLDivElement>(null),receipt=useRef<HTMLElement>(null);
 useDialog(true,()=>{if(!busy)close()});
 const {pending:due,percentage:percent,label:progressLabel}=paymentProgress(e.amount,e.paid);
 const categoryIcon=e.category==='Materials'?<Package size={25}/>:e.category==='Contractor costs'?<HardHat size={25}/>:<Receipt size={25}/>;
 const jump=(name:string)=>{setActive(name);const node=name==='Payments'?payments.current:name==='Receipt'?receipt.current:overview.current;node?.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'})};
 const reference=e.id.startsWith('GH-')?e.id:e.id.slice(0,8).toUpperCase();

 return <ModalPortal><motion.div className="overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>{if(!busy)close()}}>
  <motion.section className="drawer transaction-drawer polished-expense" role="dialog" aria-modal="true" aria-label="Transaction details" initial={{x:80}} animate={{x:0}} exit={{x:80}} transition={{type:'spring',damping:30,stiffness:300}} onClick={event=>event.stopPropagation()}>
   <div className="transaction-header"><div className="expense-drawer-heading"><span><Receipt size={18}/></span><div><strong>Expense details</strong><small>Every detail, accounted for.</small></div></div><button className="icon-btn" aria-label="Close transaction details" disabled={busy} onClick={close}><X size={18}/></button></div>
   <nav className="expense-section-nav" aria-label="Expense detail sections">{[{name:'Overview',icon:FileText},{name:'Payments',icon:CreditCard},{name:'Receipt',icon:Image}].map(({name,icon:Icon})=><button type="button" key={name} className={active===name?'active':''} aria-pressed={active===name} onClick={()=>jump(name)}><Icon size={15}/>{name}</button>)}</nav>
   <div className="transaction-body">
    <div ref={overview} className="expense-detail-anchor">
     <div className="transaction-id"><span>REF · {reference}</span><span className={'badge '+status(e).replace(' ','-').toLowerCase()}><i/>{status(e)}</span></div>
     <div className="transaction-title"><span className="transaction-category-icon">{categoryIcon}</span><div><span className="eyebrow">{e.category}</span><h2>{e.title}</h2></div></div>
     <section className="transaction-amount"><div className="amount-heading"><span>INVOICE AMOUNT</span><span className="currency-label">INR</span></div><h3>{money(e.amount)}</h3><div className="amount-meta"><span><CalendarDays size={13}/>{format(new Date(e.date+'T12:00:00'),'d MMM yyyy')}</span><span><Building2 size={13}/>{e.vendor}</span></div></section>
     <section className="payment-breakdown"><div className="detail-section-title"><h3>Payment summary</h3><span className={due>0?'pending-progress-label':''}>{progressLabel}</span></div><div className="payment-duo"><div><span className="paid-icon"><ArrowDownLeft size={15}/></span><small>Amount paid</small><strong>{money(e.paid)}</strong></div><div className={due===0?'balance-cleared':''}><span className="due-icon">{due>0?<Clock3 size={15}/>:<Check size={15}/>}</span><small>Pending dues</small><strong>{money(due)}</strong></div></div><div className="payment-progress"><motion.i initial={{width:0}} animate={{width:`${percent}%`}} transition={{duration:.55}}/></div><p className="payment-status-message">{due>0?<Clock3 size={12}/>:<Check size={12}/>} {due>0?`${money(due)} remaining on this invoice.`:'All settled. This invoice is paid in full.'}</p></section>
     <section className="transaction-section expense-info-section"><div className="detail-section-title"><h3>Expense information</h3>{admin&&<button type="button" className="inline-edit" onClick={edit}><Pencil size={12}/>Edit</button>}</div><dl className="expense-info-grid"><div><dt><Building2 size={14}/>Vendor / contractor</dt><dd>{e.vendor}</dd></div><div><dt><CreditCard size={14}/>Payment method</dt><dd><span className="method-pill">{e.method}</span></dd></div><div><dt><CalendarDays size={14}/>Expense date</dt><dd>{format(new Date(e.date+'T12:00:00'),'dd MMM yyyy')}</dd></div><div><dt><Package size={14}/>Category</dt><dd>{e.category}{e.category==='Materials'?` · ${materialLines(e).length} ${materialLines(e).length===1?'item':'items'}`:''}</dd></div><div className="expense-full-reference"><dt><FileText size={14}/>Transaction ID</dt><dd><span>{e.id}</span><button className="icon-btn" type="button" aria-label="Copy transaction ID" onClick={async()=>{try{await navigator.clipboard.writeText(e.id);setCopyMessage('Transaction ID copied.')}catch{setCopyMessage('Select and copy the transaction ID shown here.')}}}><Copy size={13}/></button></dd>{copyMessage&&<small role="status">{copyMessage}</small>}</div>{e.created_at&&<div className="expense-created"><dt>Created</dt><dd>{format(new Date(e.created_at),'dd MMM yyyy, h:mm a')}</dd></div>}</dl><MaterialBreakdown expense={e}/></section>
     {e.description&&<section className="expense-note"><div><FileText size={15}/><h3>Description</h3></div><p>{e.description}</p></section>}
     {admin&&e.notes&&<section className="expense-note private"><div><LockKeyhole size={15}/><h3>Private notes</h3><span>Only you</span></div><p>{e.notes}</p></section>}
    </div>
    <div ref={payments} className="expense-detail-anchor"><Payments expense={e}/></div>
    <section ref={receipt} className="transaction-section proof-section expense-detail-anchor"><div className="detail-section-title"><h3>Receipt & payment proof</h3><span className="private-tag"><LockKeyhole size={10}/>Admin only</span></div>
     {admin&&e.proof?.url?<><div className="proof-file"><span><Image size={17}/></span><div><strong>{e.proof.name}</strong><small>{w.demo?'Session attachment · private':'Secure attachment · private'}</small></div><a className="icon-btn" href={e.proof.url} download={e.proof.name} aria-label="Download payment proof"><Download size={15}/></a></div><div className={expanded?'proof-image expanded':'proof-image'}><img src={e.proof.url} alt={`Payment proof for ${e.title}`}/></div><button type="button" className="proof-expand" onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={13}/>:<Maximize2 size={13}/>} {expanded?'Compact preview':'Expand image'}</button></>:admin&&e.proof?<div className="proof-empty"><LockKeyhole size={23}/><strong>Receipt preview unavailable</strong><p>Your attachment is still linked to this expense. Refresh to request access again.</p><button className="btn" onClick={async()=>{setReceiptError('');try{await w.refresh()}catch{setReceiptError('Could not refresh the receipt. Please try again.')}}}>Refresh receipt</button>{receiptError&&<p role="alert">{receiptError}</p>}</div>:<div className="proof-empty">{admin?<Image size={25}/>:<LockKeyhole size={25}/>}<strong>{admin?'Keep the proof with the payment':'Private attachments'}</strong><p>{admin?'Add an invoice photo or UPI / bank payment screenshot to this expense.':'Receipts and payment screenshots are visible only to the administrator.'}</p>{admin&&<button type="button" className="btn" onClick={edit}>Attach receipt<ArrowUpRight size={13}/></button>}</div>}
    </section>
    <div className="transaction-disclaimer"><ShieldCheck size={16}/><p>{w.demo?'Sample transaction. ':''}Payment entries reduce pending dues; they never increase the expense total.</p></div>
   </div>
   <div className="transaction-footer">{admin?<><button type="button" className="btn detail-delete" disabled={busy} onClick={async()=>{setBusy(true);try{await remove()}finally{setBusy(false)}}}><Trash2 size={15}/>{busy?'Deleting…':'Delete'}</button><button type="button" className="btn primary" disabled={busy} onClick={edit}><Pencil size={15}/>Edit expense</button></>:<button type="button" className="btn full" onClick={close}>Close details</button>}</div>
  </motion.section>
 </motion.div></ModalPortal>
}
