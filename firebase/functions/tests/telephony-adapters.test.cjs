const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createProvider,selectedProvider,verifySignature}=require('../telephony/providers.cjs');
const {normalizeEvent,statusCanAdvance}=require('../telephony/events.cjs');
const {twilioToken}=require('../telephony/browser-session.cjs');
for(const provider of ['twilio','telnyx','signalwire']) test(`${provider}: authenticated transport and participant hold`,async()=>{
 const requests=[];
 const api=createProvider(provider,{accountId:'account',token:'private-token',connectionId:'connection',spaceUrl:'https://gms.signalwire.com'},async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>provider==='telnyx'?{data:{call_control_id:'leg'}}:{sid:'leg'}};});
 const call=await api.start({to:'+15550000001',from:'+15550000002',voiceUrl:'https://example.com/voice',callbackUrl:'https://example.com/status'});
 assert.equal(call.id,'leg');
 await api.hold('conference','leg',true);
 assert.match(requests[1].url,provider==='telnyx'?/actions\/hold$/:/Participants\/leg.json$/);
 assert.ok(requests[0].options.headers.Authorization);
 assert.doesNotMatch(JSON.stringify(call),/private-token/);
});
test('selection rejects unknown providers and SignalWire rejects arbitrary hosts',()=>{
 assert.throws(()=>selectedProvider('both')); assert.throws(()=>createProvider('signalwire',{accountId:'x',token:'y',spaceUrl:'https://attacker.example'}));
});
test('compatibility signatures reject altered content',()=>{
 const url='https://example.com/status',body={CallSid:'one',CallStatus:'completed'},token='secret';
 const signature=crypto.createHmac('sha1',token).update(url+'CallSidoneCallStatuscompleted').digest('base64');
 assert.equal(verifySignature('twilio',{url,body,signature},{token}),true);
 assert.equal(verifySignature('twilio',{url,body:{...body,CallSid:'two'},signature},{token}),false);
});
test('Telnyx signatures reject stale events',()=>{
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const rawBody=Buffer.from('{"data":{}}'),timestamp='1000';
 const signature=crypto.sign(null,Buffer.concat([Buffer.from(timestamp+'|'),rawBody]),privateKey).toString('base64');
 const key=publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64');
 assert.equal(verifySignature('telnyx',{rawBody,timestamp,signature},{publicKey:key},1000000),true);
 assert.equal(verifySignature('telnyx',{rawBody,timestamp,signature},{publicKey:key},2000000),false);
});
test('terminal calls cannot regress from replayed ringing events',()=>{
 assert.equal(statusCanAdvance('completed','ringing'),false);
 assert.equal(statusCanAdvance('in_progress','ringing'),false);
 assert.equal(statusCanAdvance('ringing','in_progress'),true);
});
test('normalized events carry provider identifiers',()=>{
 assert.equal(normalizeEvent('telnyx',{data:{id:'event',event_type:'call.answered',payload:{call_control_id:'leg'}}},Buffer.from('')).answered,true);
});
test('Telnyx client state correlates browser calls without trusting a destination',()=>{
 const client_state=Buffer.from(JSON.stringify({tenantId:'tenant-one',gmsCallId:'call-one'})).toString('base64');
 const event=normalizeEvent('telnyx',{data:{id:'event',event_type:'call.initiated',payload:{call_control_id:'provider-leg',client_state}}},Buffer.from(''));
 assert.equal(event.tenantId,'tenant-one'); assert.equal(event.gmsCallId,'call-one'); assert.equal(event.callId,'provider-leg');
});
test('Telnyx can hold a direct browser call before any conference handoff',async()=>{
 const requests=[];
 const api=createProvider('telnyx',{token:'private-token',connectionId:'connection'},async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({data:{result:'ok'}})};});
 await api.holdCall('provider-leg',true);
 assert.match(requests[0].url,/calls\/provider-leg\/actions\/hold$/);
});
test('browser token binds identity and grants without exposing API secret',()=>{
 const token=twilioToken({accountId:'account',keyId:'key',keySecret:'private',applicationId:'app'},'gms_agent',1000);
 const body=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
 assert.equal(body.grants.identity,'gms_agent'); assert.equal(body.exp,4600); assert.equal(body.grants.voice.outgoing.application_sid,'app'); assert.doesNotMatch(JSON.stringify(body),/private/);
});
