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
 for(const patch of [{status:'revoked'},{role:'ai_admin'},{agentStatus:'break'},{agentStatus:'lunch'},{agentStatus:'standby'},{agentStatus:'do_not_disturb'},{agentStatus:'after_call_work'},{inboundEnabled:false},{presenceUpdatedAt:{toMillis:()=>now-80000}}])assert.equal(eligible({...assignment,...patch},'gcr',now),false);
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

test('music buffer is a short original mono WAV suitable for inline provider playback',()=>{
 const {holdMusic}=require('../telephony/hold-music.cjs');const audio=Buffer.from(holdMusic(),'base64');
 assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.toString('ascii',8,12),'WAVE');assert.equal(audio.readUInt32LE(24),8000);assert.equal(audio.readUInt16LE(22),1);assert.ok(audio.length<1000000);assert.equal(audio.readUInt32LE(40)/(audio.readUInt32LE(24)*2),60);
});

test('agent offering waits for the exact recording notice to complete',()=>{
 const {noticeFinished}=require('../telephony/inbound-policy.cjs');const event={eventType:'call.speak.ended'},call={status:'recording_notice'},payload={status:'completed',client_state:Buffer.from(JSON.stringify({prompt:'recording_notice'})).toString('base64')};
 assert.equal(noticeFinished(event,payload,call),true);
 for(const status of ['call_hangup','cancelled_amd',undefined])assert.equal(noticeFinished(event,{...payload,status},call),false);
 assert.equal(noticeFinished({...event,eventType:'call.speak.started'},payload,call),false);
 assert.equal(noticeFinished(event,{...payload,client_state:Buffer.from(JSON.stringify({prompt:'voicemail'})).toString('base64')},call),false);
 assert.equal(noticeFinished(event,payload,{status:'in_progress'}),false);
});
test('approved same-mobile test handoffs retain Patrick first and Jonathan backup',()=>{
 const {plan}=require('../client-call-tree.cjs');const data={callTree:{mode:'fixed',recipients:[{id:'patrick',name:'Patrick',phone:'+12532226335'},{id:'jonathan',name:'Jonathan',phone:'+19365370568'}]}};
 assert.deepEqual(plan(data,0,undefined).recipients.map(r=>r.id),['patrick','jonathan']);
 assert.deepEqual(plan(data,0,'+12532226335').recipients.map(r=>r.id),['jonathan']);
});

test('legacy administrator operator remains eligible only with explicit brand and fresh presence',()=>{
 const a={status:'active',role:'admin',brandIds:['gcr'],agentStatus:'available',inboundEnabled:true,telnyxCredentialId:'credential',presenceUpdatedAt:{toMillis:()=>Date.now()}};
 assert.equal(eligible(a,'gcr'),true);assert.equal(eligible({...a,brandIds:[]},'gcr'),false);assert.equal(eligible({...a,presenceUpdatedAt:{toMillis:()=>0}},'gcr'),false);
});
