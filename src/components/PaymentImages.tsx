import {useRef,useState} from 'react';
import {Download,Image,X} from 'lucide-react';
import {motion,useReducedMotion} from 'framer-motion';
import type {PaymentProof} from '../data';
import {proofDownloadUrl} from '../lib/payment-images';

export default function PaymentImages({proofs,date}:{proofs:PaymentProof[];date:string}){
 const [expanded,setExpanded]=useState<PaymentProof>();
 const reduced=useReducedMotion();
 const [failed,setFailed]=useState<string[]>([]);
 const trigger=useRef<HTMLButtonElement|null>(null);
 const selected=expanded&&proofs.find(proof=>proof.name===expanded.name&&proof.path===expanded.path&&proof.clientId===expanded.clientId);
 const canPreview=(proof:PaymentProof)=>Boolean(proof.url&&!failed.includes(proof.url));
 const markFailed=(url:string)=>setFailed(list=>list.includes(url)?list:[...list,url]);

 return <div className="payment-saved-images">
  <div className="payment-image-label"><Image size={14} aria-hidden="true"/>{proofs.length} {proofs.length===1?'image':'images'} attached to this payment</div>
  <div className="payment-image-thumbnails">
   {proofs.map((proof,index)=><div key={proof.path||proof.clientId||proof.id||index}>
    <button type="button" className="payment-image-thumb" aria-label={`Preview ${proof.name} for payment on ${date}`}
     aria-expanded={selected===proof} onClick={event=>{trigger.current=event.currentTarget;setExpanded(selected===proof?undefined:proof)}}>
     {canPreview(proof)?<img src={proof.url} alt={`Payment image ${index+1} on ${date}`} loading="lazy" onError={()=>markFailed(proof.url)}/>:<Image size={22} aria-hidden="true"/>}
    </button>
    <span title={proof.name}>{proof.name}</span>
   </div>)}
  </div>
  {selected&&<motion.div className="payment-image-expanded" initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}}
   transition={{duration:reduced?0:.2,ease:'easeOut'}}>
   <div><strong>{selected.name}</strong>
    {selected.url&&<a className="icon-btn" href={proofDownloadUrl(selected)} download={selected.name} aria-label="Download payment image"><Download size={14}/></a>}
    <button className="icon-btn" type="button" aria-label="Close image preview" onClick={()=>{setExpanded(undefined);trigger.current?.focus({preventScroll:true})}}><X size={14}/></button>
   </div>
   {canPreview(selected)?<img src={selected.url} alt={`Expanded payment image on ${date}`} onError={()=>markFailed(selected.url)}/>:
    <p className="muted">Preview unavailable. Refresh the project to reload the image.</p>}
  </motion.div>}
 </div>;
}
