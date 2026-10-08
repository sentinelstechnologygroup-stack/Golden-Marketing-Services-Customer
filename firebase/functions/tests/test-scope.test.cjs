const test=require('node:test'),assert=require('node:assert/strict');
const {authorizeActor,authorizeLead}=require('../telephony/test-scope.cjs');
const approval={testCallingApproved:true,testCallingActorUids:['operator'],testRecordingPolicy:'do_not_record',testCallingLeadIds:['test-lead'],testCallingDestinations:{'test-lead':'+15555550100'},testCallerId:'+15555550101'};
test('unrecorded test exemption never removes the production recording requirement',()=>{
 const {configurationIssues}=require('../telephony/readiness.cjs');
 const env={TELEPHONY_PROVIDER:'telnyx',DEFAULT_RECORDING_POLICY:'record_on_consent',GMS_RECORDING_PIPELINE_READY:'false',TELEPHONY_TEST_ONLY:'true',TELEPHONY_TEST_RECORDING_POLICY:'do_not_record'};
 assert.equal(configurationIssues(env).includes('GMS_RECORDING_PIPELINE_READY'),false);
 assert.equal(configurationIssues({...env,TELEPHONY_TEST_ONLY:'false'}).includes('GMS_RECORDING_PIPELINE_READY'),true);
 assert.equal(configurationIssues({...env,TELEPHONY_TEST_RECORDING_POLICY:'record_all'}).includes('TELEPHONY_TEST_RECORDING_POLICY'),true);
});
test('test calls require approved operator, exact lead, destination and caller ID',()=>{
 authorizeActor(approval,'operator'); authorizeLead(approval,'test-lead',{isTest:true,phone:'+15555550100'},{phoneNumber:'+15555550101'});
 assert.throws(()=>authorizeActor(approval,'other'));
 assert.throws(()=>authorizeActor({...approval,testCallingApproved:false},'operator'));
 for(const [id,lead,number]of [['real-lead',{isTest:true,phone:'+15555550100'},{phoneNumber:'+15555550101'}],['test-lead',{isTest:false,phone:'+15555550100'},{phoneNumber:'+15555550101'}],['test-lead',{isTest:true,phone:'+15555550199'},{phoneNumber:'+15555550101'}],['test-lead',{isTest:true,phone:'+15555550100'},{phoneNumber:'+15555550199'}]])assert.throws(()=>authorizeLead(approval,id,lead,number));
});
