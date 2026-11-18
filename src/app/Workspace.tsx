import {createContext,useContext,useEffect,useState,ReactNode} from 'react';
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
 async function refresh(){return query.refetch({throwOnError:true})}
 function requireAdmin(){if(!admin)throw new Error('Only the administrator can change records')}
 const value:Context={data:query.data,admin,demo,configured,loading:!ready||query.isLoading,error:query.error,refresh,togglePreview:()=>{if(demo)setPreviewAdmin(a=>!a)},
 async saveExpense(p,old,key){requireAdmin();if(!demo&&p.items?.some(i=>i.roundToRupee)&&!query.data?.wholeRupeeRounding)throw new Error('Whole-rupee pricing is not enabled for this project yet. Contact the administrator.');if(!demo&&(p.items?.length||0)>1&&query.data?.schemaVersion!==2)throw new Error('Multiple materials are not enabled for this project yet. Contact the administrator.');const result=await(demo?saveDemoExpense(p,old,key):api.saveExpense(p,old,key));await refresh();return result},
 async saveRecord(kind,p,key){requireAdmin();const result=await(demo?saveDemoRecord(kind,p,key):api.saveRecord(kind,p,key));await refresh();return result},
 async remove(kind,id,path){requireAdmin();await(demo?removeDemoRecord(kind,id):api.removeRecord(kind,id,path));await refresh()},
 async signOut(){if(demo){setPreviewAdmin(false);return}if(supabase){await supabase.auth.signOut();setSession(null);cache.clear()}}
 };return <Workspace.Provider value={value}>{children}</Workspace.Provider>
}
