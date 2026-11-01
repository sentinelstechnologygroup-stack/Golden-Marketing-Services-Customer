const {createHash,createHmac}=require('node:crypto');
const {Timestamp,FieldValue}=require('firebase-admin/firestore');
const policy=require('./messaging-policy.cjs');
const {selectOutboundNumber}=require('./telephony/readiness.cjs');
const TENANT='tenant-golden-cross-beta',BRAND='brand-golden-cross-realty',ORIGIN='https://www.homesaroundnorthhouston.com';
const hash=s=>createHash('sha256').update(s).digest('hex');
const smsToken=id=>{if(!process.env.GMS_INGESTION_KEY)throw Error('verification_configuration_unavailable');return createHmac('sha256',process.env.GMS_INGESTION_KEY).update('north-inquiry-sms:'+id).digest('hex');};
const shortCode=token=>Buffer.from(token,'hex').subarray(0,16).toString('base64url');
const kindKey=k=>k==='staff_notification'?'smsCompletionStatus':'smsVerificationDispatchStatus';
function textFor(kind,id,token,details={}){const tree=require('./client-call-tree.cjs').normalize(details.callTree||{}),workflow=tree.smsWorkflow;const u=new URL('/verify',ORIGIN);u.searchParams.set('channel','sms');u.searchParams.set('id',id);u.searchParams.set('token',token||'');if(!details.legacy){u.search='';u.searchParams.set('s',shortCode(token||''));}const values={clientName:details.clientName||'Golden Cross Realty',leadName:String(details.leadName||'A new lead').replace(/[\r\n]/g,' ').slice(0,100),confirmationLink:u.href};const legacy='Thank you for requesting information from {clientName}. Our team will contact you shortly. Confirm your number: {confirmationLink}';const template=kind==='staff_notification'?workflow.recipientMessage:(!details.legacy&&workflow.leadMessage===legacy?'{clientName}: Confirm phone number: {confirmationLink}':workflow.leadMessage);const text=template.replace(/\{(clientName|leadName|confirmationLink)\}/g,(_,key)=>values[key]);return text+' Reply STOP to opt out or HELP for help.';}
async function settings(db){const d=(await db.doc(`tenants/${TENANT}/config/onboarding`).get()).data();return {callTree:d?.data?.callTree||{},clientName:d?.data?.brandName||d?.data?.name||'Golden Cross Realty',revision:d?.revision||0};}
async function authorize({db,input,env=process.env}){
 if(env.GMS_MESSAGING_ENABLED!=='true'||env.GMS_WEBSITE_MESSAGES_ENABLED!=='true')throw Error('configuration_disabled');
 if(!/^tenants\/tenant-golden-cross-beta\/websiteFunnelDrafts\/[a-f0-9]{64}$/.test(input.draftPath||'')||!['verification','staff_notification'].includes(input.inquiryKind))throw Error('invalid_inquiry_sms');
 const id=input.draftPath.split('/').pop(),draft=(await db.doc(input.draftPath).get()).data();
 const receiptPath=`tenants/${TENANT}/websiteInquiryEmails/${id}`,receipt=(await db.doc(receiptPath).get()).data(),lead=draft?.lead;
 if(!lead||lead.tenantId!==TENANT||lead.brandId!==BRAND||draft.inquiryEmailReference!==id||receipt?.gmsLeadId!==draft.leadId||receipt.inquiry?.site!=='north'||receipt.inquiry.phone!==lead.phone||lead.isTest===true||receipt.isTest===true)throw Error('inquiry_ownership_mismatch');
 policy.recipientId(lead.phone);
 const [connectionSnap,tenantSnap]=await Promise.all([db.doc(`gmsProviderConnections/${TENANT}`).get(),db.doc(`tenants/${TENANT}`).get()]);
 const connection=connectionSnap.data(),config=connection?.sms;
 if(config?.websiteFunnelEnabled!==true||config.numberAssignmentStatus!=='ASSIGNED'||config.providerCampaignStatus!=='MNO_PROVISIONED'||tenantSnap.data()?.environment!=='production'||tenantSnap.data()?.demo)throw Error('configuration_disabled');
 const captured=receipt.createdAt?.toMillis?.();
 if(!Number.isSafeInteger(config.websiteMessagesEnabledAtMs)||!Number.isFinite(captured)||captured<config.websiteMessagesEnabledAtMs||captured>Date.now())throw Error('historical_inquiry');
 const owner=(await db.doc(`ghlLocationTenants/${connection.locationId}`).get()).data();if(owner?.tenantId!==TENANT)throw Error('ownership_changed');
 const route=(await db.doc(`ingestionRoutes/${draft.routeKey}`).get()).data();if(route?.status!=='active'||route?.tenantId!==TENANT||route.brandId!==lead.brandId||!await require('./website-route-readiness.cjs').operationalReady(db,route))throw Error('route_unavailable');
 const workflowSettings=await settings(db),tree=require('./client-call-tree.cjs').normalize(workflowSettings.callTree);if(tree.smsWorkflow.enabled===false)throw Error('configuration_disabled');
 const currentSnap=await db.doc(`tenants/${TENANT}/leads/${draft.leadId}`).get();
 const current=currentSnap.exists?currentSnap.data():draft.state==='held'?lead:null;
 if(!current||current.archived||current.isTest===true||current.phone!==lead.phone||current.tenantId!==TENANT||current.brandId!==lead.brandId)throw Error('lead_unavailable');
 let recipientLead=current;
 if(input.inquiryKind==='verification'){
  if(receipt.inquiry.consent?.smsAccepted!==true||!require('./inquiry-sms-disclosures.cjs').validVersion(receipt.inquiry.consent.smsVersion)||current.consent?.smsAccepted!==true||current.consent.smsVersion!==receipt.inquiry.consent.smsVersion||input.to!==lead.phone)throw Error('consent_unavailable');
  if(!/^[a-f0-9]{64}$/.test(input.verificationToken||'')||draft.verification?.sms?.tokenHash!==hash(input.verificationToken)||draft.verification.sms.expiresAt.toMillis()<Date.now())throw Error('verification_expired');
 }else{
  const recipient=tree.recipients.find(r=>r.id===input.recipientId&&r.enabled&&r.receiveSms&&r.phone===input.to);if(!recipient||receipt.contactStatus!=='saved')throw Error('notification_not_approved');
  recipientLead={phone:input.to,brandId:BRAND};
 }
 if(![false,true].some(legacy=>{const expected=textFor(input.inquiryKind,id,input.verificationToken,{...workflowSettings,leadName:receipt.inquiry.name||lead.name,legacy});return input.text===expected||input.inquiryKind==='verification'&&input.text===expected.replace('Confirm phone number:','Please confirm your phone number:');}))throw Error('message_mismatch');
 if(input.inquiryKind==='verification'&&env.GMS_PREFERENCE_SYNC_ENABLED==='true')await require('./preference-sync.cjs').beforeSms({db,tenantId:TENANT,receipt,draft});
 const consent=(await db.doc(`gmsMessagingConsents/${TENANT}/recipients/${policy.recipientId(input.to)}`).get()).data();
 const rows=await db.collection(`tenants/${TENANT}/phoneNumbers`).where('brandId','==',lead.brandId).get(),number=selectOutboundNumber(rows.docs.map(d=>d.data()),'telnyx',lead.campaignId||lead.campaign_id);
 const from=policy.maySend(consent,recipientLead,number,config,input.to);policy.reserveBudget(config,{},policy.segments(input.text));
 return {tenantId:TENANT,leadId:draft.leadId,brandId:lead.brandId,campaignId:lead.campaignId||lead.campaign_id,agentUid:lead.assignedTo||null,from,config,receiptPath,locationId:connection.locationId};
}
async function queueOne({db,reference,kind='verification',recipient=null,env=process.env}){
 if(!/^[a-f0-9]{64}$/.test(reference||'')||!['verification','staff_notification'].includes(kind))throw Error('invalid_reference');
 const receiptRef=db.doc(`tenants/${TENANT}/websiteInquiryEmails/${reference}`),receipt=(await receiptRef.get()).data();
 if(receipt?.inquiry?.site!=='north'||kind==='verification'&&receipt.inquiry.consent?.smsAccepted!==true)return {status:'not_requested'};
 const draftPath=`tenants/${TENANT}/websiteFunnelDrafts/${reference}`,draftRef=db.doc(draftPath),draft=(await draftRef.get()).data();if(!draft)return {status:'awaiting_projection'};
 if(receipt.isTest===true||draft.lead?.isTest===true)return {status:'test_record_suppressed'};
 if(kind==='verification'){const consent=(await db.doc('gmsMessagingConsents/'+TENANT+'/recipients/'+policy.recipientId(receipt.inquiry.phone)).get()).data();if(reusableVerification(consent)){const at=Timestamp.fromMillis(consent.verifiedAtMs),proof={status:'verified',verifiedAt:at,method:'previous_sms_link_open',evidenceReference:consent.verificationEvidenceReference};await draftRef.update({'verification.sms.status':proof.status,'verification.sms.verifiedAt':proof.verifiedAt,'verification.sms.method':proof.method,'verification.sms.evidenceReference':proof.evidenceReference});const leadRef=db.doc('tenants/'+TENANT+'/leads/'+draft.leadId);if((await leadRef.get()).exists)await leadRef.update({'contactVerification.sms':proof});await receiptRef.update({smsVerificationDispatchStatus:'already_verified',smsVerificationStatus:'verified',smsVerificationEvidenceReference:consent.verificationEvidenceReference});return {status:'already_verified'};}}
 const token=kind==='verification'?smsToken(reference):undefined,stamp=FieldValue.serverTimestamp();
 if(kind==='verification'&&!draft.verification?.sms)await draftRef.update({'verification.sms':{tokenHash:hash(token),expiresAt:Timestamp.fromMillis(Date.now()+172800000),status:'pending',dispatchStatus:'not_activated'}});
 if(env.GMS_MESSAGING_ENABLED!=='true'||env.GMS_WEBSITE_MESSAGES_ENABLED!=='true'){await receiptRef.update({[kindKey(kind)]:'configuration_disabled'});return {status:'configuration_disabled'};}
 const config=(await db.doc(`gmsProviderConnections/${TENANT}`).get()).data()?.sms;
 const to=kind==='verification'?receipt.inquiry.phone:recipient?.phone;
 const workflowSettings=await settings(db);
 if(kind==='staff_notification'){const consentRef=db.doc(`gmsMessagingConsents/${TENANT}/recipients/${policy.recipientId(to)}`);await db.runTransaction(async tx=>{const prior=await tx.get(consentRef);if(prior.exists)return;tx.create(consentRef,{phone:to,status:'opted_in',source:'approved_client_call_tree',evidenceReference:`tenants/${TENANT}/config/onboarding`,configurationRevision:workflowSettings.revision,consentedAtMs:Date.now()});});}
 if(kind==='verification'){
  const consentRef=db.doc(`gmsMessagingConsents/${TENANT}/recipients/${policy.recipientId(to)}`);
  // Website consent must never undo a recorded STOP, including staff opting out.
  await db.runTransaction(async tx=>{const existing=await tx.get(consentRef);if(existing.exists)return;const at=Date.parse(receipt.inquiry.consent.capturedAt);if(!Number.isFinite(at)||at>Date.now())throw Error('consent_unavailable');tx.create(consentRef,{phone:to,status:'opted_in',source:'north_website_checkbox',evidenceReference:receiptRef.path,consentedAtMs:at});});
 }
 const input={source:'website_inquiry',inquiryKind:kind,draftPath,to,text:textFor(kind,reference,token,{...workflowSettings,leadName:receipt.inquiry.name||draft.lead?.name}),...(recipient?{recipientId:recipient.id}:{}),...(kind==='verification'?{verificationToken:token}:{}),messageId:hash(reference+':'+kind),type:'SMS'};
 let authorized;try{authorized=await authorize({db,input,env});}catch(e){const status=['configuration_disabled','notification_not_approved','historical_inquiry'].includes(e.message)?e.message:'awaiting_approval_or_configuration';await receiptRef.update({[kindKey(kind)]:status});return {status};}
 if(kind==='verification'){const linkRef=db.doc(`tenants/${TENANT}/phoneConfirmationLinks/${shortCode(token)}`);await db.runTransaction(async tx=>{const prior=(await tx.get(linkRef)).data();if(prior&&prior.reference!==reference)throw Error('confirmation_collision');if(!prior)tx.create(linkRef,{reference,createdAt:stamp});});}
 const ref=db.doc(`gmsSmsDeliveryJobs/${hash('website_inquiry:'+reference+':'+kind+(recipient?':'+policy.recipientId(recipient.phone):''))}`),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),budgetRef=db.doc(`gmsMessagingBudgets/${TENANT}/days/${day}`),count=policy.segments(input.text);
 await db.runTransaction(async tx=>{const [existing,budget]=await Promise.all([tx.get(ref),tx.get(budgetRef)]);if(existing.exists)return;const reservation=policy.reserveBudget(authorized.config,budget.data(),count),{config,...attribution}=authorized;tx.set(budgetRef,{...reservation,updatedAt:stamp},{merge:true});tx.create(ref,{...input,...attribution,messagingProfileId:config.messagingProfileId,providerId:config.providerId,fingerprint:policy.messageFingerprint({...input,from:authorized.from}),segments:count,reservedMicrosUsd:count*config.costCeilingMicrosUsdPerSegment,costCeilingMicrosUsdPerSegment:config.costCeilingMicrosUsdPerSegment,status:'pending',createdAt:stamp});});
 await receiptRef.update({[kindKey(kind)]:(await ref.get()).data().status});return {status:'queued'};
}

