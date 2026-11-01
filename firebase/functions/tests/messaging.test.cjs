const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const p = require('../messaging/policy.cjs');
const {createMessagingService} = require('../messaging/service.cjs');
const {verifySignature} = require('../telephony/providers.cjs');
const NOW = 1793548800000;
function fixtures() {
 const route = {tenantId:'tenant-a',brandId:'brand-gcr',brandName:'Golden Cross Realty',campaignIds:['pilot'],from:'+12815550123',numberId:'number-a',profileId:'profile-a',telnyxCampaignId:p.CAMPAIGN,tcrCampaignId:p.TCR,mode:'internal_test',enabled:true,internalTestNumbers:['+12815550124']};
 route.evidence = {...route,campaignStatus:'MNO_PROVISIONED',numberStatus:'ASSIGNED',optOutAutoResponseVerified:true,webhookVerified:true,checkedAtMs:NOW};
 const intake = {tenantId:route.tenantId,brandId:route.brandId,campaignId:'pilot',leadId:'lead-a',routeId:'gcr',to:route.internalTestNumbers[0],accepted:true,disclosureText:'Explicit GCR verification consent',disclosureVersion:'v1',sourceUrl:'https://example.test/form',consentPolicyId:'sms-v1',capturedAtMs:NOW};
 const lead = {tenantId:route.tenantId,brandId:route.brandId,campaignId:'pilot',phone:intake.to};
 return {route,intake,lead,suppression:{},enabled:true,now:NOW};
}
// Deterministic transaction harness: integration logic, not a Firestore emulator.
function harness(f = fixtures()) {
 const rows = new Map();
 const snapshot = path => ({exists:rows.has(path), data:()=>structuredClone(rows.get(path))});
 const db = {doc:path=>({path,get:async()=>snapshot(path),update:async x=>rows.set(path,{...rows.get(path),...x})}),runTransaction:async fn=>{
   const writes=[];
   const result=await fn({get:async ref=>snapshot(ref.path),set:(ref,value)=>writes.push(()=>rows.set(ref.path,structuredClone(value))),update:(ref,value)=>writes.push(()=>{assert(rows.has(ref.path));rows.set(ref.path,{...rows.get(ref.path),...structuredClone(value)});})});
   writes.forEach(fn=>fn()); return result;
 }};
 rows.set('smsIntakes/intake',f.intake); rows.set('smsRoutes/gcr',f.route);
 rows.set(`smsNumberRoutes/${p.hash(f.route.from)}`,f.route);
 const leadPath=`tenants/${f.route.tenantId}/leads/${f.intake.leadId}`;
 rows.set(leadPath,f.lead);
 const sends=[];
 const service=createMessagingService({db,now:()=>NOW,enabled:true,token:()=> 'test',transport:async(url,req)=>{sends.push(JSON.parse(req.body));return {ok:true,json:async()=>({data:{id:'provider-1'}})};}});
 const event=(text,id='event-1')=>({id,event_type:'message.received',occurred_at:new Date(NOW).toISOString(),payload:{id:'inbound-'+id,from:{phone_number:f.intake.to},to:[{phone_number:f.route.from}],messaging_profile_id:f.route.profileId,text}});
 return {rows,service,sends,event,leadPath,f};
}
test('strict route, campaign, consent, allowlist and evidence gating',()=>{
 p.assertAllowed(fixtures());
 for (const mutate of [f=>f.enabled=false,f=>f.route.mode='production',f=>f.route.telnyxCampaignId='other',f=>f.route.brandId='other',f=>f.intake.accepted=false,f=>f.route.internalTestNumbers=[],f=>f.suppression.blocked=true,f=>f.route.evidence.checkedAtMs=NOW-3600001,f=>f.route.evidence.profileId='other',f=>f.lead.phone='+12815550999']) {
  const f=fixtures();mutate(f);assert.throws(()=>p.assertAllowed(f));
 }
});
test('consent capture requires exact server disclosure and source; boolean legacy consent is insufficient',()=>{
 const route={...fixtures().route,smsRouteId:'gcr',smsDisclosureVersion:'v1',smsDisclosureText:'GCR consent',smsAllowedPageUrls:['https://example.test/form']};
 const payload={phone:'+12815550124',pageUrl:'https://example.test/form',consent:{sms:{accepted:true,disclosureVersion:'v1'}}};
 assert(p.captureConsent(route,payload,NOW));
 assert.equal(p.captureConsent(route,{...payload,consent:{sms:true}}),null);
 assert.equal(p.captureConsent(route,{...payload,pageUrl:'https://evil.test'}),null);
});
test('send once; code reply verifies correct lead; duplicate webhook adds no receipt; no raw OTP stored',async()=>{
 const h=harness();await h.service.send('intake');await h.service.send('intake');assert.equal(h.sends.length,1);
 const code=h.sends[0].text.match(/Reply (\d{6})/)[1];
 assert(!JSON.stringify([...h.rows]).includes(code));
 await h.service.webhook(h.event(code));
 assert.equal(h.rows.get(h.leadPath).smsVerification.status,'verified');
 const count=h.rows.get(h.leadPath).smsMessages.length;
 await h.service.webhook(h.event(code));assert.equal(h.rows.get(h.leadPath).smsMessages.length,count);
});
test('STOP persists suppression even without a lead binding; START never silently restores consent',async()=>{
 const h=harness();await h.service.webhook(h.event('STOP'));
 await h.service.webhook(h.event('START','event-2'));
 await h.service.send('intake');assert.equal(h.sends.length,0);
 assert.equal(h.rows.get(h.leadPath).smsVerification.reason,'recipient_opted_out');
});
test('STOP prevents verification after dispatch and duplicate messages',async()=>{
 const h=harness();await h.service.send('intake');const code=h.sends[0].text.match(/Reply (\d{6})/)[1];
 await h.service.webhook(h.event('STOP'));await h.service.webhook(h.event(code,'event-2'));
 assert.equal(h.rows.get(h.leadPath).smsVerification.status,'opted_out');
});
test('cross-profile callback rejects without mutating lead',async()=>{
 const h=harness();await h.service.send('intake');const e=h.event('123456');e.payload.messaging_profile_id='other';
 await assert.rejects(h.service.webhook(e));assert.equal(h.rows.get(h.leadPath).smsVerification.status,'pending');
});
test('delivery is separate from verification and cannot regress after final status',async()=>{
 const h=harness();await h.service.send('intake');
 const e={id:'delivery',event_type:'message.finalized',payload:{id:'provider-1',from:{phone_number:h.f.route.from},to:[{phone_number:h.f.intake.to,status:'delivered'}],messaging_profile_id:h.f.route.profileId}};
 await h.service.webhook(e);await h.service.webhook({...e,id:'sent-late',event_type:'message.sent'});
 assert.equal(h.rows.get('smsOutbound/intake').status,'delivered');assert.equal(h.rows.get(h.leadPath).smsVerification.status,'pending');
});
test('expired, replayed, exhausted and incorrect codes do not verify',()=>{
 const b={nonce:'nonce',codeHash:p.hash('nonce','123456'),status:'reserved',attempts:0,createdAtMs:NOW-100,expiresAtMs:NOW+100};
 assert(p.validateReply(b,'123456',NOW,NOW));
 for(const [state,code,time,eventTime] of [[b,'123455',NOW,NOW],[b,'123456',NOW+101,NOW],[{...b,attempts:5},'123456',NOW,NOW],[b,'123456',NOW,NOW-101],[{...b,status:'verified'},'123456',NOW,NOW]]) assert(!p.validateReply(state,code,time,eventTime));
});
test('signed webhook rejects tampering and stale signatures',()=>{
 const keys=crypto.generateKeyPairSync('ed25519');const publicKey=keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64');
 const timestamp=String(NOW/1000),rawBody=Buffer.from('{"data":{}}');
 const signature=crypto.sign(null,Buffer.concat([Buffer.from(timestamp+'|'),rawBody]),keys.privateKey).toString('base64');
 assert(verifySignature('telnyx',{rawBody,signature,timestamp},{publicKey},NOW));
 assert(!verifySignature('telnyx',{rawBody:Buffer.from('tampered'),signature,timestamp},{publicKey},NOW));
 assert(!verifySignature('telnyx',{rawBody,signature,timestamp},{publicKey},NOW+301000));
});
test('changed lead phone cannot inherit verification from old handset',async()=>{
 const h=harness();await h.service.send('intake');const code=h.sends[0].text.match(/Reply (\d{6})/)[1];
 h.rows.set(h.leadPath,{...h.rows.get(h.leadPath),phone:'+12815550999'});
 await h.service.webhook(h.event(code));assert.equal(h.rows.get(h.leadPath).smsVerification.status,'pending');
});
test('delivery callback with another recipient cannot update the lead',async()=>{
 const h=harness();await h.service.send('intake');
 await assert.rejects(h.service.webhook({id:'wrong-recipient',event_type:'message.finalized',payload:{id:'provider-1',from:{phone_number:h.f.route.from},to:[{phone_number:'+12815550999',status:'delivered'}],messaging_profile_id:h.f.route.profileId}}));
 assert.equal(h.rows.get('smsOutbound/intake').status,'accepted');
});
test('a second lead cannot steal an existing sender/recipient conversation',async()=>{
 const h=harness();await h.service.send('intake');
 h.rows.set('smsIntakes/second',{...h.f.intake,leadId:'lead-b'});
 h.rows.set('tenants/tenant-a/leads/lead-b',{...h.f.lead});
 await h.service.send('second');assert.equal(h.sends.length,1);
 assert.equal(h.rows.get('tenants/tenant-a/leads/lead-b').smsVerification.reason,'existing_conversation_requires_review');
});
