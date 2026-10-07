const crypto=require('node:crypto');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {defineSecret}=require('firebase-functions/params');
const {HttpsError,onCall,onRequest}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {stateHash,verifiedToken,resolveAuthorization,installUrl}=require('./gohighlevel-oauth-policy.cjs');
const {readToken,writeToken,secretId}=require('./gohighlevel-oauth-store.cjs');
const clientSecret=defineSecret('GMS_GHL_OAUTH_CLIENT');
const db=getFirestore();
const options={secrets:[clientSecret],maxInstances:2,timeoutSeconds:120};
const config=()=>JSON.parse(clientSecret.value());
async function exchange(fields,userType='Location') {
  const client=config();
  const response=await fetch('https://services.leadconnectorhq.com/oauth/token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json',Version:'v3','User-Agent':'GMS-CRM/1.0'},
    body:new URLSearchParams({client_id:client.clientId,client_secret:client.clientSecret,redirect_uri:client.redirectUri,user_type:userType,...fields}),
  });
  if(!response.ok) throw new Error(`Authorization exchange failed (${response.status}).`);
  return response.json();
}
async function deriveLocation(agencyAccessToken,expected) {
  const response=await fetch('https://services.leadconnectorhq.com/oauth/location-token',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{Authorization:`Bearer ${agencyAccessToken}`,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json',Version:'v3'},
    body:new URLSearchParams({companyId:expected.companyId,locationId:expected.locationId}),
  });
  if(!response.ok) throw new Error(`Location authorization exchange failed (${response.status}).`);
  return response.json();
}
async function readProfile(accessToken,locationId) {
  const response=await fetch(`https://services.leadconnectorhq.com/locations/${encodeURIComponent(locationId)}`,{
    redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${accessToken}`,Version:'2021-07-28',Accept:'application/json'},
  });
  if(!response.ok) throw new Error(`Authorization profile check failed (${response.status}).`);
  return (await response.json()).location;
}
async function owner(tenantId,locationId) {
  const [tenant,mapping,connection,draft]=await Promise.all([
    db.doc(`tenants/${tenantId}`).get(),db.doc(`ghlLocationTenants/${locationId}`).get(),
    db.doc(`gmsProviderConnections/${tenantId}`).get(),db.doc(`tenants/${tenantId}/config/onboarding`).get(),
  ]);
  if(tenant.data()?.environment!=='production' || tenant.data()?.demo || mapping.data()?.tenantId!==tenantId || connection.data()?.locationId!==locationId || draft.data()?.data?.locationId!==locationId) throw new Error('Client location ownership is unavailable.');
}
exports.beginGmsCrmAuthorization=onCall({...options,enforceAppCheck:true},async request=>{
  if(!request.auth?.uid) throw new HttpsError('unauthenticated','Sign in first.');
  const user=await getAuth().getUser(request.auth.uid);
  if(user.disabled || user.customClaims?.mustChangePassword || !(user.customClaims?.gmsSuperAdmin || user.customClaims?.platformAdmin)) throw new HttpsError('permission-denied','GMS administration is required.');
  const {tenantId,locationId}=request.data || {};
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(tenantId || '') || !/^[A-Za-z0-9_-]{1,60}$/.test(locationId || '')) throw new HttpsError('invalid-argument','Client identifiers are required.');
  await owner(tenantId,locationId);
  const state=crypto.randomBytes(32).toString('base64url');
  const companyId=process.env.GMS_GHL_COMPANY_ID;
  if(!companyId) throw new HttpsError('failed-precondition','GMS agency is not configured.');
  await db.doc(`gmsOAuthStates/${stateHash(state)}`).create({tenantId,locationId,companyId,actorUid:user.uid,status:'pending',expiresAtMs:Date.now()+15*60000,createdAt:FieldValue.serverTimestamp()});
  return {url:installUrl(process.env.GMS_GHL_INSTALL_BASE,config(),state)};
});
exports.gmsCrmOAuthCallback=onRequest(options,async(request,response)=>{
  response.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').set('X-Content-Type-Options','nosniff');
  if(request.method!=='GET') return response.status(405).send('Method not allowed.');
  let stateRef,state,stage='state_validation',grantMetadata;
  try {
    stateRef=db.doc(`gmsOAuthStates/${stateHash(request.query.state)}`);
    const code=request.query.code;
    if(typeof code!=='string' || !code || code.length>2048 || request.query.error) throw new Error('Authorization was not granted.');
    state=await db.runTransaction(async tx=>{
      const saved=await tx.get(stateRef),value=saved.data();
      if(!value || value.status!=='pending' || value.expiresAtMs<Date.now()) throw new Error('Authorization state expired or already used.');
      tx.update(stateRef,{status:'exchanging',startedAt:FieldValue.serverTimestamp()}); return value;
    });
    stage='initiator_validation';
    const actor=await getAuth().getUser(state.actorUid);
    if(actor.disabled || actor.customClaims?.mustChangePassword || !(actor.customClaims?.gmsSuperAdmin || actor.customClaims?.platformAdmin)) throw new Error('Authorization initiator is unavailable.');
    stage='ownership_validation';
    await owner(state.tenantId,state.locationId);
    stage='agency_exchange';
    const grant=await exchange({grant_type:'authorization_code',code},'Company');
    grantMetadata={userType:typeof grant.userType==='string'?grant.userType:'missing',companyId:typeof grant.companyId==='string'?grant.companyId:'missing',scopes:String(grant.scope || '').split(/\s+/).filter(Boolean),expiresIn:typeof grant.expires_in==='number'?grant.expires_in:null,installToFutureLocations:grant.installToFutureLocations===true};
    stage='location_conversion';
    const value=await resolveAuthorization(grant,state,{deriveLocation,readProfile});
    stage='ownership_revalidation';
    await owner(state.tenantId,state.locationId);
    stage='secure_storage';
    const version=await writeToken(state.locationId,value);
    stage='connection_metadata';
    await db.doc(`gmsProviderConnections/${state.tenantId}`).set({oauthStatus:'connected',oauthSecretId:secretId(state.locationId),oauthVersion:version,oauthExpiresAtMs:value.expiresAtMs,oauthRotatedAtMs:value.rotatedAtMs},{merge:true});
    await stateRef.update({status:'complete',completedAt:FieldValue.serverTimestamp()});
    await db.doc(`tenants/${state.tenantId}/auditLogs/${crypto.randomUUID()}`).create({tenantId:state.tenantId,actorUid:state.actorUid,action:'gohighlevel.oauth.connected',target:state.locationId,occurredAt:FieldValue.serverTimestamp()});
    return response.status(200).send('GMS client authorization is connected. You can return to the Agent Portal.');
  } catch(error) {
    // Persist only fixed stage and numeric HTTP status, never provider bodies,
    // error messages, codes, state values or credential-bearing objects.
    const httpStatus=Number(/\((\d{3})\)/.exec(error?.message || '')?.[1]) || null;
    const reasons={'Authorization agency mismatch.':'agency_mismatch','Authorization scope mismatch.':'scope_mismatch','Invalid authorization response.':'invalid_token_response','Authorization ownership mismatch.':'location_mismatch','Authorization profile mismatch.':'profile_mismatch'};
    const reason=reasons[error?.message] || 'operation_failed';
    if(state) await stateRef.set({status:'needs_reconciliation',failureStage:stage,failureReason:reason,failureHttpStatus:httpStatus,...(grantMetadata?{grantMetadata}:{}),...(error?.scopeDiagnostic?{scopeDiagnostic:error.scopeDiagnostic}:{}),failedAt:FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    console.warn('gms_oauth_callback_failed',{stage,httpStatus});
    return response.status(400).send('GMS authorization could not be completed. Return to the Agent Portal and request a new authorization.');
  }
});
exports.refreshGmsCrmAuthorizations=onSchedule({...options,schedule:'every 60 minutes',timeZone:'America/Chicago',retryCount:0},async()=>{
  const connections=await db.collection('gmsProviderConnections').where('oauthStatus','==','connected').get();
  for(const doc of connections.docs) {
    const locationId=doc.data().locationId,tenantId=doc.id;
    try {
      await owner(tenantId,locationId);
      const token=await readToken(locationId);
      if(!token || token.expiresAtMs>Date.now()+2*3600000) continue;
      const leaseRef=db.doc(`gmsOAuthRefreshLeases/${locationId}`),operationId=crypto.randomUUID();
      const acquired=await db.runTransaction(async tx=>{
        const lease=(await tx.get(leaseRef)).data();
        if(lease?.status==='needs_reconciliation' || lease?.leaseUntilMs>Date.now()) return false;
        tx.set(leaseRef,{operationId,status:'in_progress',leaseUntilMs:Date.now()+10*60000}); return true;
      });
      if(!acquired) continue;
      try {
        const fresh=await readToken(locationId);
        if(fresh.expiresAtMs>Date.now()+2*3600000) {await leaseRef.update({status:'complete',leaseUntilMs:0});continue;}
        const value=verifiedToken(await exchange({grant_type:'refresh_token',refresh_token:fresh.refreshToken}),fresh);
        const version=await writeToken(locationId,value);
        await doc.ref.set({oauthVersion:version,oauthExpiresAtMs:value.expiresAtMs,oauthRotatedAtMs:value.rotatedAtMs},{merge:true});
        await leaseRef.update({status:'complete',leaseUntilMs:0,completedAt:FieldValue.serverTimestamp()});
      } catch {
        // A lost response can consume a single-use refresh token. Do not replay
        // it blindly; retain the saved version and signal reconciliation.
        await leaseRef.update({status:'needs_reconciliation',leaseUntilMs:0});
        await doc.ref.set({oauthStatus:'needs_reconciliation'},{merge:true});
      }
    } catch {
      await doc.ref.set({oauthHealth:'attention_required',oauthCheckedAt:FieldValue.serverTimestamp()},{merge:true});
    }
  }
});
