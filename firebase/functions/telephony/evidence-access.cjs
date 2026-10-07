'use strict';
function identifier(value) {
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('Invalid evidence identifier.');
  return value;
}
function allowsEvidence(user,membership,assignment,call) {
  if(!user || user.disabled || user.customClaims?.mustChangePassword) return false;
  if(user.customClaims?.gmsSuperAdmin===true) return true;
  if(membership?.active===true && ['client','customer','client_admin','admin','client_supervisor','supervisor','auditor'].includes(membership.role)) {
    return !membership.brandIds?.length || membership.brandIds.includes(call.brandId);
  }
  if(assignment?.status!=='active'||assignment.role!=='agent'||call.agentUid!==user.uid) return false;
  const brands=[assignment.brandId,...(assignment.brandIds || [])].filter(Boolean);
  return brands.length>0 && brands.includes(call.brandId);
}
function trustedEvidence(evidence,binding,tenantId,callId,recordingId) {
  identifier(tenantId);identifier(callId);identifier(recordingId);
  return Boolean(binding?.tenantId===tenantId && binding.callPath===`tenants/${tenantId}/callRecords/${callId}`
    && evidence?.tenantId===tenantId && evidence.recordingId===recordingId
    && evidence.brandId===binding.brandId && evidence.leadId===binding.leadId && evidence.agentUid===binding.agentUid
    && evidence.archiveVerified===true && evidence.backupVerified===true
    && evidence.storagePath===`private-call-evidence/${tenantId}/${callId}/${recordingId}.wav`);
}
module.exports={identifier,allowsEvidence,trustedEvidence};
