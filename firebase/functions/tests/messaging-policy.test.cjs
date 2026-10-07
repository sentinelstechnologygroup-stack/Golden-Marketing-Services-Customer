const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const policy=require('../messaging-policy.cjs');
test('provider delivery requires an exact raw-body Ed25519 signature',()=>{
  const keys=crypto.generateKeyPairSync('ed25519'),raw=Buffer.from('{"type":"SMS"}'),sig=crypto.sign(null,raw,keys.privateKey).toString('base64');
  assert.equal(policy.signedDelivery(raw,sig,keys.publicKey),true);
  assert.equal(policy.signedDelivery(Buffer.from('{ "type":"SMS"}'),sig,keys.publicKey),false);
  assert.equal(policy.signedDelivery(raw,'N/A',keys.publicKey),false);
});
test('SMS payload rejects other channels, attachments, invalid phones and traversal IDs',()=>{
  const body={type:'SMS',locationId:'gcr',contactId:'contact',messageId:'message',phone:'+12025550123',message:'Test'};
  assert.equal(policy.delivery({...body,from:'+15555550100'}).from,undefined);
  for(const patch of [{type:'Email'},{attachments:['https://foreign.example/image']},{phone:'+442012345678'},{contactId:'../foreign'},{message:'x'.repeat(1601)}]) assert.throws(()=>policy.delivery({...body,...patch}));
});
test('segment limits account for GSM extensions, multipart messages and emoji',()=>{
  assert.equal(policy.segments('a'.repeat(160)),1);assert.equal(policy.segments('a'.repeat(161)),2);
  assert.equal(policy.segments('^'.repeat(80)),1);assert.equal(policy.segments('^'.repeat(81)),2);
  assert.equal(policy.segments('😀'.repeat(35)),1);assert.equal(policy.segments('😀'.repeat(36)),2);
});
test('sender selection requires documented consent, registration, matching brand and budget',()=>{
  const to='+12025550123',lead={phone:to,brandId:'gcr'},consent={phone:to,status:'opted_in',evidenceReference:'approved-opt-in',consentedAtMs:Date.now()-1000},number={provider:'telnyx',status:'active',brandId:'gcr',phoneNumber:'+19365550123',messagingProfileId:'profile'},config={enabled:true,registrationStatus:'approved',providerId:'provider',messagingProfileId:'profile',dailySegmentLimit:100};
  assert.equal(policy.maySend(consent,lead,number,config,to),number.phoneNumber);
  assert.throws(()=>policy.maySend({...consent,status:'opted_out'},lead,number,config,to));
  assert.throws(()=>policy.maySend(consent,{...lead,doNotContact:true},number,config,to));
  assert.throws(()=>policy.maySend(consent,lead,{...number,brandId:'foreign'},config,to));
  assert.throws(()=>policy.maySend(consent,lead,number,{...config,dailySegmentLimit:0},to));
  assert.equal(policy.isOptOut(' stop '),true);assert.equal(policy.isOptOut('Please stop by tomorrow'),false);
});
test('monetary reservations enforce the approved dollar cap and fail closed on stale rates',()=>{
 const config={dailyBudgetMicrosUsd:1000000,costCeilingMicrosUsdPerSegment:100000,dailySegmentLimit:20,rateVerifiedAtMs:Date.now()-1000};
 assert.deepEqual(policy.reserveBudget(config,{reservedMicrosUsd:900000,reservedSegments:9},1),{reservedMicrosUsd:1000000,reservedSegments:10});
 assert.throws(()=>policy.reserveBudget(config,{reservedMicrosUsd:900000,reservedSegments:9},2));
 assert.throws(()=>policy.reserveBudget({...config,rateVerifiedAtMs:Date.now()-73*60*60*1000},{},1));
 assert.throws(()=>policy.reserveBudget({...config,costCeilingMicrosUsdPerSegment:undefined},{},1));
 assert.throws(()=>policy.reserveBudget(config,{reservedMicrosUsd:-1},1));
});
