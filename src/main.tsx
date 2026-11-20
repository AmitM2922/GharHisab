import React,{useState,useEffect,useRef,useMemo,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,NavLink,useLocation,useNavigate} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AnimatePresence,motion,MotionConfig,useReducedMotion} from 'framer-motion';
import {LayoutDashboard,Receipt,Boxes,HardHat,Users,ChartNoAxesCombined,House,Plus,ChevronRight,Download,RefreshCw,X,Menu,ShieldCheck,Eye,CheckCircle2,Building2,LogOut,History,Ellipsis} from 'lucide-react';
import {Expense,money} from './data';
import ExpenseForm from './ExpenseForm';
import OverviewHighlights from './OverviewHighlights';
import HeaderTools from './HeaderTools';
import ExpenseDetails from './ExpenseDetails';
import LedgerHistory,{exportExpenseCsv} from './pages/LedgerHistory';
import {displayDate,historyLink} from './lib/history-filters';
import AuthDialog from './components/AuthDialog';
import {WorkspaceProvider,useWorkspace} from './app/Workspace';
import {dateRanges,inPeriod,totals} from './lib/accounting';
import './styles.css';
import './header-tools.css';
import './transactions.css';
import './mobile.css';
import './materials.css';
import './contributions.css';
import './expense-details.css';
import './payment-images.css';
import './ledger-theme.css';
import './paid-today.css';
import './redesign.css';
import {latestPayment,paymentsForExpenses,type PaymentEntry} from './lib/payment-ledger';
import {useKolkataDay,usePaymentArrivals} from './usePaidToday';
const Charts=lazy(()=>import('./charts'));
const FundingAnalytics=lazy(()=>import('./FundingAnalytics'));
const MaterialsPage=lazy(()=>import('./pages/Materials'));
const VendorsPage=lazy(()=>import('./pages/Vendors'));
const ProjectPage=lazy(()=>import('./pages/Project'));
const Reports=lazy(()=>import('./pages/Reports'));
const ActivityPage=lazy(()=>import('./pages/Activity'));
const nav=[['/','Overview',LayoutDashboard],['/expenses','Expense history',Receipt],['/materials','Materials',Boxes],['/contractors','Contractor costs',HardHat],['/vendors','Vendors',Users],['/reports','Reports & analytics',ChartNoAxesCombined],['/project','Project details',House]] as const;
function Loading(){return <div className="loading-view" role="status"><div className="skeleton title-skeleton"/><div className="loading-grid">{[1,2,3,4,5].map(i=><div className="skeleton card-skeleton" key={i}/>)}</div><div className="skeleton chart-skeleton"/><span>Loading your project…</span></div>}
function App(){
 const w=useWorkspace();const [auth,setAuth]=useState(false);let content:React.ReactNode;
 const path=useLocation().pathname;
 const history=path==='/expenses'||path==='/contractors';
 if(!w.demo&&!w.configured)content=<div className="setup-view"><span className="brand-icon"><House/></span><h1>GharHisab is ready to connect.</h1><p>Add your Supabase project URL and publishable key to your local environment to load real records. No sample figures are displayed in live mode.</p><p>Follow README.md. For a labeled local preview, set <code>VITE_DEMO_MODE=true</code> and restart Vite.</p></div>;
 else if(w.loading)content=history?<div className="setup-view" role="status"><h1>{path==='/expenses'?'Expense history':'Contractor costs'}</h1><p>Loading expense records…</p></div>:<Loading/>;
 else if(!w.data)content=<div className="setup-view" role="alert"><h1>{history?'We couldn’t load expense history.':'We couldn’t load your project.'}</h1><p>{w.error?.message||'Apply the database migration first.'}</p><button className="btn" onClick={()=>w.refresh().catch(()=>{})}>Try again</button></div>;
 else content=<AppContent onLogin={()=>setAuth(true)}/>;
 return <>{content}{auth&&<AuthDialog close={()=>setAuth(false)}/>}</>;
}