async function verify({db,reference,token,now=Date.now()}){
 if(!/^[a-f0-9]{64}$/.test(reference||'')||!/^[a-f0-9]{64}$/.test(token||''))throw Error('Invalid inquiry');
 const receiptRef=db.doc(`tenants/${TENANT}/websiteInquiryEmails/${reference}`),draftRef=db.doc(`tenants/${TENANT}/websiteFunnelDrafts/${reference}`);
 return db.runTransaction(async tx=>{const [r,d]=await Promise.all([tx.get(receiptRef),tx.get(draftRef)]),receipt=r.data(),draft=d.data(),v=draft?.verification?.sms;
 if(!v||v.tokenHash!==hash(token)||v.expiresAt.toMillis()<now||receipt?.inquiry?.site!=='north'||receipt.gmsLeadId!==draft.leadId||draft.inquiryEmailReference!==reference)throw Error('Invalid inquiry');
 const consentRef=db.doc('gmsMessagingConsents/'+TENANT+'/recipients/'+policy.recipientId(receipt.inquiry.phone)),consent=(await tx.get(consentRef)).data();const leadRef=db.doc(`tenants/${TENANT}/leads/${draft.leadId}`),saved=(await tx.get(leadRef)).data();if(saved?(saved.phone!==draft.lead.phone||saved.tenantId!==TENANT||saved.brandId!==draft.lead.brandId||saved.archived):(draft.state!=='held'||draft.lead?.tenantId!==TENANT))throw Error('Invalid inquiry');
 if(v.status==='verified')return {accepted:true,reference,leadId:draft.leadId,state:'verified'};
 if(consent?.status==='opted_out')throw Error('SMS permission withdrawn');const at=Timestamp.fromMillis(now);if(consent?.status==='opted_in')tx.set(consentRef,{verifiedAtMs:now,verificationMethod:'sms_link_open',verificationEvidenceReference:receiptRef.path},{merge:true});tx.update(draftRef,{'verification.sms.status':'verified','verification.sms.verifiedAt':at,'verification.sms.method':'sms_link_open'});tx.update(receiptRef,{smsVerificationStatus:'verified',smsVerifiedAt:at,smsVerificationMethod:'sms_link_open'});if(saved&&!receipt.controlledTest)tx.update(leadRef,{'contactVerification.sms.status':'verified','contactVerification.sms.verifiedAt':at,'contactVerification.sms.method':'sms_link_open'});return {accepted:true,reference,leadId:draft.leadId,state:'verified'};});
}
async function queue(input){if(input.kind!=='staff_notification')return queueOne(input);const details=await settings(input.db),tree=require('./client-call-tree.cjs').normalize(details.callTree);if(!tree.smsWorkflow.enabled)return {status:'configuration_disabled'};const results=[];for(const recipient of tree.recipients.filter(r=>r.enabled&&r.receiveSms))results.push(await queueOne({...input,recipient}));return {status:results.length?'processed':'no_sms_recipients',recipients:results.length,queued:results.filter(r=>r.status==='queued').length,results};}
async function verifyShort({db,code,now=Date.now()}){if(!/^[A-Za-z0-9_-]{22}$/.test(code||''))throw Error('Invalid inquiry');const link=(await db.doc(`tenants/${TENANT}/phoneConfirmationLinks/${code}`).get()).data();if(!/^[a-f0-9]{64}$/.test(link?.reference||''))throw Error('Invalid inquiry');const token=smsToken(link.reference);if(shortCode(token)!==code)throw Error('Invalid inquiry');return verify({db,reference:link.reference,token,now});}
module.exports={queue,authorize,verify,verifyShort,textFor,smsToken};

function reusableVerification(c,now=Date.now()){return Boolean(c?.status==='opted_in'&&Number.isFinite(c.verifiedAtMs)&&c.verifiedAtMs>0&&c.verifiedAtMs<=now&&c.verificationEvidenceReference&&c.verificationMethod==='sms_link_open'&&c.verifiedAtMs>(c.optedOutAt?.toMillis?.()||0));}
module.exports.reusableVerification=reusableVerification;
