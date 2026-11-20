import {automaticContributor,manualContributorNames,contributorName,contributionAllocation} from './lib/contributors';
import {useState} from 'react';
import {Plus,Users,Pencil,ChevronDown} from 'lucide-react';
import {Expense,money} from './data';
import {useWorkspace} from './app/Workspace';
import {inPeriod,today} from './lib/accounting';
import {displayDate} from './lib/history-filters';
import {Contribution} from './types';
import RecordEditor from './components/RecordEditor';

const colors=['var(--forest)','var(--accent-mid)','var(--accent-pale)'];
export default function FundingAnalytics({expenses,admin,range}:{expenses:Expense[];admin:boolean;range:string}){
 const w=useWorkspace();const records=w.data!.contributions;const [editing,setEditing]=useState<Contribution|null|undefined>();
 const current=inPeriod(range);
 const selected=records.filter(c=>current(c.date));
 const allocation=contributionAllocation(expenses,selected);const people=allocation.people;const total=allocation.allocated;

 return <>
 <section className="card contributions">
  <div className="section-heading"><h3>People’s contributions</h3>{admin&&<button className="btn contribution-add" onClick={()=>setEditing(null)} aria-label="Add contribution"><Plus size={14}/>Add</button>}</div>
  <div className="contribution-total"><span className="kpi-icon green"><Users size={19}/></span><div><small>Total allocated</small><strong>{money(total)}</strong></div></div>
  <div className="contribution-people">
   {total>0&&<div className="contribution-distribution" aria-hidden="true">{people.map((p,i)=>p.amount>0&&<span key={p.name} style={{flexGrow:p.amount,background:colors[i%colors.length]}}/>)}</div>}
   {people.map((p,i)=><div className="contributor" key={p.name}><div className="contributor-heading">
    <span className="avatar" style={{background:'var(--leaf)',color:'var(--forest-dark)'}}>{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>
    <strong>{p.name}{p.automatic&&<span className="automatic-share-tag">Automatic</span>}</strong><b>{money(p.amount)}</b><small>{total?(p.amount/total*100).toFixed(1):0}%</small>
   </div></div>)}
  </div>
  {allocation.excess>0&&<p className="contribution-surplus" role="status">{money(allocation.excess)} above paid expenses</p>}
  {selected.length>0&&<details className="contribution-history"><summary>Contribution history<ChevronDown size={15}/></summary>
   <div className="contribution-history-list">{[...selected].sort((a,b)=>b.date.localeCompare(a.date)).map(c=><div className="contribution-history-row" key={c.id}><span>{contributorName(c.name)}<small>{displayDate(c.date)}{contributorName(c.name)===automaticContributor?' · Excluded from shares':''}</small></span><strong>{money(c.amount)}</strong>{admin&&<button className="icon-btn" aria-label={"Edit "+c.name+"'s contribution on "+c.date} onClick={()=>setEditing(c)}><Pencil size={12}/></button>}</div>)}</div>
  </details>}
 </section>
 {editing!==undefined&&admin&&<RecordEditor title={editing?'Edit contribution':'Add contribution'} initial={editing?{...editing}:{date:today(),is_public:true}} fields={[{key:'name',label:'Contributor name',type:'select',options:[...manualContributorNames,...(editing&&!manualContributorNames.includes(editing.name)?[editing.name]:[])],required:true},{key:'date',label:'Contribution date',type:'date',required:true},{key:'amount',label:'Amount contributed (₹)',type:'number',min:.01,max:999999999,step:'.01',required:true},{key:'is_public',label:'Allow public viewers to see this contribution',type:'checkbox'}]} save={(p,key)=>w.saveRecord('contributions',p,key)} remove={editing?()=>w.remove('contributions',editing.id):undefined} close={()=>setEditing(undefined)}/>}</>
}