function AppContent({onLogin}:{onLogin:()=>void}){
 const w=useWorkspace(),data=w.data!,expenses=data.expenses,admin=w.admin,project=data.project;const path=useLocation().pathname;
 const navigate=useNavigate();
 const day=useKolkataDay(()=>{void w.refresh().catch(()=>{})});
 const [menu,setMenu]=useState(false),[modal,setModal]=useState(false),[selectedId,setSelectedId]=useState<string|null>(null),[editing,setEditing]=useState<Expense|null>(null);
 const [range,setRange]=useState('All time'),[toast,setToast]=useState(''),[refreshing,setRefreshing]=useState(false);
 const [selectedPaymentId,setSelectedPaymentId]=useState<string>();
 const toastTimer=useRef<ReturnType<typeof setTimeout>>();const selected=expenses.find(e=>e.id===selectedId)||null;const title=nav.find(n=>n[0]===path)?.[1]||(path==='/activity'?'Change history':'Overview');
 useEffect(()=>()=>clearTimeout(toastTimer.current),[]);useEffect(()=>{if(!admin){setModal(false);setEditing(null);setSelectedId(null)}},[admin]);useEffect(()=>{setMenu(false);window.scrollTo({top:0,behavior:'instant'})},[path]);
 useEffect(()=>{if(!menu)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false)};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape)},[menu]);
 const notify=(s:string)=>{clearTimeout(toastTimer.current);setToast(s);toastTimer.current=setTimeout(()=>setToast(''),5000)};
 const account=()=>{if(w.demo)w.togglePreview();else if(admin)w.signOut().catch(e=>notify(e.message));else onLogin()};
 const reduced=useReducedMotion();
 const entries=useMemo(()=>paymentsForExpenses(data.payments,expenses),[data.payments,expenses]);
 const todayEntries=useMemo(()=>entries.filter(({payment})=>payment.date===day).sort(latestPayment),[entries,day]);
 const arrivals=usePaymentArrivals(entries,day,path==='/',admin);
 const withinPeriod=inPeriod(range,day);
 const scoped=expenses.filter(e=>withinPeriod(e.date));
 const reportTotals=totals(scoped);
 const viewPending=()=>navigate(historyLink({status:'Pending dues'}));
 const viewSearch=(value:string)=>navigate(historyLink({q:value}));
 const refreshRecords=async()=>{
  if(refreshing)return;
  setRefreshing(true);
  try{await w.refresh();notify('Your project is up to date')}
  catch(error){notify(error instanceof Error?error.message:'Refresh failed')}
  finally{setRefreshing(false)}
 };
 const openExpense=(expense:Expense,paymentId?:string)=>{setSelectedPaymentId(paymentId);setSelectedId(expense.id)};
 const openPayment=({expense,payment}:PaymentEntry)=>openExpense(expense,payment.id);
 const openAdd=()=>{setEditing(null);setModal(true)};
 return <MotionConfig reducedMotion="user"><div className="app"><aside className={menu?'sidebar open':'sidebar'} aria-label="Main navigation"><a className="brand" href="#/"><span className="brand-icon"><House size={22}/></span><span className="brand-name">GharHisab</span></a><div className="project-switch"><span className="project-icon"><Building2 size={19}/></span><div><strong>{project.name}</strong><small>{project.stage}</small></div></div><nav>{nav.map(([url,label,Icon])=><NavLink end={url==='/'} to={url} key={url} onClick={()=>setMenu(false)}><Icon size={19}/>{label}</NavLink>)}{admin&&<NavLink to="/activity"><History size={19}/>Change history</NavLink>}</nav><div className="sidebar-bottom"><button className="profile" onClick={account}><span className="avatar">{admin?'AM':<Eye size={18}/>}</span><span><strong>{admin?'Administrator':'Public viewer'}</strong><small>{w.demo?'Switch preview role':admin?'Sign out':'Admin login'}</small></span><LogOut size={16}/></button></div></aside>{menu&&<button className="nav-shade" aria-label="Close navigation" onClick={()=>setMenu(false)}/>}
 <main>{w.demo&&<div className="demo-bar"><span>Demo mode<span className="demo-desc"> · Changes reset on reload</span></span><button onClick={account}><Eye size={14}/>{admin?'Preview as viewer':'Preview as admin'}</button></div>}
 <header className="app-topbar">
  <div className="breadcrumb">
   <button className="icon-btn mobile-menu" aria-label="Open navigation" aria-expanded={menu} onClick={()=>setMenu(true)}><Menu size={21}/></button>
   <span className="mobile-wordmark">GharHisab</span>
   <span className="desktop-crumb">Workspace</span><ChevronRight className="desktop-crumb" size={14} aria-hidden="true"/><strong className="desktop-crumb">{title}</strong>
  </div>
  <div className="topbar-meta">
   {!w.demo&&<div className="live-bar"><ShieldCheck size={15} aria-hidden="true"/><span>Live<span className="live-role"> project · {admin?'Administrator':'Public read-only view'}</span></span></div>}
   <HeaderTools expenses={expenses} admin={admin} toggleAdmin={account} openExpense={openExpense}/>
  </div>
 </header>
 <motion.div key={path} className="content" initial={reduced?false:{opacity:0,y:7}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.22,ease:'easeOut'}}><div className={path==='/'?'page-heading overview-page-heading':'page-heading'}><div className="page-heading-copy"><h1>{title}</h1><p className="project-label">{project.name}{path==='/'&&<> <span aria-hidden="true">/</span> <time dateTime={day}>{displayDate(day)}</time></>}</p></div><div className="heading-actions"><button className={'icon-btn refresh '+(refreshing?'spinning':'')} disabled={refreshing} aria-label="Refresh records" onClick={refreshRecords}><RefreshCw size={17}/></button>
 {path==='/reports'&&<label className="select-wrap"><CalendarIcon/><select aria-label="Date range" value={range} onChange={event=>setRange(event.target.value)}>{dateRanges.map(option=><option key={option}>{option}</option>)}</select></label>}{admin&&<button className="btn primary" onClick={openAdd}><Plus size={17}/>Add expense</button>}</div></div>
 <Suspense fallback={<Loading/>}>
 {path==='/'&&<><OverviewHighlights data={data} day={day} range={range} setRange={setRange} onPending={viewPending} entries={entries} todayEntries={todayEntries} arrivals={arrivals} openPayment={openPayment}/><FundingAnalytics expenses={scoped} admin={admin} range={range}/></>}
 {(path==='/expenses'||path==='/contractors')&&<LedgerHistory expenses={expenses} entries={entries} day={day} contractor={path==='/contractors'} demo={w.demo} admin={admin} error={w.error} open={openExpense} refresh={refreshRecords} notify={notify}/>}
 {path==='/reports'&&<>
  <div className="summary-row">
   <div><small>Amount paid</small><strong className="green-text">{money(reportTotals.paid)}</strong></div>
   <div><small>Invoice value</small><strong>{money(reportTotals.incurred)}</strong></div>
   <div><small>Pending payments</small><strong className="amber-text">{money(reportTotals.pending)}</strong></div>
   <button className="btn" onClick={()=>{exportExpenseCsv(scoped,w.demo);notify('Report downloaded')}}><Download size={16}/>Export CSV</button>
   <button className="btn" onClick={()=>window.print()}>Print report</button>
  </div>
  <Charts expenses={scoped} trend basis="incurred"/><Reports expenses={scoped} range={range}/>
 </>}
 {path==='/materials'&&<MaterialsPage view={viewSearch}/>}{path==='/vendors'&&<VendorsPage view={viewSearch}/>}{path==='/project'&&<ProjectPage/>}{path==='/activity'&&(admin?<ActivityPage/>:<div className="card empty">Change history is available only to the administrator.</div>)}
 </Suspense><footer><span><House size={13}/>GharHisab </span><span><ShieldCheck size={13}/>{w.demo?'Demo mode':admin?'Administrator':'Public read-only view'}</span></footer></motion.div></main>
 <nav className="mobile-bottom-nav" aria-label="Mobile navigation"><NavLink end to="/"><LayoutDashboard size={21}/><span>Home</span></NavLink><NavLink to="/expenses"><Receipt size={21}/><span>Expenses</span></NavLink>{admin&&<button className="mobile-add" onClick={openAdd} aria-label="Add expense"><Plus size={24}/><span>Add</span></button>}<NavLink to="/materials"><Boxes size={21}/><span>Materials</span></NavLink><button onClick={()=>setMenu(true)} aria-label="More pages"><Ellipsis size={23}/><span>More</span></button></nav>
 <AnimatePresence mode="wait">{modal&&admin?<ExpenseForm key={editing?.id||'new'} editing={editing} close={()=>{setModal(false);setEditing(null)}} save={async(input,key)=>{await w.saveExpense(input,editing,key);setModal(false);setEditing(null);notify('Expense saved.')}}/>:selected?<ExpenseDetails key={selected.id} expense={selected} paymentId={selectedPaymentId} admin={admin} onPaymentSaved={()=>notify('Payment saved.')} close={()=>setSelectedId(null)} edit={()=>{setEditing(selected);setSelectedId(null);setModal(true)}} remove={async()=>{if(confirm('Delete this expense and its payment records?')){try{await w.remove('expenses',selected.id,selected.proof?.path);setSelectedId(null);notify('Expense deleted')}catch(e){notify(e instanceof Error?e.message:'Delete failed')}}}}/>:null}</AnimatePresence><AnimatePresence>{toast&&<motion.div className="toast" role="status" key={toast} initial={{opacity:0,y:20,x:'-50%'}} animate={{opacity:1,y:0,x:'-50%'}} exit={{opacity:0,y:10,x:'-50%'}}><CheckCircle2 size={19}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={()=>{clearTimeout(toastTimer.current);setToast('')}}><X size={15}/></button></motion.div>}</AnimatePresence></div></MotionConfig>
}
function CalendarIcon(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>}
const queryClient=new QueryClient();
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><HashRouter><WorkspaceProvider><App/></WorkspaceProvider></HashRouter></QueryClientProvider></React.StrictMode>);
