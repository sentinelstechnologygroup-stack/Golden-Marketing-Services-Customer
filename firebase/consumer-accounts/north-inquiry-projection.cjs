const {createHash,createHmac}=require('node:crypto');
const {Timestamp,FieldValue}=require('firebase-admin/firestore');
const TENANT='tenant-golden-cross-beta',BRAND='brand-golden-cross-realty',ROUTE=TENANT+'--campaign-e5de6185';
async function matchingLead(db,receipt){
 const leads=db.collection(`tenants/${TENANT}/leads`);
 const active=rows=>rows.filter(d=>{const x=d.data();return x.tenantId===TENANT&&x.brandId===BRAND&&x.archived!==true&&x.status!=='archived'&&x.isTest!==true;});
 if(receipt.contactId){const queries=await Promise.all(['ghlContactId','providerContactId'].map(k=>leads.where(k,'==',receipt.contactId).get()));const unique=new Map(queries.flatMap(q=>active(q.docs)).map(d=>[d.id,d]));if(unique.size===1)return [...unique.keys()][0];if(unique.size>1)return null;}
 const rows=await leads.where('phone','==',receipt.inquiry.phone).get();
 const exact=active(rows.docs).filter(d=>String(d.data().email||'').toLowerCase()===receipt.inquiry.email.toLowerCase());
 return exact.length===1?exact[0].id:null;
}
async function sync({db,reference,action='capture',profile}){
 if(!/^[a-f0-9]{64}$/.test(reference||''))throw Error('Invalid inquiry projection');
 const root=db.doc(`tenants/${TENANT}`),receiptRef=db.doc(`tenants/${TENANT}/websiteInquiryEmails/${reference}`),receipt=(await receiptRef.get()).data();
 if(receipt?.inquiry?.site!=='north')return {status:'not_applicable'};
 const route=(await db.doc(`ingestionRoutes/${ROUTE}`).get()).data();
 if(route?.tenantId!==TENANT||route.brandId!==BRAND||!await require('./website-route-readiness.cjs').operationalReady(db,route)){await receiptRef.update({gmsProjectionStatus:'awaiting_route'});return {status:'awaiting_route'};}
 let assignedTo=null;
 for(const uid of route.assignedAgentUids||[]){const a=(await db.doc(`agentUsers/${uid}/assignments/${TENANT}`).get()).data();if(a?.status==='active'&&a.role==='agent'&&[a.brandId,...(a.brandIds||[])].includes(BRAND)){assignedTo=uid;break;}}
 if(!assignedTo)throw Error('No active inquiry phone-agent assignment');
 // Each production inquiry owns its receipt. Existing mappings remain stable for idempotency.
 const matched=receipt.canonicalContactLeadId||(receipt.gmsLeadId!==reference?receipt.gmsLeadId:null)||await matchingLead(db,receipt);const perInquiry=receipt.createdAt?.toMillis?.()>=Date.parse('2026-11-01T17:22:00Z');const leadId=perInquiry?reference:(receipt.gmsLeadId||matched||reference);
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(leadId))throw Error('Invalid inquiry lead mapping');
 const inquiry=receipt.inquiry;
 let criteria={};try{criteria=JSON.parse(inquiry.searchCriteria||'{}');}catch{}
 const preferences={...(inquiry.property?{boardId:inquiry.property.boardId,mlsNumber:inquiry.property.mlsNumber,propertyAddress:inquiry.property.address}:{}),...(profile||receipt.preferences||criteria)};
 const lead=require('./bridge-contract.cjs').canonicalLead(route,{name:inquiry.name,email:inquiry.email,phone:inquiry.phone,services:[inquiry.interest],notes:[inquiry.attribution?.campaignLabel?`Ad source: ${inquiry.attribution.campaignLabel}`:'',inquiry.message].filter(Boolean).join('\n'),consent:inquiry.consent,isTest:false,attribution:require('./inquiry-attribution.cjs').merge({},inquiry.attribution,reference,receipt.createdAt?.toDate?.().toISOString()||new Date().toISOString()),funnelProfile:preferences},assignedTo);
 if(receipt.contactId)lead.ghlContactId=receipt.contactId;if(perInquiry&&matched&&matched!==reference)lead.canonicalContactLeadId=matched;lead.websiteInquiryReference=reference;
 const stamp=Timestamp.now(),token=createHmac('sha256',process.env.GMS_INGESTION_KEY||'').update('website-inquiry-session:'+reference).digest('hex');
 const ref=root.collection('websiteFunnelDrafts').doc(reference);
 await db.runTransaction(async tx=>{
  const workRef=root.collection('followUpTasks').doc('website-inquiry-'+reference);const [draft,existing,work]=await Promise.all([tx.get(ref),tx.get(root.collection('leads').doc(leadId)),tx.get(workRef)]);
  if(existing.exists&&(existing.data().tenantId!==TENANT||existing.data().brandId!==BRAND||(!['ghlContactId','providerContactId'].some(k=>existing.data()[k]===receipt.contactId)&&(existing.data().phone!==inquiry.phone||existing.data().email!==inquiry.email))))throw Error('Inquiry mapping ownership mismatch');
  if(existing.exists&&leadId!==reference&&!work.exists){tx.create(workRef,{tenantId:TENANT,brandId:BRAND,campaignId:route.campaignId,leadId,assignedTo:existing.data().assignedTo||assignedTo,type:'follow_up',title:'Respond to new website inquiry',description:inquiry.property?inquiry.property.address+' | MLS '+inquiry.property.mlsNumber:'New website inquiry from existing contact',status:'pending',dueAt:stamp,createdAt:stamp,updatedAt:stamp,websiteInquiryReference:reference,isTest:false});tx.create(root.collection('notifications').doc('website-inquiry-'+reference),{tenantId:TENANT,brandId:BRAND,recipientUid:existing.data().assignedTo||assignedTo,audiences:['agent'],type:'lead_received',title:'New inquiry from existing contact',body:'A new website inquiry needs follow-up.',relatedId:leadId,createdAt:stamp,updatedAt:stamp,readAt:null});}
  const attribution=require('./inquiry-attribution.cjs').merge(existing.data()?.attribution||{},inquiry.attribution,reference,receipt.createdAt?.toDate?.().toISOString()||new Date().toISOString());
  if(!draft.exists)tx.create(ref,{routeKey:ROUTE,tokenHash:createHash('sha256').update(token).digest('hex'),fingerprint:reference,leadId,lead:{...lead,...(existing.data()||{}),attribution,websiteInquiryReference:reference,isTest:false,consent:{...(existing.data()?.consent||{}),...lead.consent},smsSuppressed:true},profile:preferences,telemetry:{},state:existing.exists?'released':'held',capturedAt:receipt.createdAt||stamp,lastActiveAt:stamp,releaseDueAt:Timestamp.fromMillis(Date.now()+300000),updatedAt:stamp,confirmationQueuedAt:stamp,inquiryEmailReference:reference});
  if(draft.exists&&draft.data().leadId!==leadId){tx.update(ref,{leadId,lead:{...lead,isTest:false,smsSuppressed:true},state:existing.exists?'released':'held'});if(work.exists)tx.update(workRef,{status:'cancelled',resolution:'new_inquiry_has_own_lead_entry',updatedAt:stamp});}
  if(draft.exists)tx.update(ref,{'lead.consent':{...(draft.data()?.lead?.consent||{}),...lead.consent},'lead.smsSuppressed':true,'lead.isTest':false,...(receipt.contactId?{'lead.ghlContactId':receipt.contactId}:{}),...(draft.data()?.lead?.isTest===true?{'lead.originalIsTest':true,'lead.classificationChangedAt':stamp}:{})});
  if(existing.exists)tx.update(root.collection('leads').doc(leadId),{attribution,consent:{...(existing.data()?.consent||{}),...lead.consent},...(receipt.contactId?{ghlContactId:receipt.contactId}:{}),smsSuppressed:true,updatedAt:stamp});
  tx.update(receiptRef,{gmsLeadId:leadId,...(matched&&matched!==reference?{canonicalContactLeadId:matched}:{}),gmsProjectionStatus:'captured',isTest:false,...(receipt.isTest===true?{originalIsTest:true,classificationChangedAt:stamp}:{}),updatedAt:FieldValue.serverTimestamp()});
 });
 await db.runTransaction(async tx=>{const snap=await tx.get(ref),d=snap.data();if(d?.state==='held')require('./website-funnel.cjs').publish(tx,db,ref,d,Date.now(),'contact_captured');});
 if(['active','hidden','exit','complete'].includes(action)){
  await require('./website-funnel.cjs').update({db,route,routeKey:ROUTE,sessionId:reference,sessionToken:token,action,input:preferences});
  if(action==='complete')await receiptRef.update({gmsProjectionStatus:'released'});
 }
 if(receipt.contactId&&receipt.locationId)await require('./preference-sync.cjs').register({db,tenantId:TENANT,contactId:receipt.contactId,locationId:receipt.locationId,leadId,draftPath:ref.path,phone:lead.phone,email:lead.email});
 return {status:action==='complete'?'released':'captured',leadId};
}
module.exports={sync,matchingLead};
