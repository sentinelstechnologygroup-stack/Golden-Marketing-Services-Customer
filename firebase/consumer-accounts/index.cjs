const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {createHash,timingSafeEqual}=require('node:crypto');
initializeApp();const db=getFirestore();
const TENANT='tenant-golden-cross-beta', BRAND='brand-golden-cross-realty', ROUTE='tenant-golden-cross-beta--campaign-e5de6185';
const listingEmail=require('./listing-email.cjs'),weeklyEmail=require('./weekly-email.cjs');
const sites=listingEmail.SITES;
const text=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function authorized(req){const a=Buffer.from(String(req.get('authorization')||'').replace(/^Bearer\s+/i,'')),b=Buffer.from(process.env.GMS_INGESTION_KEY||'');return b.length>0&&a.length===b.length&&timingSafeEqual(a,b);}
exports.gmsWebsiteSearchIntake=async(req,res)=>{
 res.set('Cache-Control','no-store');if(req.query?.action==='preferences')return weeklyEmail.preferences(req,res,{db,stamp:FieldValue.serverTimestamp(),secret:process.env.GMS_INGESTION_KEY});if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 if(!authorized(req))return res.status(401).json({error:'Unauthorized'});
 if(['inquiry_email','inquiry_session'].includes(req.body?.action))return require('./inquiry-email.cjs').handler(req,res,{db,stamp:FieldValue.serverTimestamp()});
 const b=req.body||{}, site=sites[b.site]?listingEmail.theme(b.site):null;
 if(!site||JSON.stringify(b).length>20000||!/^[a-f0-9-]{36}$/i.test(b.submissionId||'')||!text(b.name)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(b.email,254))||!/^\+?\d{10,15}$/.test(b.phone||'')||b.consent?.accepted!==true||b.consent?.smsAccepted!==false)return res.status(400).json({error:'Invalid inquiry'});
 const id=createHash('sha256').update(`${b.site}:${b.submissionId}`).digest('hex'),ref=db.doc(`tenants/${TENANT}/websiteSearchRequests/${id}`);
 try{
 const [routeSnap,brandSnap]=await Promise.all([db.doc(`ingestionRoutes/${ROUTE}`).get(),db.doc(`tenants/${TENANT}/brands/${BRAND}`).get()]);
 const route=routeSnap.data(),brand=brandSnap.data();if(route?.tenantId!==TENANT||route.brandId!==BRAND||!brand?.websiteFunnel)throw Error('ownership-unavailable');
 const search=Object.fromEntries(['location','neighborhood','minPrice','maxPrice','beds','baths','propertyType','waterfront','forSale','openHouses','mapZoom','newConstruction','priceReduced','newListings','minSqft','bounds','polygon','availability','featuredOnly','minLotSqft','maxLotSqft'].map(k=>[k,text(b.searchCriteria?.[k],k==='polygon'?6000:200)]).filter(([,v])=>v));
 const url=new URL(site.path,site.origin);for(const[k,v]of Object.entries(search))url.searchParams.set(k,v);
 const email=text(b.email,254).toLowerCase(),stamp=FieldValue.serverTimestamp();
 await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();if(old){if(old.lead.email!==email)throw Error('receipt-mismatch');return;}
 const payload={...b,funnelProfile:{...search,area:search.location||search.neighborhood||'',completionStatus:'completed'},weeklyListingPreferencePresented:true,weeklyListingEmailsRequested:b.weekly===true};
 const lead=require('./bridge-contract.cjs').canonicalLead(route,payload,(route.assignedAgentUids||[]).find(uid=>uid.startsWith('gmsstaff_'))||null);
 Object.assign(lead,{communicationsSuppressed:true,smsSuppressed:true,customerVisible:true,isTest:false,searchUrl:url.href,createdAt:stamp,updatedAt:stamp,inboxDeliveredAt:stamp,receivedAt:stamp});
 if(b.site==='north')tx.create(db.doc(`tenants/${TENANT}/leads/${id}`),lead);
 tx.create(ref,{lead,site:b.site,searchUrl:url.href,profile:search,emailStatus:'pending',brokerageStatus:b.site==='brokerage'?'pending':'not_applicable',createdAt:stamp,weeklyRequested:b.weekly===true,weeklySetup:b.weekly===true?'awaiting_delivery_acceptance':'not_requested'});
 if(b.site==='north')require('./listing-email-policy.cjs').recordPreferenceAndTask({tx,root:db.doc(`tenants/${TENANT}`),leadId:id,lead,input:payload,stamp});
 if(b.site==='north'&&lead.assignedTo)tx.create(db.collection(`tenants/${TENANT}/notifications`).doc(),{tenantId:TENANT,brandId:BRAND,recipientUid:lead.assignedTo,audiences:['agent'],type:'lead_received',title:'Home-search inquiry received',body:'Search preferences received for qualification.',relatedId:id,communicationsSuppressed:true,createdAt:stamp,updatedAt:stamp,readAt:null});
 });
 if(process.env.INQUIRY_GHL_ENABLED==='true'){
 const inquiryReceipt=await require('./inquiry-email.cjs').processInquiry({db,stamp,staffOnly:true,body:{...b,interest:'Matching-home request',message:`Please help me find matching homes.\nSearch: ${url.href}`}});
 if(!inquiryReceipt.accepted||inquiryReceipt.staffStatus!=='accepted')return res.status(503).json({error:'Office receipt needs review. Please contact the office before resubmitting.'});
 await ref.update({brokerageStatus:b.site==='brokerage'?'sent_via_gohighlevel':'not_applicable',inquiryReference:inquiryReceipt.reference});
 }
 if(b.site==='brokerage'&&process.env.INQUIRY_GHL_ENABLED!=='true'){
 const claimed=await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d.brokerageStatus!=='pending')return false;tx.update(ref,{brokerageStatus:'sending'});return true;});
 if(claimed){try{const r=await fetch('https://formspree.io/f/xnpnppbz',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({_subject:'Golden Cross Realty: matching-home request',name:text(b.name,120),email,phone:b.phone,message:`Search: ${url.href}\nWeekly matches: ${b.weekly===true?'requested — manual setup':'declined'}\nInquiry awaits normal qualification.\n${text(b.consent?.text,500)}`,submissionId:b.submissionId,searchCriteria:search,attribution:b.attribution||{}}),signal:AbortSignal.timeout(15000)});const result=await r.json();if(!r.ok||result.ok!==true)throw Error('receipt-unconfirmed');await ref.update({brokerageStatus:'sent'});}catch{await ref.update({brokerageStatus:'needs_reconciliation'});}}
 if((await ref.get()).data().brokerageStatus!=='sent')return res.status(503).json({error:'Brokerage receipt needs review. Please contact the office before resubmitting.'});
 }
 const claim=await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d.emailStatus!=='pending')return false;tx.update(ref,{emailStatus:'sending',sendingAt:stamp});return true;});
 if(claim){try{const d=(await ref.get()).data();
 const matches=await listingEmail.matchingListings(b.site,search);
 const content=listingEmail.render({site:b.site,lead:d.lead,criteria:search,matches,unsubscribeUrl:listingEmail.preferenceUrl(id,process.env.GMS_INGESTION_KEY),config:brand.websiteFunnel});
 const receipt=await require('./website-funnel-ghl-email.cjs').send({db,tenantId:TENANT,draftRef:ref,draft:d,config:{...brand.websiteFunnel,siteName:site.name},content});await ref.update({emailStatus:'sent',providerMessageId:receipt.id,locationId:receipt.locationId,sentAt:stamp,emailTemplateVersion:content.templateVersion,emailListingIds:matches.cards.map(c=>c.id),emailListingCount:content.listingCount});
 }catch(e){await ref.update({emailStatus:'needs_reconciliation',emailError:String(e.message).slice(0,150)});}}
 const saved=(await ref.get()).data();return res.status(202).json({accepted:true,leadId:id,searchUrl:saved.searchUrl,emailStatus:saved.emailStatus});
 }catch(e){console.error('Search intake failed',{code:String(e.message).slice(0,100)});return res.status(503).json({error:'Search inquiry could not be confirmed'});}
};

