import {seed,Expense} from '../data';
import {Snapshot} from '../types';
import {purchaseAmount,roundMoney,sumMoney} from '../lib/accounting';
const vendors=[...new Set(seed.map(e=>e.vendor))].map((name,i)=>({id:'v'+i,name,business:'',categories:''}));
const materials=[...new Set(seed.filter(e=>e.material).map(e=>e.material+'|'+e.unit))].map((m,i)=>({id:'m'+i,name:m.split('|')[0],unit:m.split('|')[1],category:m.split('|')[0]}));
const expenses=seed.map(e=>({...e,version:1,is_public:true,vendorId:vendors.find(v=>v.name===e.vendor)!.id,materialId:materials.find(m=>m.name===e.material&&m.unit===e.unit)?.id}));
let store:Snapshot={admin:true,expenses,vendors,materials,consumption:materials.map((m,i)=>({id:'u'+i,material_id:m.id,date:'2026-11-17',quantity:({Cement:215,Steel:1520,Sand:6,Bricks:11500,Aggregate:3,Electrical:0} as Record<string,number>)[m.name]||0,location:'Site work'})).filter(c=>c.quantity>0),project:{id:'project',name:'Our dream home',description:'A family home built with care, one brick at a time.',start_date:'2026-08-05',completion_date:'2027-06-30',stage:'Walls',completed_stages:['Planning','Foundation','Plinth']},contributions:[{id:'c1',name:'Amit',date:'2026-08-01',amount:250000},{id:'c2',name:'Family member',date:'2026-09-01',amount:150000},{id:'c3',name:'Amit',date:'2026-10-01',amount:150000},{id:'c4',name:'Family member',date:'2026-11-01',amount:100000}],payments:expenses.filter(e=>e.paid>0).map(e=>({id:crypto.randomUUID(),expense_id:e.id,date:e.date,amount:e.paid,method:e.method})),activity:[]};
export const readDemo=()=>structuredClone(store);
const keys=new Map<string,string>();
function commit(next:Snapshot,kind:string,id:string,action:string){
 for(const m of next.materials){const purchased=next.expenses.filter(e=>e.materialId===m.id).reduce((s,e)=>s+e.quantity,0);const used=next.consumption.filter(c=>c.material_id===m.id).reduce((s,c)=>s+c.quantity,0);if(used>purchased+.000001)throw new Error('Consumption exceeds available stock. Correct usage before reducing a purchase.')}
 for(const e of next.expenses){e.paid=sumMoney(next.payments.filter(p=>p.expense_id===e.id).map(p=>p.amount));if(e.paid>e.amount)throw new Error('Payment exceeds the invoice amount')}
 next.activity.unshift({id:crypto.randomUUID(),table_name:kind,record_id:id,action,created_at:new Date().toISOString(),before_data:null,after_data:null});store=next;
}
export async function saveDemoExpense(input:Omit<Expense,'id'>,existing:Expense|null,key:string){
 if(!existing&&keys.has(key))return keys.get(key)!;
 const next=readDemo();const id=existing?.id||crypto.randomUUID();let vendor=next.vendors.find(v=>v.name.toLowerCase()===input.vendor.trim().toLowerCase());if(!vendor){vendor={id:crypto.randomUUID(),name:input.vendor.trim(),business:'',categories:''};next.vendors.push(vendor)}
 let material=next.materials.find(m=>m.name===input.material&&m.unit===input.unit);if(input.category==='Materials'&&!material){material={id:crypto.randomUUID(),name:input.material,unit:input.unit,category:input.material};next.materials.push(material)}
 const amount=input.category==='Materials'?purchaseAmount(input.quantity,input.rate):roundMoney(input.rate);
 const entry={...input,amount,id,vendorId:vendor.id,materialId:input.category==='Materials'?material?.id:undefined,version:(existing?.version||0)+1};
 next.expenses=existing?next.expenses.map(e=>e.id===id?entry:e):[entry,...next.expenses];
 if(!existing&&input.paid>0)next.payments.push({id:crypto.randomUUID(),expense_id:id,date:input.date,amount:input.paid,method:input.method});
 commit(next,'expenses',id,existing?'UPDATE':'INSERT');keys.set(key,id);return id;
}
export async function saveDemoRecord(kind:string,p:Record<string,unknown>,key:string){
 if(!p.id&&keys.has(key))return keys.get(key)!;const next=readDemo();const id=String(p.id||crypto.randomUUID());
 const collection=kind==='material_consumption'?'consumption':kind;
 if(kind==='project_settings')next.project={...next.project,...p} as Snapshot['project'];
 else{
 const items=next[collection as 'contributions'] as unknown as Record<string,unknown>[];
 if(!items)throw new Error('Unknown record type');
 const item={...p,id};const index=items.findIndex(r=>r.id===id);if(index<0)items.push(item);else items[index]=item;
 if(kind==='vendors')for(const e of next.expenses)if(e.vendorId===id)e.vendor=String(p.name);
 if(kind==='materials')for(const e of next.expenses)if(e.materialId===id)e.material=String(p.name);
 }commit(next,kind,id,p.id?'UPDATE':'INSERT');keys.set(key,id);return id;
}
export async function removeDemoRecord(kind:string,id:string){const next=readDemo();const collection=kind==='material_consumption'?'consumption':kind;
 if(kind==='vendors'&&next.expenses.some(e=>e.vendorId===id))throw new Error('Vendor has transactions and cannot be deleted.');
 if(kind==='materials'&&(next.expenses.some(e=>e.materialId===id)||next.consumption.some(e=>e.material_id===id)))throw new Error('Material has records and cannot be deleted.');
 (next as unknown as Record<string,unknown>)[collection]=(next[collection as 'expenses'] as {id:string}[]).filter(r=>r.id!==id);
 if(kind==='expenses')next.payments=next.payments.filter(p=>p.expense_id!==id);commit(next,kind,id,'DELETE');}
