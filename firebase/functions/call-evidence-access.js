const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {identifier,allowsEvidence,trustedEvidence}=require('./telephony/evidence-access.cjs');
const db=getFirestore();
async function authorized(request) {
  if(!request.auth?.uid) throw new HttpsError('unauthenticated','Sign in to view call evidence.');
  let tenantId,callId;
  try {tenantId=identifier(request.data?.tenantId);callId=identifier(request.data?.callId);} catch {throw new HttpsError('invalid-argument','Select a valid call.');}
  const [user,member,assignment,binding,call]=await Promise.all([
    getAuth().getUser(request.auth.uid),db.doc(`tenants/${tenantId}/members/${request.auth.uid}`).get(),
    db.doc(`agentUsers/${request.auth.uid}/assignments/${tenantId}`).get(),db.doc(`gmsCallBindings/${callId}`).get(),db.doc(`tenants/${tenantId}/callRecords/${callId}`).get(),
  ]);
  if(!binding.exists || binding.data().tenantId!==tenantId || !call.exists || call.data().tenantId!==tenantId
    || !allowsEvidence(user,member.data(),assignment.data(),binding.data())) throw new HttpsError('permission-denied','This call evidence is unavailable to your account.');
  return {tenantId,callId,binding:binding.data(),call:call.data(),ref:call.ref,user};
}
exports.getGmsCallEvidence=onCall({enforceAppCheck:true,maxInstances:2},async request=>{
  const context=await authorized(request);
  const records=await context.ref.collection('recordingEvidence').limit(40).get();
  const recordings=records.docs.filter(doc=>trustedEvidence(doc.data(),context.binding,context.tenantId,context.callId,doc.id)).map(doc=>{
    const value=doc.data();
    return {id:doc.id,archiveVerified:true,bytes:value.bytes,transcriptStatus:value.transcriptStatus,scorecardStatus:value.scorecardStatus,
      transcript:value.transcriptText || null,scorecard:value.scorecard || null,providerDeletionStatus:value.providerDeletionStatus || 'retained'};
  });
  return {callId:context.callId,leadId:context.binding.leadId,agentUid:context.binding.agentUid,brandId:context.binding.brandId,campaignId:context.binding.campaignId,recordings};
});
exports.getGmsCallRecordingDownload=onCall({enforceAppCheck:true,maxInstances:2},async request=>{
  const context=await authorized(request);let recordingId;
  try {recordingId=identifier(request.data?.recordingId);} catch {throw new HttpsError('invalid-argument','Select a valid recording.');}
  const snapshot=await context.ref.collection('recordingEvidence').doc(recordingId).get(),evidence=snapshot.data();
  if(!trustedEvidence(evidence,context.binding,context.tenantId,context.callId,recordingId)
    || !process.env.GMS_RECORDING_BUCKET || evidence.storageBucket!==process.env.GMS_RECORDING_BUCKET) throw new HttpsError('failed-precondition','The verified recording is not ready.');
  const file=getStorage().bucket(evidence.storageBucket).file(evidence.storagePath),[metadata]=await file.getMetadata();
  if(metadata.metadata?.sha256!==evidence.sha256 || Number(metadata.size)!==evidence.bytes || metadata.contentType!=='audio/wav') throw new HttpsError('failed-precondition','The recording verification did not pass.');
  const expiresAtMs=Date.now()+5*60*1000;
  const [url]=await file.getSignedUrl({version:'v4',action:'read',expires:expiresAtMs,
    responseDisposition:`attachment; filename="GMS-call-${context.callId}.wav"`,responseType:'audio/wav'});
  await db.collection(`tenants/${context.tenantId}/auditLogs`).add({tenantId:context.tenantId,action:'call.recording_download_authorized',actorUid:context.user.uid,callId:context.callId,recordingId,createdAt:FieldValue.serverTimestamp()});
  return {url,expiresAtMs};
});
