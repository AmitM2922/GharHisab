import {useRef,useState} from 'react';
import {Eye,ImagePlus,LoaderCircle,Trash2,LockKeyhole,RefreshCw} from 'lucide-react';
import type {PaymentProof} from '../data';
import {maxPaymentImages,validatePaymentFiles} from '../lib/payment-images';

function readFile(file:File,isPublic:boolean):Promise<PaymentProof>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve({clientId:crypto.randomUUID(),name:file.name,type:file.type,url:String(reader.result),is_public:isPublic});
  reader.onerror=()=>reject(new Error(`Could not read ${file.name}. Try again.`));
  reader.readAsDataURL(file);
 });
}

type Props={
 proofs:PaymentProof[];
 change:(proofs:PaymentProof[])=>void;
 onBusy:(busy:boolean)=>void;
 canShare:boolean;
 shareNewImages:boolean;
};

export default function PaymentImagesUpload({proofs,change,onBusy,canShare,shareNewImages}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null),replacement=useRef<number|undefined>();

 async function select(files:File[]){
  if(!files.length||busy)return;
  setError('');
  const index=replacement.current;
  replacement.current=undefined;
  try{
   validatePaymentFiles(files,index===undefined?proofs.length:proofs.length-1);
   if(index!==undefined&&files.length!==1)throw new Error('Select one image to replace this attachment.');
   setBusy(true);
   onBusy(true);
   const isPublic=canShare&&(index===undefined?shareNewImages:proofs[index]?.is_public===true);
   const images=await Promise.all(files.map(file=>readFile(file,isPublic)));
   change(index===undefined?[...proofs,...images]:proofs.map((proof,i)=>i===index?images[0]:proof));
  }catch(error){setError(error instanceof Error?error.message:'Could not load the images.')}
  finally{setBusy(false);onBusy(false)}
 }

 function choose(index?:number){
  replacement.current=index;
  if(input.current){input.current.multiple=index===undefined;input.current.click()}
 }

 return <section className="payment-images-upload">
  <div className="upload-heading">
   <div><strong>Payment screenshots <span>Optional</span></strong>
    <p>{shareNewImages?'Viewers can see new images after you save this payment. You can turn sharing off for each image.':
     canShare?'Share individual images on public expenses.':'Public sharing requires the payment receipts database update.'}</p>
   </div>
   <span className="private-tag">{shareNewImages?<><Eye size={10}/>Shared by default</>:<><LockKeyhole size={10}/>Private by default</>}</span>
  </div>
  <input className="sr-only" ref={input} type="file" multiple={replacement.current===undefined}
   accept="image/jpeg,image/png,image/webp" aria-label="Upload payment images" disabled={busy}
   onChange={event=>{void select(Array.from(event.target.files||[]));event.target.value=''}}/>
  {proofs.length>0&&<div className="payment-upload-list">
   {proofs.map((proof,index)=><div className="payment-upload-item" key={proof.clientId||proof.path||proof.id||index}>
    {proof.url?<img src={proof.url} alt={`Selected payment image ${index+1}: ${proof.name}`}/>:
     <span className="payment-image-placeholder"><ImagePlus size={22}/></span>}
    <div>
     <strong>{proof.name}</strong><small>Image {index+1} of {proofs.length}</small>
     {canShare&&<label className="payment-image-share">
      <input type="checkbox" checked={proof.is_public===true} disabled={busy}
       aria-label={`Share ${proof.name} with public viewers`}
       onChange={event=>{
        const is_public=event.target.checked;
        change(proofs.map((item,i)=>i===index?{...item,is_public}:item));
       }}/>
      Share with public viewers
     </label>}
     <button type="button" disabled={busy} onClick={()=>choose(index)}><RefreshCw size={12}/>Replace</button>
    </div>
    <button type="button" className="icon-btn" aria-label={`Remove payment image ${index+1}`} disabled={busy}
     onClick={()=>{setError('');change(proofs.filter((_,i)=>i!==index))}}><Trash2 size={15}/></button>
   </div>)}
  </div>}
  <button type="button" className="payment-images-add" disabled={busy||proofs.length>=maxPaymentImages}
   onClick={()=>choose()} onDragOver={event=>event.preventDefault()}
   onDrop={event=>{event.preventDefault();replacement.current=undefined;void select(Array.from(event.dataTransfer.files))}}>
   {busy?<LoaderCircle size={21} className="spinning"/>:<ImagePlus size={21}/>}
   <span>{busy?'Preparing images…':proofs.length>=maxPaymentImages?'Image limit reached':'Add payment images'}
    <small>JPG, PNG, WebP · 5 MB each · {proofs.length}/{maxPaymentImages} images</small>
   </span>
  </button>
  {error&&<p role="alert" className="form-error">{error}</p>}
 </section>;
}
