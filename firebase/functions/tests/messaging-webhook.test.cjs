const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
process.env.TELNYX_PUBLIC_KEY=publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64');
const functions=require('../index.js'),{getFirestore}=require('firebase-admin/firestore');
const {recipientId}=require('../messaging-policy.cjs'),db=getFirestore();
const tenantId='sms-webhook-tenant',locationId='sms-test-location',sender='+19365550123',recipient='+12025550123',profile='sms-test-profile';
async function invoke(body,tampered=false) {
 const rawBody=Buffer.from(JSON.stringify(body)),timestamp=String(Math.floor(Date.now()/1000));
 const signature=crypto.sign(null,Buffer.concat([Buffer.from(timestamp+'|'),rawBody]),privateKey).toString('base64');
 const state={status:200,body:null},listeners=new Map();
 const request={method:'POST',rawBody:tampered?Buffer.from('{}'):rawBody,get(name){return name==='telnyx-timestamp'?timestamp:name==='telnyx-signature-ed25519'?signature:'';}};
 const response={locals:{},on(name,fn){listeners.set(name,fn);return this;},setHeader(){},getHeader(){},status(code){state.status=code;return this;},send(value){state.body=value;listeners.get('finish')?.();return this;}};
 await functions.telnyxMessagingWebhook(request,response);return state;
}
test.before(async()=>{
 await Promise.all([
  db.doc(`tenants/${tenantId}`).set({environment:'production',demo:false}),db.doc(`ghlLocationTenants/${locationId}`).set({tenantId}),
  db.doc(`gmsProviderConnections/${tenantId}`).set({locationId,sms:{providerId:'gms-provider',messagingProfileId:profile}}),
  db.doc(`gmsMessagingNumbers/${recipientId(sender)}`).set({tenantId,locationId,messagingProfileId:profile}),
 ]);
});
test('signed STOP replies revoke consent once and preserve one GHL reply event',async()=>{
 const body={data:{id:'sms-stop-event',event_type:'message.received',payload:{id:'sms-reply',text:'STOP',messaging_profile_id:profile,from:{phone_number:recipient},to:[{phone_number:sender}]}}};
 assert.equal((await invoke(body,true)).status,401);
 assert.equal((await invoke(body)).status,200);assert.equal((await invoke(body)).status,200);
 assert.equal((await db.doc(`gmsMessagingConsents/${tenantId}/recipients/${recipientId(recipient)}`).get()).data().status,'opted_out');
 assert.equal((await db.collection('gmsGhlMessageUpdates').where('tenantId','==',tenantId).get()).size,1);
});
test('early delivery reports retry until binding exists and final statuses cannot regress',async()=>{
 const payload={id:'sms-provider-message',messaging_profile_id:profile,from:{phone_number:sender},to:[{phone_number:recipient,status:'delivered'}]};
 assert.equal((await invoke({data:{id:'sms-early-event',event_type:'message.finalized',payload}})).status,503);
 await db.doc('gmsSmsDeliveryJobs/sms-test-job').set({status:'sent'});
 await db.doc('gmsTelnyxMessageBindings/sms-provider-message').set({jobPath:'gmsSmsDeliveryJobs/sms-test-job',tenantId,locationId,messageId:'ghl-message',from:sender,to:recipient,messagingProfileId:profile});
 assert.equal((await invoke({data:{id:'sms-delivered-event',event_type:'message.finalized',payload}})).status,200);
 assert.equal((await invoke({data:{id:'sms-stale-event',event_type:'message.sent',payload:{...payload,to:[{phone_number:recipient,status:'sent'}]}}})).status,200);
 assert.equal((await db.doc('gmsSmsDeliveryJobs/sms-test-job').get()).data().status,'delivered');
});
