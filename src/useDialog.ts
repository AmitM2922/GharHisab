import {useEffect,useRef} from 'react';
let locks=0,originalOverflow='';
export function useDialog(active:boolean,onClose:()=>void){
 const callback=useRef(onClose);callback.current=onClose;
 useEffect(()=>{if(!active)return;const previous=document.activeElement as HTMLElement|null;if(locks++===0){originalOverflow=document.body.style.overflow;document.body.style.overflow='hidden'}
 const allDialogs=()=>Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));const dialog=allDialogs().at(-1);
 const nodes=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(e=>e.getClientRects().length>0);
 nodes()[0]?.focus();const key=(e:KeyboardEvent)=>{if(allDialogs().at(-1)!==dialog)return;if(e.key==='Escape'){e.preventDefault();callback.current()}if(e.key==='Tab'){const all=nodes(),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',key);
 return()=>{if(--locks===0)document.body.style.overflow=originalOverflow;document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus()}
 },[active]);
}
