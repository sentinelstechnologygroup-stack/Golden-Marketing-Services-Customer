'use strict';
function authorizeActor(approval, uid) {
  if(approval?.testCallingApproved!==true || !approval.testCallingActorUids?.includes(uid) || approval.testRecordingPolicy!=='do_not_record') throw new Error('Restricted calling test is not authorized.');
}
function authorizeLead(approval, leadId, lead, number) {
  if(lead?.isTest!==true || !approval.testCallingLeadIds?.includes(leadId) || approval.testCallingDestinations?.[leadId]!==lead.phone || number?.phoneNumber!==approval.testCallerId) throw new Error('Call is outside the approved test scope.');
}
module.exports={authorizeActor,authorizeLead};
