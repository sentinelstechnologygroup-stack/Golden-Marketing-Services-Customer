const test=require('node:test');const assert=require('node:assert/strict');
const {agentDial,leadDial,agentDestination}=require('../telephony/server-dial.cjs');
const call={tenantId:'gcr',from:'+19365550123',destination:'+12025550123',agentSipUsername:'gencred-test'};
test('agent-first dialing uses provisioned SIP identity and server-selected number',()=>{
 const result=agentDial('call-one',call,'https://gms.example/webhook');
 assert.equal(result.to,'sip:gencred-test@sip.telnyx.com');assert.equal(result.from,call.from);
 assert.deepEqual(JSON.parse(Buffer.from(result.clientState,'base64').toString()),{gmsCallId:'call-one',tenantId:'gcr',legRole:'agent'});
 assert.equal(result.commandId,agentDial('call-one',call,'https://gms.example/webhook').commandId);
});
test('lead cannot be dialed before agent answer and authorization state',()=>{
 assert.throws(()=>leadDial('call-one',call,'https://gms.example/webhook'));
 const result=leadDial('call-one',{...call,agentCallId:'signed-agent-leg',agentLegStatus:'answered',leadDialStatus:'requested'},'https://gms.example/webhook');
 assert.equal(result.to,call.destination);assert.equal(result.linkTo,'signed-agent-leg');
 assert.notEqual(result.commandId,agentDial('call-one',call,'https://gms.example/webhook').commandId);
});
test('unprovisioned or substituted SIP destinations are rejected',()=>{
 for(const value of ['sip:evil@elsewhere','foo@elsewhere','../agent','']) assert.throws(()=>agentDestination(value));
});

test('conference leads are not auto-bridged to the agent, while two-party fallback stays unchanged',()=>{const ready={...call,agentCallId:'agent-leg',agentLegStatus:'answered',leadDialStatus:'requested',conferenceMode:true};const result=leadDial('call-one',ready,'https://gms.example/webhook');assert.equal(result.linkTo,undefined);assert.equal(result.to,call.destination);assert.equal(JSON.parse(Buffer.from(result.clientState,'base64')).legRole,'lead');});
