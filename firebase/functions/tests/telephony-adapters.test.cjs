const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createProvider,selectedProvider,verifySignature}=require('../telephony/providers.cjs');
const {normalizeEvent,statusCanAdvance}=require('../telephony/events.cjs');
const {browserSession}=require('../telephony/browser-session.cjs');
for(const provider of ['telnyx']) test(`${provider}: authenticated transport and participant hold`,async()=>{
 const requests=[];
 const api=createProvider(provider,{accountId:'account',token:'private-token',connectionId:'connection',spaceUrl:'https://gms.signalwire.com'},async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>provider==='telnyx'?{data:{call_control_id:'leg'}}:{sid:'leg'}};});
 const call=await api.start({to:'+15550000001',from:'+15550000002',voiceUrl:'https://example.com/voice',callbackUrl:'https://example.com/status'});
 assert.equal(call.id,'leg');
 await api.hold('conference','leg',true);
 assert.match(requests[1].url,provider==='telnyx'?/actions\/hold$/:/Participants\/leg.json$/);
 assert.ok(requests[0].options.headers.Authorization);
 assert.doesNotMatch(JSON.stringify(call),/private-token/);
});
test('selection rejects other providers',()=>{assert.throws(()=>selectedProvider('legacy'));});
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
test('Telnyx browser tokens require a provisioned agent and never return the API key',async()=>{
 await assert.rejects(()=>browserSession('telnyx',{token:'private-api-key'},'agent',{}));
 const session=await browserSession('telnyx',{token:'private-api-key'},'agent',{telnyxCredentialId:'credential'},async(url,opts)=>{assert.match(url,/telephony_credentials\/credential\/token$/);assert.equal(opts.headers.Authorization,'Bearer private-api-key');return {ok:true,text:async()=>'short-lived-token'};});
 assert.equal(session.token,'short-lived-token');assert.doesNotMatch(JSON.stringify(session),/private-api-key/);
});
