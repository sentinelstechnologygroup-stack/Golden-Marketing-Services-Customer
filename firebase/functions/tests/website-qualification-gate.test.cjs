const test=require('node:test');const assert=require('node:assert/strict');const {enforceWebsiteQualification:gate}=require('../website-qualification-gate.cjs');
const lead={id:'lead-one',brandId:'brand-one',qualificationFormId:'form-one',attribution:{sourceSite:'homes-around-north-houston'}};
function db(form,calls=[]){return {doc:()=>({kind:'form'}),collection:()=>({where(){return this},limit(){return {kind:'calls'}}}),async get(ref){return ref.kind==='form'?{data:()=>form}:{docs:calls.map(row=>({data:()=>row}))}}};}
const approved={brandId:'brand-one',status:'approved',qualificationThreshold:70,questions:[{id:'identity',required:true,score_weight:100}]};
test('site qualification rejects draft, unscored, unanswered and unverified evidence',async()=>{
 for(const form of [{...approved,status:'draft'},{...approved,qualificationThreshold:0},{...approved,questions:[]}])await assert.rejects(gate({db:db(form),tenantId:'tenant-one',lead,patch:{status:'qualified'}}),{code:'failed-precondition'});
 await assert.rejects(gate({db:db(approved),tenantId:'tenant-one',lead,patch:{status:'qualified',qualification_data:{identity:'yes'}}}),{code:'failed-precondition'});
 await gate({db:db(approved),tenantId:'tenant-one',lead,patch:{status:'qualified',qualification_data:{identity:'yes'},verification_status:'verified',conversationCompletedAt:'2026-10-10T12:00:00Z'}});
});
test('manual dispositions cannot fabricate a provider handoff; callbacks and other campaigns remain available',async()=>{
 const qualified={...lead,qualification_data:{identity:'yes'},verification_status:'verified',conversationCompletedAt:'2026-10-10T12:00:00Z'};
 await assert.rejects(gate({db:db(approved),tenantId:'tenant-one',lead:qualified,patch:{disposition:'warm_transfer_completed'}}),{code:'failed-precondition'});
 await gate({db:db(approved,[{provider:'telnyx',transferStatus:'completed',consultationStatus:'answered',consultationJoined:true,handoffAt:'server-timestamp',handoffRecipientId:'recipient-one'}]),tenantId:'tenant-one',lead:qualified,patch:{status:'handed_off'}});
 await gate({db:db(null),tenantId:'tenant-one',lead,patch:{status:'appointment_scheduled'}});
 await gate({db:db(null),tenantId:'tenant-one',lead:{...lead,attribution:{}},patch:{status:'qualified'}});
});
