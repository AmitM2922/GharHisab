import {supabase} from '../lib/supabase';
import {Expense,PaymentProof} from '../data';
import {Snapshot} from '../types';
import {maxPaymentImages,paymentImagePaths,paymentImageTypes,maxPaymentImageBytes,visiblePaymentProofs} from '../lib/payment-images';
export function check<T>({data,error}:{data:T;error:{message:string;code?:string}|null}):T{if(error)throw Object.assign(new Error(error.message),{code:error.code});return data}
export async function readSnapshot():Promise<Snapshot>{
 const snapshot=check(await supabase!.rpc('app_snapshot')) as Snapshot;
 const receipts=snapshot.expenses.flatMap(e=>e.proof?[e.proof]:[]);
 const paymentProofs=snapshot.payments.flatMap(payment=>visiblePaymentProofs(payment.proofs,snapshot.admin));
 const proofs=[...receipts,...paymentProofs];
 const paths=[...new Set(paymentImagePaths(proofs))];
 if(paths.length){
  const {data}=await supabase!.storage.from('receipts').createSignedUrls(paths,300);
  const urls=new Map(data?.map(({path,signedUrl})=>[path,signedUrl]));
  for(const proof of proofs)if(proof.path)proof.url=urls.get(proof.path)||'';
 }
 return snapshot;
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
async function savePayment(p:Record<string,unknown>,key:string,snapshot?:Snapshot){
 const proofs=(p.proofs||[]) as PaymentProof[];
 if(proofs.length>maxPaymentImages)throw new Error(`Attach up to ${maxPaymentImages} images per payment.`);
 const old=snapshot?.payments.find(payment=>payment.id===p.id);
 const uploaded:string[]=[],metadata:{path:string;name:string;type:string;is_public?:boolean}[]=[];
 try{
  for(let index=0;index<proofs.length;index++){
   const proof=proofs[index];let path=proof.path;
   if(proof.url.startsWith('data:')){
    const blob=await fetch(proof.url).then(r=>r.blob());
    if(!paymentImageTypes.includes(blob.type)||blob.size<=0||blob.size>maxPaymentImageBytes)throw new Error('Payment images must be JPG, PNG or WebP files up to 5 MB.');
    const auth=await supabase!.auth.getUser();if(auth.error||!auth.data.user)throw new Error('Please sign in again');
    path=`${auth.data.user.id}/payments/${key}/${proof.clientId||index}`;
    const result=await supabase!.storage.from('receipts').upload(path,blob,{contentType:blob.type,upsert:false});
    if(result.error&&String((result.error as {statusCode?:string}).statusCode)!=='409')throw new Error(result.error.message);
    if(!result.error)uploaded.push(path);
   }
   if(!path)throw new Error('Image is missing. Select it again before saving.');
   metadata.push({path,name:proof.name,type:proof.type,...(snapshot?.publicPaymentReceipts?{is_public:proof.is_public===true}:{})});
  }
  const {proofs:_proofs,...fields}=p;
  const id=check(await supabase!.rpc('save_payment',{p:{...fields,proofs:metadata},request_id:key}));
  const removed=paymentImagePaths(old?.proofs).filter(path=>!metadata.some(proof=>proof.path===path));
  if(removed.length)await supabase!.storage.from('receipts').remove(removed);
  return id;
 }catch(error){
  // A transport error can follow a successful commit. Preserve private objects
  // unless PostgreSQL definitively rejected the transaction.
  if(uploaded.length&&error instanceof Error&&'code' in error&&/^[0-9A-Z]{5}$/.test(String(error.code)))await supabase!.storage.from('receipts').remove(uploaded);
  throw error;
 }
}
export async function saveRecord(kind:string,p:Record<string,unknown>,key:string,snapshot?:Snapshot){
 if(kind==='payments'&&snapshot?.paymentAttachments)return savePayment(p,key,snapshot);
 return check(await supabase!.rpc(kind==='payments'?'save_payment':'save_record',kind==='payments'?{p,request_id:key}:{kind,p,request_id:key}));
}
export async function removeRecord(kind:string,id:string,paths:string[]=[]){
 check(await supabase!.rpc('delete_record',{kind,record_id:id}));
 if(paths.length)await supabase!.storage.from('receipts').remove([...new Set(paths)]);
}
