import {paymentImagePaths,visiblePaymentProofs} from '../lib/payment-images';
import {createContext,useContext,useEffect,useMemo,useState,ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import type {Session} from '@supabase/supabase-js';
import {Expense} from '../data';
import {Snapshot} from '../types';
import {configured,demo,supabase} from '../lib/supabase';
import * as api from '../services/workspace';
import {readDemo,saveDemoExpense,saveDemoRecord,removeDemoRecord} from '../services/demo';
type Context={data:Snapshot|undefined;admin:boolean;demo:boolean;configured:boolean;loading:boolean;error:Error|null;refresh:()=>Promise<unknown>;togglePreview:()=>void;saveExpense:(p:Omit<Expense,'id'>,old:Expense|null,key:string)=>Promise<unknown>;saveRecord:(kind:string,p:Record<string,unknown>,key:string)=>Promise<unknown>;remove:(kind:string,id:string,path?:string)=>Promise<void>;signOut:()=>Promise<void>};
const Workspace=createContext<Context>(null!);
export const useWorkspace=()=>useContext(Workspace);
export function WorkspaceProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(!supabase),[previewAdmin,setPreviewAdmin]=useState(true);const cache=useQueryClient();
 useEffect(()=>{if(!supabase)return;let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setReady(true)}});const {data}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);setReady(true)});return()=>{mounted=false;data.subscription.unsubscribe()}},[]);
 const query=useQuery({queryKey:['workspace',session?.user.id||'public',demo],enabled:ready&&(demo||configured),queryFn:demo?async()=>readDemo():api.readSnapshot,staleTime:20000,refetchInterval:60000,retry:1});
 const admin=demo?previewAdmin:!!session&&!!query.data?.admin;
 const data=useMemo(()=>{
  if(!demo||admin||!query.data)return query.data;
  const snapshot=query.data;
  const expenses=snapshot.expenses.filter(expense=>expense.is_public!==false);
  const visibleExpenseIds=new Set(expenses.map(expense=>expense.id));
  return {...snapshot,admin:false,expenses,
   contributions:snapshot.contributions.filter(contribution=>contribution.is_public!==false),
   payments:snapshot.payments.filter(payment=>visibleExpenseIds.has(payment.expense_id))
    .map(({reference:_reference,notes:_notes,version:_version,proofs,...payment})=>({...payment,proofs:visiblePaymentProofs(proofs,false)})),
  };
 },[admin,query.data]);
 async function refresh(){return query.refetch({throwOnError:true})}
 function requireAdmin(){if(!admin)throw new Error('Only the administrator can change records')}
 const value:Context={data,admin,demo,configured,loading:!ready||query.isLoading,error:query.error,refresh,togglePreview:()=>{if(demo)setPreviewAdmin(a=>!a)},
 async saveExpense(p,old,key){requireAdmin();if(!demo&&p.items?.some(i=>i.roundToRupee)&&!query.data?.wholeRupeeRounding)throw new Error('Whole-rupee pricing is not enabled for this project yet. Contact the administrator.');if(!demo&&(p.items?.length||0)>1&&query.data?.schemaVersion!==2)throw new Error('Multiple materials are not enabled for this project yet. Contact the administrator.');const result=await(demo?saveDemoExpense(p,old,key):api.saveExpense(p,old,key));await refresh().catch(()=>{});return result},
 async saveRecord(kind,p,key){requireAdmin();if(!demo&&kind==='payments'&&Array.isArray(p.proofs)&&p.proofs.length&&!query.data?.paymentAttachments)throw new Error('Payment images need a database update. Apply the payment_images migration in Supabase, then refresh this page.');const result=await(demo?saveDemoRecord(kind,p,key):api.saveRecord(kind,p,key,query.data));await refresh().catch(()=>{});return result},
 async remove(kind,id,path){requireAdmin();const paths=[...(path?[path]:[]),...paymentImagePaths(kind==='payments'?query.data?.payments.find(p=>p.id===id)?.proofs:undefined),...(kind==='expenses'?query.data?.payments.filter(p=>p.expense_id===id).flatMap(p=>paymentImagePaths(p.proofs))||[]:[])];await(demo?removeDemoRecord(kind,id):api.removeRecord(kind,id,paths));await refresh().catch(()=>{})},
 async signOut(){if(demo){setPreviewAdmin(false);return}if(supabase){await supabase.auth.signOut();setSession(null);cache.clear()}}
 };return <Workspace.Provider value={value}>{children}</Workspace.Provider>
}
