import {supabase} from '../lib/supabase';
import {Expense} from '../data';
import {Snapshot} from '../types';
export function check<T>({data,error}:{data:T;error:{message:string;code?:string}|null}):T{if(error)throw Object.assign(new Error(error.message),{code:error.code});return data}
export async function readSnapshot():Promise<Snapshot>{
 const snapshot=check(await supabase!.rpc('app_snapshot')) as Snapshot;
 if(snapshot.admin)await Promise.all(snapshot.expenses.filter(e=>e.proof?.path).map(async e=>{
 const response=await supabase!.storage.from('receipts').createSignedUrl(e.proof!.path!,300,{download:e.proof!.name});
 if(!response.error)e.proof!.url=response.data.signedUrl;
 }));return snapshot;
}
export async function saveExpense(input:Omit<Expense,'id'>,existing:Expense|null,key:string){
 let uploaded:string|undefined;
 let proof=input.proof?{path:input.proof.path,name:input.proof.name,type:input.proof.type}:null;
 if(input.proof?.url.startsWith('data:')){
 const blob=await fetch(input.proof.url).then(r=>r.blob());
 if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||blob.size>5*1024*1024)throw new Error('Receipt must be a JPG, PNG or WebP image up to 5 MB.');
 const auth=await supabase!.auth.getUser();const user=auth.data.user;if(auth.error||!user)throw new Error('Please sign in again');
 uploaded=`${user.id}/${crypto.randomUUID()}`;
 check(await supabase!.storage.from('receipts').upload(uploaded,blob,{contentType:blob.type,upsert:false}));
 proof={path:uploaded,name:input.proof.name,type:blob.type};
 }
 try{
 const {proof:_ignored,labour,...fields}=input;
 const id=check(await supabase!.rpc('save_expense',{p:{...fields,...labour,id:existing?.id,version:existing?.version,proof},request_id:key}));
 if(existing?.proof?.path&&existing.proof.path!==proof?.path)await supabase!.storage.from('receipts').remove([existing.proof.path]);
 return String(id);
 }catch(error){
 // A lost HTTP response may follow a successful commit. Only remove the newly
 // uploaded object when PostgreSQL explicitly confirms transaction rejection.
 if(uploaded&&error instanceof Error&&'code' in error&&/^[0-9A-Z]{5}$/.test(String(error.code)))await supabase!.storage.from('receipts').remove([uploaded]);
 throw error}
}
export async function saveRecord(kind:string,p:Record<string,unknown>,key:string){
 return check(await supabase!.rpc(kind==='payments'?'save_payment':'save_record',kind==='payments'?{p,request_id:key}:{kind,p,request_id:key}));
}
export async function removeRecord(kind:string,id:string,path?:string){
 check(await supabase!.rpc('delete_record',{kind,record_id:id}));
 if(path)await supabase!.storage.from('receipts').remove([path]);
}
