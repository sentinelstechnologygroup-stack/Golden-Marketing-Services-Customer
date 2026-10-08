const test=require('node:test'),assert=require('node:assert/strict');
const {authorizeActor,authorizeLead}=require('../telephony/test-scope.cjs');
const approval={testCallingApproved:true,testCallingActorUids:['operator'],testRecordingPolicy:'do_not_record',testCallingLeadIds:['test-lead'],testCallingDestinations:{'test-lead':'+15555550100'},testCallerId:'+15555550101'};
test('test calls require approved operator, exact lead, destination and caller ID',()=>{
 authorizeActor(approval,'operator'); authorizeLead(approval,'test-lead',{isTest:true,phone:'+15555550100'},{phoneNumber:'+15555550101'});
 assert.throws(()=>authorizeActor(approval,'other'));
 assert.throws(()=>authorizeActor({...approval,testCallingApproved:false},'operator'));
 for(const [id,lead,number]of [['real-lead',{isTest:true,phone:'+15555550100'},{phoneNumber:'+15555550101'}],['test-lead',{isTest:false,phone:'+15555550100'},{phoneNumber:'+15555550101'}],['test-lead',{isTest:true,phone:'+15555550199'},{phoneNumber:'+15555550101'}],['test-lead',{isTest:true,phone:'+15555550100'},{phoneNumber:'+15555550199'}]])assert.throws(()=>authorizeLead(approval,id,lead,number));
});