// Dedicated authenticated batch endpoint. Delivery stays off unless explicitly enabled.
exports.gmsWebsiteWeeklyEmail=async(req,res)=>{res.set('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'POST required'});if(!authorized(req))return res.status(401).json({error:'Unauthorized'});try{return res.status(200).json(await weeklyEmail.run({db,stamp:FieldValue.serverTimestamp(),secret:process.env.GMS_INGESTION_KEY,body:req.body||{},enabled:process.env.GMS_WEEKLY_EMAILS_ENABLED==='true'||req.body?.controlled===true}));}catch(e){console.error('Weekly email batch failed',{code:String(e.message).slice(0,100)});return res.status(503).json({error:'Weekly delivery needs review'});}};
exports.gmsWebsiteIntakeGuard=require('./intake-guard.cjs').handler;

exports.gmsReconcileWebsiteInquiries=async(req,res)=>{try{res.status(200).json(await require('./inquiry-recovery.cjs').reconcile({db}));}catch{res.status(503).json({error:'intake_reconciliation_failed'});}};

exports.gmsWeeklyMatchingEmails=async(req,res)=>{try{const result=await require('./weekly-controller.cjs').dispatch({db,secret:process.env.GMS_INGESTION_KEY,body:req.body||{},enabled:process.env.GMS_WEEKLY_EMAILS_ENABLED==='true'});res.status(200).json(result);}catch{res.status(503).json({error:'weekly_delivery_needs_review'});}};

exports.gmsConsumerAccount=(req,res)=>require('./consumer-account.cjs').handler(req,res,{db});
exports.gmsConsumerMaintenance=async(req,res)=>{try{const sync=await require('./consumer-sync.cjs').reconcile({db});const emails=await require('./consumer-subscriptions.cjs').run({db});res.status(200).json({sync,emails});}catch{res.status(503).json({error:'consumer_maintenance_failed'});}};
