const {createHash,randomUUID,timingSafeEqual}=require('node:crypto');

// Server-to-server only. Stores HMAC digests, never IP addresses or form contents.
const policies={lead:{limit:10,windowMs:600000},search:{limit:8,windowMs:600000},session:{limit:180,windowMs:600000},idx:{limit:120,windowMs:60000}};
const hash=value=>createHash('sha256').update(value).digest('hex');
const isDigest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function auth(req,secret){const a=Buffer.from(String(req.get('authorization')||'').replace(/^Bearer\s+/i,'')),b=Buffer.from(secret||'');return b.length>0&&a.length===b.length&&timingSafeEqual(a,b);}
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>16000||!['north','brokerage'].includes(input.site)||!Object.hasOwn(policies,input.scope))throw Error('Invalid guard request');
 if(input.op==='finish'){
  if(!isDigest(input.claimId)||!/^[-a-f0-9]{36}$/.test(input.lockId||'')||!['complete','uncertain'].includes(input.state))throw Error('Invalid claim completion');
  if(input.state==='complete'){
   const r=input.response;if(!r||r.status!==202||r.body?.accepted!==true||!r.body.reference||JSON.stringify(r.body).length>12000)throw Error('Invalid receipt');
   const keys=['accepted','reference','sessionId','sessionToken','state','searchUrl','emailStatus'];if(Object.keys(r.body).some(k=>!keys.includes(k)))throw Error('Invalid receipt fields');
   if(r.body.searchUrl){const u=new URL(r.body.searchUrl);if(u.protocol!=='https:'||!['www.homesaroundnorthhouston.com','homesaroundnorthhouston.com','goldencrossrealty.net','www.goldencrossrealty.net','goldencrossrealty.com','www.goldencrossrealty.com'].includes(u.hostname))throw Error('Invalid receipt link');}
  }
 }else{
  if(!['rate','claim'].includes(input.op)||!isDigest(input.clientKey))throw Error('Invalid rate request');
  if(input.op==='claim'&&(!/^[-a-f0-9]{36}$/i.test(input.submissionId||'')||!isDigest(input.fingerprint)))throw Error('Invalid claim');
 }
 return input;
}
async function operate(db,input,now=Date.now()){
 const b=validate(input),policy=policies[b.scope];
 if(b.op==='finish'){
  const ref=db.doc('websiteIntakeClaims/'+b.claimId);
  return db.runTransaction(async tx=>{const prior=(await tx.get(ref)).data();if(!prior||prior.site!==b.site||prior.scope!==b.scope||prior.lockId!==b.lockId)return {status:409,body:{allowed:false,error:'Claim mismatch'}};
   // A confirmed receipt must never be downgraded by a late timeout handler.
   if(prior.state==='complete')return {status:200,body:{allowed:true,completed:true}};
   if(prior.state==='uncertain')return {status:409,body:{allowed:false,error:'Receipt requires reconciliation'}};
   tx.update(ref,{state:b.state,updatedAt:new Date(now),...(b.state==='complete'?{response:b.response}:{})});return {status:200,body:{allowed:true,completed:b.state==='complete'}};
  });
 }
 const bucket=Math.floor(now/policy.windowMs),rateRef=db.doc('websiteIntakeRateLimits/'+hash(`${b.site}:${b.scope}:${b.clientKey}:${bucket}`));
 const claimId=b.op==='claim'?hash(`${b.site}:${b.scope}:${b.submissionId.toLowerCase()}`):null,claimRef=claimId?db.doc('websiteIntakeClaims/'+claimId):null;
 return db.runTransaction(async tx=>{
  const [rateSnap,claimSnap]=await Promise.all([tx.get(rateRef),claimRef?tx.get(claimRef):Promise.resolve(null)]),rate=rateSnap.data(),prior=claimSnap?.data();
  if(prior){
   if(prior.fingerprint!==b.fingerprint)return {status:409,body:{allowed:false,error:'Submission changed. Start a new request.'}};
   if(prior.state==='complete')return {status:200,body:{allowed:false,replay:prior.response}};
   return {status:409,body:{allowed:false,error:prior.state==='uncertain'?'Receipt requires reconciliation. Contact the office.':'Request already being processed. Contact the office before resubmitting.'}};
  }
  if((rate?.count||0)>=policy.limit)return {status:429,body:{allowed:false,retryAfter:Math.max(1,Math.ceil(((bucket+1)*policy.windowMs-now)/1000)),error:'Please wait before trying again.'}};
  tx.set(rateRef,{count:(rate?.count||0)+1,site:b.site,scope:b.scope,expiresAt:new Date((bucket+2)*policy.windowMs)});
  if(!claimRef)return {status:200,body:{allowed:true}};
  const lockId=randomUUID();tx.create(claimRef,{site:b.site,scope:b.scope,fingerprint:b.fingerprint,lockId,state:'claimed',createdAt:new Date(now),updatedAt:new Date(now),expiresAt:new Date(now+90*86400000)});
  return {status:200,body:{allowed:true,claimId,lockId}};
 });
}
exports.handler=async(req,res)=>{
 res.set('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 if(!auth(req,process.env.GMS_INGESTION_KEY))return res.status(401).json({error:'Unauthorized'});
 try{const r=await operate(require('firebase-admin/firestore').getFirestore(),req.body);if(r.body.retryAfter)res.set('Retry-After',String(r.body.retryAfter));return res.status(r.status).json(r.body);}catch(error){const invalid=String(error.message).startsWith('Invalid');if(!invalid)console.error('Intake guard unavailable');return res.status(invalid?400:503).json({allowed:false,error:invalid?'Invalid guard request':'Intake temporarily unavailable'});}
};
exports.operate=operate;exports.validate=validate;exports.policies=policies;
