import {PaymentProof} from '../data';
export const maxPaymentImages=5;
export const maxPaymentImageBytes=5*1024*1024;
export const paymentImageTypes=['image/jpeg','image/png','image/webp'];
export function validatePaymentFiles(files:Pick<File,'name'|'type'|'size'>[],existingCount:number){
 if(existingCount+files.length>maxPaymentImages)throw new Error(`You can attach up to ${maxPaymentImages} images to one payment.`);
 for(const file of files){if(!paymentImageTypes.includes(file.type))throw new Error(`${file.name}: choose a JPG, PNG or WebP image.`);if(file.size<=0||file.size>maxPaymentImageBytes)throw new Error(`${file.name}: choose a non-empty image up to 5 MB.`)}
}
export function paymentImagePaths(proofs:PaymentProof[]=[]){return proofs.flatMap(p=>p.path?[p.path]:[])}

export function visiblePaymentProofs(proofs:PaymentProof[]|undefined,admin:boolean){
 const images=proofs??[];
 return admin?images:images.filter(image=>image.is_public===true);
}

export function proofDownloadUrl(proof:PaymentProof){
 if(!proof.path||!proof.url||proof.url.startsWith('data:'))return proof.url;
 const url=new URL(proof.url);
 url.searchParams.set('download',proof.name);
 return url.href;
}
