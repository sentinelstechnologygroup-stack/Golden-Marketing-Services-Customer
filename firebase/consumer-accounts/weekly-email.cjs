const {createHash}=require('node:crypto');
const email=require('./listing-email.cjs');
const TENANT='tenant-golden-cross-beta',BRAND='brand-golden-cross-realty';
const root=db=>db.doc(`tenants/${TENANT}`);
const emailHash=value=>createHash('sha256').update(`${BRAND}:${String(value||'').trim().toLowerCase()}`).digest('hex');
const suppressionRef=(db,address)=>root(db).collection('websiteEmailSuppressions').doc(emailHash(address));
async function suppressed(db,lead){return Boolean(lead.doNotContact||lead.optOut||lead.emailOptOut||['unsubscribed','suppressed'].includes(lead.communicationPreferences?.weeklyListingEmails?.status)||(await suppressionRef(db,lead.email).get()).exists);}
function requested(d,lead=d.lead){
 const p=lead.communicationPreferences?.weeklyListingEmails;
 return Boolean((d.weeklyRequested===true||d.lead?.communicationPreferences?.weeklyListingEmails?.requested===true)&&(!p||p.requested===true)&&!['unsubscribed','suppressed','declined'].includes(p?.status)&&d.weeklySetup!=='unsubscribed');
}
function weekKey(date=new Date()){const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const start=new Date(Date.UTC(d.getUTCFullYear(),0,1));return `${d.getUTCFullYear()}-W${String(Math.ceil((((d-start)/86400000)+1)/7)).padStart(2,'0')}`;}
async function preferences(req,res,{db,stamp,secret}){
 res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Robots-Tag','noindex, nofollow');res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
 if(!['GET','POST'].includes(req.method))return res.status(405).send('GET or POST required');
 const id=email.verifyToken(req.query?.token,secret);if(!id)return res.status(400).send('This preference link is invalid or expired. Reply to your property email to request removal.');
 const ref=root(db).collection('websiteSearchRequests').doc(id),snap=await ref.get(),d=snap.data();
 if(!d?.lead?.email||d.lead.tenantId!==TENANT||d.lead.brandId!==BRAND)return res.status(404).send('Preference record unavailable. Reply to your property email to request removal.');
 if(req.method==='GET')return res.status(200).type('html').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences</title><main style="max-width:520px;margin:70px auto;padding:28px;font:17px/1.7 Arial;color:#14283b"><h1 style="font:34px Georgia">Your email preferences</h1><p>Stop weekly property emails from Golden Cross Realty and its website support team. You can still contact the brokerage whenever you need help.</p><form method="post"><button style="padding:15px 22px;background:#14283b;color:white;border:0;border-radius:5px;font-size:16px">Unsubscribe from weekly emails</button></form></main>`);
 await db.runTransaction(async tx=>{
  tx.set(suppressionRef(db,d.lead.email),{tenantId:TENANT,brandId:BRAND,status:'unsubscribed',updatedAt:stamp},{merge:true});
  tx.set(ref,{weeklySetup:'unsubscribed',weeklyUnsubscribedAt:stamp},{merge:true});
  if(d.site==='north')tx.set(root(db).collection('leads').doc(id),{communicationPreferences:{weeklyListingEmails:{requested:false,status:'unsubscribed',setupStatus:'unsubscribed',unsubscribeVerified:true,updatedAt:stamp}}},{merge:true});
 });
 return res.status(200).type('html').send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><main style="max-width:520px;margin:70px auto;padding:28px;font:17px/1.7 Arial;color:#14283b"><h1 style="font:34px Georgia">You are unsubscribed.</h1><p>Your weekly property emails have been stopped. No sign-in is needed.</p></main>');
}
async function run({db,stamp,secret,body={},enabled=false,fetcher=fetch,sender=null}){
 if(!enabled)return {enabled:false,sent:0,message:'Weekly delivery is disabled until acceptance and scheduling are approved.'};
 const controlled=body.controlled===true;
 const deliver=sender||require('./website-funnel-ghl-email.cjs').send;
 const requestedId=typeof body.receiptId==='string'&&/^[a-f0-9]{64}$/.test(body.receiptId)?body.receiptId:null;
 if(controlled&&!requestedId)throw Error('Controlled delivery requires one receipt ID');
 const brand=(await root(db).collection('brands').doc(BRAND).get()).data();if(!brand?.websiteFunnel)throw Error('Brand email settings unavailable');if(!controlled&&!email.theme('brokerage',brand.websiteFunnel).postalAddress)throw Error('Approve the sender business mailing address before recurring delivery');
 // Bounded batches are explicit; cursor continuation prevents silently forgetting later records.
 let q=root(db).collection('websiteSearchRequests').orderBy('createdAt','desc').limit(100);
 if(body.cursor&&/^[a-f0-9]{64}$/.test(body.cursor)){const cursor=await root(db).collection('websiteSearchRequests').doc(body.cursor).get();if(!cursor.exists)throw Error('Invalid cursor');q=q.startAfter(cursor);}
 const snapshot=requestedId?{docs:[await root(db).collection('websiteSearchRequests').doc(requestedId).get()]}:await q.get();
 const outcome={enabled:true,sent:0,skipped:0,needsReview:0,nextCursor:snapshot.docs.length===100?snapshot.docs.at(-1).id:null};
 const seen=new Set(),week=weekKey(),deadline=Date.now()+70000;let lastProcessed=null;
 for(const snap of snapshot.docs){
  if(lastProcessed&&(outcome.sent>=5||Date.now()>deadline)){outcome.nextCursor=lastProcessed;break;}lastProcessed=snap.id;
  const d=snap.data();if(d?.managedByConsumer||!d?.lead||!email.SITES[d.site]||d.lead.tenantId!==TENANT||d.lead.brandId!==BRAND){outcome.skipped++;continue;}
  const address=String(d.lead.email||'').toLowerCase();
  if(controlled&&(address!=='patrick.camacho1@gmail.com')){outcome.skipped++;continue;}
  if(!controlled&&d.lead.isTest){outcome.skipped++;continue;}
  let lead=d.lead;if(d.site==='north'){const current=(await root(db).collection('leads').doc(snap.id).get()).data();if(current)lead=current;}
  const identity=emailHash(address);if(seen.has(identity)||!requested(d,lead)||await suppressed(db,lead)){outcome.skipped++;continue;}seen.add(identity);
  // One message per email/brand/week, even if it has multiple forms or both sites.
  const delivery=root(db).collection('websiteEmailDeliveries').doc(`${identity}-${week}${controlled?'-controlled-'+d.site:''}`);
  const claimed=await db.runTransaction(async tx=>{if((await tx.get(delivery)).exists)return false;tx.create(delivery,{tenantId:TENANT,brandId:BRAND,requestId:snap.id,site:d.site,status:'preparing',week,createdAt:stamp,controlled});return true;});
  if(!claimed){outcome.skipped++;continue;}
  try{
   const matches=await email.matchingListings(d.site,d.profile,{weekly:true,fetcher});
   // Send the weekly status and saved-search link even when no new homes match.
   if(await suppressed(db,lead)){await delivery.update({status:'suppressed',checkedAt:stamp});outcome.skipped++;continue;}
   const started=typeof d.createdAt?.toMillis==='function'?d.createdAt.toMillis():Date.parse(d.createdAt)||Date.now(),edition=Math.max(0,Math.floor((Date.now()-started)/604800000));
   const content=email.render({site:d.site,lead,criteria:d.profile,matches,unsubscribeUrl:email.preferenceUrl(snap.id,secret),config:brand.websiteFunnel,weekly:true,edition});
   await delivery.update({status:'sending',listingIds:matches.cards.map(c=>c.id),templateVersion:content.templateVersion});
   const receipt=await deliver({db,tenantId:TENANT,draftRef:snap.ref,draft:{...d,lead},config:{...brand.websiteFunnel,siteName:email.theme(d.site).name},content});
   await delivery.update({status:'sent',providerMessageId:receipt.id,sentAt:stamp});outcome.sent++;
  }catch(e){await delivery.update({status:'needs_reconciliation',error:String(e.message).slice(0,150),updatedAt:stamp});outcome.needsReview++;}
 }
 return outcome;
}
module.exports={preferences,run,requested,suppressed,emailHash,weekKey};
