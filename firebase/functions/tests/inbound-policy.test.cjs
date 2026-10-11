const test=require('node:test');
const assert=require('node:assert/strict');
const {openNow,eligible,canClaim}=require('../telephony/inbound-policy.cjs');
const route={enabled:true,timezone:'America/Chicago',openMinute:540,closeMinute:1140};
const now=Date.parse('2026-10-10T16:00:00Z');
const assignment={status:'active',role:'agent',brandIds:['gcr'],agentStatus:'available',inboundEnabled:true,telnyxCredentialId:'credential',presenceUpdatedAt:{toMillis:()=>now}};
test('Central daily hours follow daylight saving with closing boundary excluded',()=>{
 assert.equal(openNow(route,new Date('2026-10-10T13:59:00Z')),false);
 assert.equal(openNow(route,new Date('2026-10-10T14:00:00Z')),true);
 assert.equal(openNow(route,new Date('2026-10-11T00:00:00Z')),false);
 assert.equal(openNow(route,new Date('2026-12-10T14:59:00Z')),false);
 assert.equal(openNow(route,new Date('2026-12-10T15:00:00Z')),true);
});
test('inbound offers exclude other brands, stale presence, unavailable and revoked staff',()=>{
 assert.ok(eligible(assignment,'gcr',now));
 for(const patch of [{status:'revoked'},{role:'ai_admin'},{agentStatus:'break'},{inboundEnabled:false},{presenceUpdatedAt:{toMillis:()=>now-80000}}])assert.equal(eligible({...assignment,...patch},'gcr',now),false);
 assert.equal(eligible(assignment,'different-brand',now),false);
});
test('only pending, unexpired offers can be claimed; accepted calls cannot be claimed twice',()=>{
 const call={status:'queued',brandId:'gcr',queueDeadline:{toMillis:()=>now+10000}};
 assert.ok(canClaim(call,route,assignment,now));
 assert.equal(canClaim({...call,status:'dialing_agent'},route,assignment,now),false);
 assert.equal(canClaim(call,{...route,enabled:false},assignment,now),false);
 assert.equal(canClaim({...call,queueDeadline:{toMillis:()=>now-1}},route,assignment,now),false);
});

test('stale queue timeout cannot move an accepted or connected caller to voicemail',()=>{
 const {canFallback}=require('../telephony/inbound-policy.cjs');
 assert.equal(canFallback({status:'queued'},'queued'),true);
 for(const status of ['dialing_agent','bridging_agent','in_progress','on_hold','completed'])assert.equal(canFallback({status},'queued'),false);
 assert.equal(canFallback({status:'dialing_agent'},'dialing_agent'),true);
});
test('signed auxiliary events may omit addresses but may not contradict bound ownership',()=>{
 const {ownsEvent}=require('../telephony/inbound-policy.cjs');
 const mapping={connectionId:'connection',from:'from',to:'to'};
 assert.equal(ownsEvent(mapping,{eventType:'conference.participant.joined'}),true);
 assert.equal(ownsEvent(mapping,{eventType:'call.recording.saved',connectionId:'foreign'}),false);
 assert.equal(ownsEvent(mapping,{eventType:'call.answered'}),false);
 assert.equal(ownsEvent(mapping,{eventType:'call.answered',...mapping}),true);
});
