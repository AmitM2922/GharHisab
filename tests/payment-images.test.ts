import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePaymentFiles,maxPaymentImageBytes,paymentImagePaths} from '../src/lib/payment-images';
test('payment image validation keeps multiple attachments bounded and private paths identifiable',()=>{
 const image={name:'payment.png',type:'image/png',size:100};
 assert.doesNotThrow(()=>validatePaymentFiles([image,image],3));
 assert.throws(()=>validatePaymentFiles([image,image],4),/5/);
 assert.throws(()=>validatePaymentFiles([{...image,type:'image/svg+xml'}],0),/JPG|PNG|WebP/);
 assert.throws(()=>validatePaymentFiles([{...image,size:maxPaymentImageBytes+1}],0),/5 MB/);
 assert.throws(()=>validatePaymentFiles([{...image,size:0}],0));
 assert.deepEqual(paymentImagePaths([{...image,url:'',path:'private/one'},{...image,url:'data:image/png'}]),['private/one']);
});
