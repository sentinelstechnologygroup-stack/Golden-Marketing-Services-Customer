const crypto=require('node:crypto');
const {onRequest}=require('firebase-functions/v2/https');
const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {defineSecret}=require('firebase-functions/params');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const policy=require('./messaging-policy.cjs');
const {verifySignature}=require('./telephony/providers.cjs');
const {selectOutboundNumber}=require('./telephony/readiness.cjs');
const {locationToken}=require('./gohighlevel-oauth-store.cjs');
const db=getFirestore(),key=defineSecret('TELNYX_API_KEY');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function client(tenantId,locationId) {
  const [owner,connection,tenant]=await Promise.all([db.doc(`ghlLocationTenants/${locationId}`).get(),db.doc(`gmsProviderConnections/${tenantId}`).get(),db.doc(`tenants/${tenantId}`).get()]);
  if(owner.data()?.tenantId!==tenantId || connection.data()?.locationId!==locationId || tenant.data()?.environment!=='production' || tenant.data()?.demo) throw new Error('Client messaging ownership is unavailable.');
  return connection.data();
}
async function context(input) {
  const owner=(await db.doc(`gmsProviderContactOwners/${input.locationId}/contacts/${input.contactId}`).get()).data();
  if(!owner?.tenantId || !owner.leadId) throw new Error('Contact is not linked to an authorized GMS lead.');
  const connection=await client(owner.tenantId,input.locationId);
  const lead=(await db.doc(`tenants/${owner.tenantId}/leads/${owner.leadId}`).get()).data();
  const consent=(await db.doc(`gmsMessagingConsents/${owner.tenantId}/recipients/${policy.recipientId(input.to)}`).get()).data();
  if(consent?.purpose==='GMS integration test SMS only') {
    const approval=(await db.doc(`gmsTestingApprovals/${owner.tenantId}`).get()).data();
    if(approval?.smsApproved!==true || approval.enabled!==true || approval.testRecipient!==input.to
      || !Number.isSafeInteger(connection.sms?.dailyBudgetMicrosUsd) || connection.sms.dailyBudgetMicrosUsd>approval.dailyBudgetMicrosUsd) throw new Error('Approved test recipient or spending limit did not match.');
  }
  const rows=await db.collection(`tenants/${owner.tenantId}/phoneNumbers`).where('brandId','==',lead?.brandId || '').get();
  const number=selectOutboundNumber(rows.docs.map(d=>d.data()),'telnyx',lead?.campaignId || lead?.campaign_id);
  const from=policy.maySend(consent,lead,number,connection.sms,input.to);
  if(!connection.oauthSecretId || !Array.isArray(connection.sms.approvedSmsBodies) || !connection.sms.approvedSmsBodies.includes(input.text)) throw new Error('Message content has not been approved.');
  return {tenantId:owner.tenantId,leadId:owner.leadId,brandId:lead.brandId,campaignId:lead.campaignId || lead.campaign_id || null,agentUid:lead.assignedTo || null,from,config:connection.sms};
}
exports.gmsSmsDeliveryWebhook=onRequest({maxInstances:2,timeoutSeconds:60},async(request,response)=>{
  response.set('Cache-Control','no-store');
  if(request.method!=='POST') return response.status(405).send('Method not allowed.');
  if(!policy.signedDelivery(request.rawBody,request.get('X-GHL-Signature'))) return response.status(401).send('Invalid signature.');
  if(process.env.GMS_MESSAGING_ENABLED!=='true') return response.status(503).send('Messaging has not been activated.');
  try {
    const input=policy.delivery(JSON.parse(request.rawBody.toString('utf8')));
    const jobRef=db.doc(`gmsSmsDeliveryJobs/${hash(input.locationId+':'+input.messageId)}`);
    const existing=(await jobRef.get()).data();
    if(existing) {
      if(existing.contactId!==input.contactId || existing.to!==input.to || existing.text!==input.text) throw new Error('Conflicting message identifier.');
      return response.status(202).send('Already accepted.');
    }
    const authorized=await context(input);
    const fingerprint=policy.messageFingerprint({...input,from:authorized.from});
    const count=policy.segments(input.text),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const budgetRef=db.doc(`gmsMessagingBudgets/${authorized.tenantId}/days/${day}`);
    await db.runTransaction(async tx=>{
      const [prior,budget]=await Promise.all([tx.get(jobRef),tx.get(budgetRef)]);
      if(prior.exists) {if(prior.data().fingerprint!==fingerprint) throw new Error('Conflicting message identifier.');return;}
      const reservation=policy.reserveBudget(authorized.config,budget.data(),count);
      tx.set(budgetRef,{...reservation,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      const {config,...attribution}=authorized;
      tx.create(jobRef,{...input,...attribution,messagingProfileId:config.messagingProfileId,providerId:config.providerId,fingerprint,segments:count,reservedMicrosUsd:count*config.costCeilingMicrosUsdPerSegment,costCeilingMicrosUsdPerSegment:config.costCeilingMicrosUsdPerSegment,status:'pending',createdAt:FieldValue.serverTimestamp()});
    });
    return response.status(202).send('Accepted.');
  } catch {return response.status(409).send('Message ownership, approval or configuration did not pass.');}
});
exports.processGmsSmsDelivery=onDocumentCreated({document:'gmsSmsDeliveryJobs/{jobId}',secrets:[key],maxInstances:2,timeoutSeconds:120,retry:true},async event=>{
  const ref=event.data.ref,job=(await ref.get()).data();
  if(!job || job.status!=='pending') return;
  if(process.env.GMS_MESSAGING_ENABLED!=='true') {await ref.update({status:'configuration_disabled'});return;}
  let authorized;
  try {
    authorized=await context(job);
    if(authorized.tenantId!==job.tenantId || authorized.from!==job.from || authorized.brandId!==job.brandId || authorized.config.providerId!==job.providerId || authorized.config.messagingProfileId!==job.messagingProfileId) throw new Error('Queued message ownership changed.');
    const reservation=policy.reserveBudget(authorized.config,{},policy.segments(job.text));
    if(job.costCeilingMicrosUsdPerSegment!==authorized.config.costCeilingMicrosUsdPerSegment || job.reservedMicrosUsd!==reservation.reservedMicrosUsd) throw new Error('Queued message spending approval changed.');
  } catch {await ref.update({status:'configuration_blocked',updatedAt:FieldValue.serverTimestamp()});return;}
  const claimed=await db.runTransaction(async tx=>{
    const fresh=await tx.get(ref);
    if(fresh.data()?.status!=='pending') return false;
    tx.update(ref,{status:'sending',sendingAt:FieldValue.serverTimestamp()});return true;
  });
  if(!claimed) return;
  try {
    const result=await fetch('https://api.telnyx.com/v2/messages',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${key.value()}`,'Content-Type':'application/json'},body:JSON.stringify({from:job.from,to:job.to,text:job.text,messaging_profile_id:authorized.config.messagingProfileId})});
    if(!result.ok) throw new Error('Message provider request was not confirmed.');
    const message=(await result.json()).data;
    policy.delivery(job);const providerId=message?.id;
    if(typeof providerId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(providerId)) throw new Error('Provider message identity is unavailable.');
    const batch=db.batch();
    batch.set(db.doc(`gmsTelnyxMessageBindings/${providerId}`),{jobPath:ref.path,tenantId:job.tenantId,locationId:job.locationId,messageId:job.messageId,from:job.from,to:job.to,messagingProfileId:authorized.config.messagingProfileId});
    batch.update(ref,{status:'sent',providerMessageId:providerId,sentAt:FieldValue.serverTimestamp()});
    batch.set(db.doc(`tenants/${job.tenantId}/smsMessages/${ref.id}`),{tenantId:job.tenantId,brandId:job.brandId,campaignId:job.campaignId,leadId:job.leadId,agentUid:job.agentUid,from:job.from,to:job.to,text:job.text,direction:'outbound',status:'sent',providerMessageId:providerId,createdAt:FieldValue.serverTimestamp()});
    await batch.commit();
  } catch {
    // Do not repeat an uncertain paid send. Its provider webhook or an operator
    // must reconcile it first; returning on redelivery prevents duplicate texts.
    await ref.update({status:'needs_reconciliation',updatedAt:FieldValue.serverTimestamp()});
  }
});
exports.telnyxMessagingWebhook=onRequest({maxInstances:2,timeoutSeconds:60},async(request,response)=>{
  if(request.method!=='POST') return response.status(405).send('Method not allowed.');
  if(!verifySignature('telnyx',{rawBody:request.rawBody,signature:request.get('telnyx-signature-ed25519'),timestamp:request.get('telnyx-timestamp')},{publicKey:process.env.TELNYX_PUBLIC_KEY})) return response.status(401).send('Invalid signature.');
  try {
    const data=JSON.parse(request.rawBody.toString('utf8')).data,payload=data?.payload;
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(data?.id || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(payload?.id || '')) throw new Error('Invalid message event.');
    const eventRef=db.doc(`gmsTelnyxSmsEvents/${data.id}`);
    if((await eventRef.get()).exists) return response.status(200).send('Already processed.');
    if(data.event_type==='message.received') {
      const from=policy.delivery({type:'SMS',locationId:'lookup',contactId:'lookup',messageId:payload.id,phone:payload.from?.phone_number,message:payload.text}).to;
      const to=payload.to?.[0]?.phone_number;
      const mapping=(await db.doc(`gmsMessagingNumbers/${policy.recipientId(to)}`).get()).data();
      if(!mapping || mapping.messagingProfileId!==payload.messaging_profile_id) return response.status(202).send('Recipient mapping is unavailable.');
      const connection=await client(mapping.tenantId,mapping.locationId);
      if(connection.sms?.messagingProfileId!==mapping.messagingProfileId) throw new Error('Recipient profile ownership changed.');
      const consentRef=db.doc(`gmsMessagingConsents/${mapping.tenantId}/recipients/${policy.recipientId(from)}`);
      await db.runTransaction(async tx=>{
        const seen=await tx.get(eventRef);if(seen.exists)return;
        if(policy.isOptOut(payload.text)) tx.set(consentRef,{phone:from,status:'opted_out',source:'telnyx_inbound',optedOutAt:FieldValue.serverTimestamp()},{merge:true});
        else if(/^(START|UNSTOP)$/i.test(payload.text.trim())) tx.set(consentRef,{phone:from,status:'opted_in',source:'telnyx_inbound',evidenceReference:`gmsTelnyxSmsEvents/${data.id}`,consentedAtMs:Date.now()},{merge:true});
        tx.create(eventRef,{tenantId:mapping.tenantId,providerMessageId:payload.id,eventType:data.event_type,receivedAt:FieldValue.serverTimestamp()});
        tx.create(db.doc(`gmsGhlMessageUpdates/${data.id}`),{type:'inbound',tenantId:mapping.tenantId,locationId:mapping.locationId,providerId:connection.sms?.providerId,from,to,text:payload.text,providerMessageId:payload.id,status:'pending',createdAt:FieldValue.serverTimestamp()});
      });
    } else if(['message.sent','message.finalized'].includes(data.event_type)) {
      const binding=(await db.doc(`gmsTelnyxMessageBindings/${payload.id}`).get()).data();
      if(!binding) {
        // The signed delivery report can arrive before the paid-send response is
        // committed. Ask Telnyx to retry reports for our configured sender rather
        // than acknowledging and losing the only delivery evidence.
        const sender=(await db.doc(`gmsMessagingNumbers/${policy.recipientId(payload.from?.phone_number)}`).get()).data();
        if(sender?.messagingProfileId===payload.messaging_profile_id) return response.status(503).send('Message binding is pending.');
        return response.status(202).send('Message binding is unavailable.');
      }
      if(binding.messagingProfileId!==payload.messaging_profile_id || binding.from!==payload.from?.phone_number || binding.to!==payload.to?.[0]?.phone_number) return response.status(202).send('Message binding is unavailable.');
      const recipient=payload.to[0],status=recipient.status==='delivered'?'delivered':['delivery_failed','sending_failed'].includes(recipient.status)?'failed':'pending';
      await db.runTransaction(async tx=>{
        const [seen,job]=await Promise.all([tx.get(eventRef),tx.get(db.doc(binding.jobPath))]);
        if(seen.exists)return;
        tx.create(eventRef,{tenantId:binding.tenantId,providerMessageId:payload.id,eventType:data.event_type,receivedAt:FieldValue.serverTimestamp()});
        if(['delivered','failed'].includes(job.data()?.status))return;
        tx.update(db.doc(binding.jobPath),{status,updatedAt:FieldValue.serverTimestamp()});
        tx.set(db.doc(`tenants/${binding.tenantId}/smsMessages/${binding.jobPath.split('/')[1]}`),{status,updatedAt:FieldValue.serverTimestamp()},{merge:true});
        tx.create(db.doc(`gmsGhlMessageUpdates/${data.id}`),{type:'status',...binding,status,createdAt:FieldValue.serverTimestamp()});
      });
    }
    return response.status(200).send('Processed.');
  } catch {return response.status(503).send('Message update is pending reconciliation.');}
});
exports.syncGmsGhlMessage=onDocumentCreated({document:'gmsGhlMessageUpdates/{eventId}',maxInstances:2,timeoutSeconds:120,retry:true},async event=>{
  const ref=event.data.ref,job=(await ref.get()).data();if(!job || job.syncStatus==='complete' || job.syncStatus==='needs_reconciliation')return;
  const connection=await client(job.tenantId,job.locationId),token=await locationToken(job.locationId);
  if(!connection.oauthSecretId || !token) throw new Error('Messaging application authorization is required.');
  let path,body;
  if(job.type==='status') {
    const latest=(await db.doc(job.jobPath).get()).data();
    if(!latest || (['delivered','failed'].includes(latest.status) && latest.status!==job.status)) {await ref.update({syncStatus:'complete',superseded:true});return;}
    path=`/conversations/messages/${job.messageId}/status`;body={status:job.status};
  }
  else {
    const contacts=await db.collection(`gmsProviderContacts/${job.tenantId}/leads`).where('phone','==',job.from).limit(2).get();
    if(contacts.size!==1) {await ref.update({syncStatus:'contact_mapping_required'});return;}
    const mapping=contacts.docs[0].data();
    if(mapping.locationId!==job.locationId) throw new Error('Inbound contact ownership mismatch.');
    path='/conversations/messages/inbound';body={type:'SMS',contactId:mapping.contactId,conversationProviderId:job.providerId,message:job.text,altId:job.providerMessageId,direction:'inbound'};
    // A POST can succeed even if its response is lost. Persist a claim before
    // posting and require reconciliation of any uncertain result.
    const claimed=await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data().syncStatus==='posting')return false;tx.update(ref,{syncStatus:'posting'});return true;});
    if(!claimed) {await ref.update({syncStatus:'needs_reconciliation'});return;}
  }
  try {
    const result=await fetch(`https://services.leadconnectorhq.com${path}`,{method:job.type==='status'?'PUT':'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Version:'v3','User-Agent':'GMS-CRM/1.0','Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!result.ok) throw new Error('CRM message update was not confirmed.');
    await ref.update({syncStatus:'complete',syncedAt:FieldValue.serverTimestamp()});
  } catch {
    if(job.type==='inbound') await ref.update({syncStatus:'needs_reconciliation'});
    else throw new Error('CRM delivery state update will retry.');
  }
});
