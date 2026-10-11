const test=require('node:test'),assert=require('node:assert/strict');
const {summarize}=require('../call-center-policy.cjs');
const base=Date.parse('2026-10-11T15:00:00Z');
const c=(id,patch)=>({id,agentUid:'a',brandId:'gcr',direction:'inbound',createdAt:base,...patch});
test('queue wait ends on acceptance or queue exit, not after voicemail recording',()=>{
 const result=summarize([c('accepted',{queuedAt:base,acceptedAt:base+10000,connectedAt:base+15000,handoffAt:base+60000,endedAt:base+180000,holdSeconds:5,transferStatus:'completed'}),c('vm',{queuedAt:base,queueExitedAt:base+30000,endedAt:base+120000,callKind:'voicemail'}),c('old',{endedAt:base+120000})],[],base,base+300000);
 assert.equal(result.summary.avgQueueSeconds,20);assert.equal(result.summary.queueSamples,2);assert.equal(result.summary.avgConnectionSeconds,5);assert.equal(result.summary.avgHandlingSeconds,45);assert.equal(result.summary.handoffs,1);assert.equal(result.summary.voicemails,1);assert.equal(result.summary.holdSamples,1);assert.equal(result.calls[2].holdSeconds,null);
});
test('peak concurrency excludes post-handoff talk and clips report boundaries',()=>{
 const result=summarize([c('one',{connectedAt:base-10000,handoffAt:base+10000,endedAt:base+90000}),c('two',{connectedAt:base+5000,endedAt:base+20000}),c('three',{connectedAt:base+25000,endedAt:base+30000})],[],base,base+60000);
 assert.equal(result.summary.peakConcurrentCalls,2);
});
test('status durations are clipped to the reporting window, including lunch',()=>{
 const result=summarize([], [{agentUid:'a',previousStatus:'lunch',previousDurationSeconds:1800,occurredAt:base+600000},{agentUid:'a',previousStatus:'break',previousDurationSeconds:null,occurredAt:base+300000}],base,base+900000);
 assert.deepEqual(result.statuses,[{agentUid:'a',status:'lunch',seconds:600}]);assert.equal(result.summary.avgQueueSeconds,null);
});
test('selected campaigns exclude other campaign leads but permit direct inquiries',()=>{
 const {campaignAllowed}=require('../staff-policy.cjs');const a={campaignAccess:'selected',campaignIds:['one']};assert.equal(campaignAllowed(a,{campaignId:'one'}),true);assert.equal(campaignAllowed(a,{campaignId:'two'}),false);assert.equal(campaignAllowed(a,{}),true);
});
