const test=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');const path=require('node:path');const {pathToFileURL}=require('node:url');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Emulator required');process.env.GMS_INGESTION_KEY='local-only-intake-key';
const bridge=require('../bridge');const {getFirestore}=require('firebase-admin/firestore');const db=getFirestore();
const serve=async handler=>{const server=http.createServer(async(req,res)=>{req.get=name=>req.headers[name.toLowerCase()] || '';res.status=code=>{res.statusCode=code;return res};res.json=value=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));return res};let raw='';for await(const chunk of req)raw+=chunk;req.body=JSON.parse(raw || '{}');await handler(req,res)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server};
test('HTTP website API -> GMS ingestion -> real emulator queue -> receipt; retries and paused routes verified',async()=>{
 const tenantId=`http-intake-${Date.now()}`;const routeKey=tenantId+'--website';
 const route={tenantId,brandId:'brand-one',industryId:'real-estate',sourceId:'source-one',campaignId:'campaign-one',routingProfileId:'routing-one',workflowVersion:'v1',scriptSetId:'script-one',qualificationFormId:'form-one',consentPolicyId:'consent-one',retentionPolicyId:'retention-one',status:'active',assignedAgentUids:['phone-staff'],intakeStage:'gms_qualification'};
 await Promise.all([db.doc(`tenants/${tenantId}`).set({demo:false}),db.doc(`tenants/${tenantId}/brands/brand-one`).set({name:'Synthetic Brokerage'}),db.doc(`ingestionRoutes/${routeKey}`).set(route)]);
 const upstream=await serve(bridge.ingestWebsiteLead);
 process.env.LEAD_WEBHOOK_URL=`http://127.0.0.1:${upstream.address().port}`;process.env.LEAD_WEBHOOK_TOKEN='local-only-intake-key';process.env.GMS_LEAD_ROUTE_KEY=routeKey;
 const website=await import(pathToFileURL(path.resolve(__dirname,'../../../../../HomesAroundNorthHouston/homes-around-north-houston-v1/api/lead.js')));
 const api=await serve(website.default);const url=`http://127.0.0.1:${api.address().port}`;
 const payload={submissionId:'f6b3d30f-bd4c-4490-875f-0c087ec9e7c1',name:'Synthetic HTTP Lead',email:'synthetic@example.test',phone:'2025550100',interested_in:'investing',consentAccepted:true,consentVersion:'north-houston-inquiry-v1',formStartedAt:new Date(Date.now()-5000).toISOString(),funnelProfile:{area:'Conroe',workingWithAgent:'no'},attribution:{gclid:'synthetic-click'},tenantId:'foreign',isTest:true};
 const post=()=>fetch(url,{method:'POST',headers:{origin:'https://homes-around-north-houston-v1.vercel.app','content-type':'application/json'},body:JSON.stringify(payload)});
 try{
  const first=await post();assert.equal(first.status,202);const receipt=await first.json();const retry=await post();assert.equal(retry.status,202);assert.equal((await retry.json()).reference,receipt.reference);
  const leads=await db.collection(`tenants/${tenantId}/leads`).get();assert.equal(leads.size,1);const lead=leads.docs[0].data();assert.equal(lead.phone,'+12025550100');assert.equal(lead.tenantId,tenantId);assert.equal(lead.intakeStage,'gms_qualification');assert.equal(lead.qualificationStatus,'pending');assert.equal(lead.attribution.gclid,'synthetic-click');assert.equal(lead.consent.smsAccepted,false);
  const notes=await db.collection(`tenants/${tenantId}/notifications`).get();assert.equal(notes.size,1);assert.equal(notes.docs[0].data().recipientUid,'phone-staff');
  await db.doc(`ingestionRoutes/${routeKey}`).update({status:'paused'});assert.equal((await post()).status,503);
 }finally{await Promise.all([new Promise(resolve=>api.close(resolve)),new Promise(resolve=>upstream.close(resolve))]);}
});
