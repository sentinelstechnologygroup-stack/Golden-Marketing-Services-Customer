const test=require('node:test'),assert=require('node:assert/strict');
const {allowsEvidence,trustedEvidence}=require('../telephony/evidence-access.cjs');
test('call evidence applies fresh account status, tenant membership, brand scope and agent ownership',()=>{
 const user={uid:'agent'},call={brandId:'gcr',agentUid:'agent'};
 assert.equal(allowsEvidence(user,{active:true,role:'client_admin'},null,call),true);
 assert.equal(allowsEvidence(user,{active:true,role:'client',brandIds:['foreign']},null,call),false);
 assert.equal(allowsEvidence({...user,disabled:true},{active:true,role:'client_admin'},null,call),false);
 assert.equal(allowsEvidence(user,null,{status:'active',role:'agent',brandId:'gcr'},call),true);
 assert.equal(allowsEvidence(user,null,{status:'active',role:'agent',brandId:'gcr'},{...call,agentUid:'other'}),false);
 assert.equal(allowsEvidence(user,null,{status:'active',role:'agent'},call),false);
});
test('recording downloads require trusted immutable attribution and two verified archives',()=>{
 const binding={tenantId:'tenant',callPath:'tenants/tenant/callRecords/call',brandId:'gcr',leadId:'lead',agentUid:'agent'};
 const evidence={tenantId:'tenant',recordingId:'recording',brandId:'gcr',leadId:'lead',agentUid:'agent',archiveVerified:true,backupVerified:true,storagePath:'private-call-evidence/tenant/call/recording.wav'};
 assert.equal(trustedEvidence(evidence,binding,'tenant','call','recording'),true);
 assert.equal(trustedEvidence({...evidence,storagePath:'private-call-evidence/foreign/call/recording.wav'},binding,'tenant','call','recording'),false);
 assert.equal(trustedEvidence({...evidence,backupVerified:false},binding,'tenant','call','recording'),false);
 assert.equal(trustedEvidence({...evidence,agentUid:'foreign'},binding,'tenant','call','recording'),false);
});
