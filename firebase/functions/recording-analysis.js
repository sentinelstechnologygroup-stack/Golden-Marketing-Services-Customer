const crypto=require('node:crypto');
const {getApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {defineSecret}=require('firebase-functions/params');
const {identifier,trustedEvidence}=require('./telephony/evidence-access.cjs');
const {recordingIdentity}=require('./telephony/recording-archive.cjs');
const {startTranscription,pollTranscription,scoreTranscript}=require('./telephony/recording-analysis.cjs');
const db=getFirestore(),key=defineSecret('TELNYX_API_KEY');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function context(job) {
  identifier(job.tenantId);identifier(job.callId);recordingIdentity(job.recordingId);
  const callRef=db.doc(`tenants/${job.tenantId}/callRecords/${job.callId}`),evidenceRef=callRef.collection('recordingEvidence').doc(job.recordingId);
  const [binding,call,evidence,tenant,connection]=await Promise.all([db.doc(`gmsCallBindings/${job.callId}`).get(),callRef.get(),evidenceRef.get(),db.doc(`tenants/${job.tenantId}`).get(),db.doc(`gmsProviderConnections/${job.tenantId}`).get()]);
  const value=evidence.data();
  if(tenant.data()?.environment!=='production'||tenant.data()?.demo||!call.exists || call.data().provider!=='telnyx'
    || !trustedEvidence(value,binding.data(),job.tenantId,job.callId,job.recordingId)
    || value.storageBucket!==process.env.GMS_RECORDING_BUCKET || value.backupBucket!==process.env.GMS_RECORDING_BACKUP_BUCKET
    || !value.storageBucket || !value.backupBucket || value.storageBucket===value.backupBucket) throw new Error('Verified owned call evidence is required.');
  return {callRef,evidenceRef,evidence:value,binding:binding.data(),call:call.data(),tenant:tenant.data(),connection:connection.data()};
}
async function token() {return (await getApp().options.credential.getAccessToken()).access_token;}
async function verifiedAudio(ctx) {
  let audio;
  for(const bucket of [ctx.evidence.storageBucket,ctx.evidence.backupBucket]) {
    const [data]=await getStorage().bucket(bucket).file(ctx.evidence.storagePath).download();
    if(data.length!==ctx.evidence.bytes || sha(data)!==ctx.evidence.sha256) throw new Error('Recording archive verification failed.');
    audio=data;
  }
  return audio;
}
async function saveArtifact(ctx,suffix,value) {
  const path=ctx.evidence.storagePath.replace(/\.wav$/,suffix),bytes=Buffer.from(JSON.stringify(value));
  const digest=sha(bytes);
  for(const bucket of [ctx.evidence.storageBucket,ctx.evidence.backupBucket]) {
    const file=getStorage().bucket(bucket).file(path);
    await file.save(bytes,{resumable:false,validation:'crc32c',metadata:{contentType:'application/json',metadata:{sha256:digest}}});
    const [copy]=await file.download();if(sha(copy)!==digest) throw new Error('Evidence artifact verification failed.');
  }
  return {path,sha256:digest};
}
async function claim(ref,from,to) {
  return db.runTransaction(async tx=>{
    const latest=await tx.get(ref);
    if(latest.data()?.status!==from)return false;
    tx.update(ref,{status:to,updatedAt:FieldValue.serverTimestamp()});return true;
  });
}
async function processJob(ref) {
  const job=(await ref.get()).data();if(!job)return;
  if(process.env.GMS_CALL_ANALYSIS_ENABLED!=='true')return;
  const ctx=await context(job);
  if(job.status==='pending') {
    if(!process.env.GMS_SCORECARD_MODEL || !Array.isArray(ctx.binding.qualificationRubric) || !ctx.binding.qualificationRubric.length) return;
    const audio=await verifiedAudio(ctx);
    if(!await claim(ref,'pending','submitting_transcription'))return;
    try {
      const operation=await startTranscription({audio,bucket:ctx.evidence.storageBucket,path:ctx.evidence.storagePath,token:await token()});
      const batch=db.batch();batch.update(ref,{status:'transcribing',operation,submittedAt:FieldValue.serverTimestamp()});batch.update(ctx.evidenceRef,{transcriptStatus:'processing'});await batch.commit();
    } catch {await ref.update({status:'needs_reconciliation',reason:'transcription_submission_not_confirmed'});}
    return;
  }
  if(job.status==='transcribing') {
    // Polls are read-only and safe to repeat. A failed operation cannot cause a
    // second paid submission without an explicit reconciliation decision.
    const transcript=await pollTranscription({operation:job.operation,token:await token()});if(!transcript)return;
    if(!await claim(ref,'transcribing','saving_transcript'))return;
    try {
      const artifact=await saveArtifact(ctx,'.transcript.json',{...transcript,recordingSha256:ctx.evidence.sha256,provider:'google-speech-v1',operation:job.operation});
      const batch=db.batch();batch.update(ctx.evidenceRef,{transcriptText:transcript.text,transcriptStatus:'complete',transcriptStoragePath:artifact.path,transcriptArtifactSha256:artifact.sha256,transcriptVerified:true,transcriptBackupVerified:true});batch.update(ref,{status:'scoring_ready'});await batch.commit();
    } catch {await ref.update({status:'needs_reconciliation',reason:'transcript_archive_not_confirmed'});}
    return;
  }
  if(job.status==='scoring_ready') {
    if(ctx.evidence.transcriptStatus!=='complete' || !ctx.evidence.transcriptVerified || !ctx.evidence.transcriptBackupVerified) throw new Error('Verified transcript is required.');
    if(!await claim(ref,'scoring_ready','scoring'))return;
    try {
      const result=await scoreTranscript({criteria:ctx.binding.qualificationRubric,transcript:{text:ctx.evidence.transcriptText},model:process.env.GMS_SCORECARD_MODEL,token:await token()});
      const artifact=await saveArtifact(ctx,'.scorecard.json',{...result,qualificationFormId:ctx.binding.qualificationFormId,qualificationRubricVersion:ctx.binding.qualificationRubricVersion});
      const batch=db.batch();batch.update(ctx.evidenceRef,{scorecard:result,scorecardStatus:'needs_human_review',scorecardStoragePath:artifact.path,scorecardArtifactSha256:artifact.sha256,scorecardVerified:true,scorecardBackupVerified:true,processedAt:FieldValue.serverTimestamp()});batch.update(ref,{status:'deletion_pending'});await batch.commit();
    } catch {await ref.update({status:'needs_reconciliation',reason:'scoring_or_archive_not_confirmed'});}
    return;
  }
  if(job.status==='deletion_pending') {
    if(process.env.GMS_PROVIDER_RECORDING_DELETE_ENABLED!=='true' || ctx.connection?.recording?.providerDeletionApproved!==true) return;
    const brand=(await db.doc(`tenants/${job.tenantId}/brands/${ctx.binding.brandId}`).get()).data();
    if([ctx.evidence,ctx.call,ctx.tenant,brand,ctx.connection?.recording].some(v=>v?.legalHold===true || (v?.providerRetentionUntilMs || 0)>Date.now())) return;
    if(ctx.evidence.transcriptStatus!=='complete' || !ctx.evidence.transcriptVerified || !ctx.evidence.transcriptBackupVerified
      || !ctx.evidence.scorecardVerified || !ctx.evidence.scorecardBackupVerified) return;
    await verifiedAudio(ctx);
    // Re-read both transcript and scorecard copies before destructive provider
    // cleanup. GMS evidence is never deleted by this worker.
    for(const [path,digest] of [[ctx.evidence.transcriptStoragePath,ctx.evidence.transcriptArtifactSha256],[ctx.evidence.scorecardStoragePath,ctx.evidence.scorecardArtifactSha256]]) {
      if(!path?.startsWith(ctx.evidence.storagePath.slice(0,-4)+'.') || !/^[a-f0-9]{64}$/.test(digest || ''))throw new Error('Evidence artifact binding is invalid.');
      for(const bucket of [ctx.evidence.storageBucket,ctx.evidence.backupBucket]) {
        const [bytes]=await getStorage().bucket(bucket).file(path).download();if(sha(bytes)!==digest)throw new Error('Processed evidence verification failed.');
      }
    }
    const url=`https://api.telnyx.com/v2/recordings/${job.recordingId}`,headers={Authorization:`Bearer ${key.value()}`};
    const lookup=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
    if(lookup.status!==404) {
      if(!lookup.ok)throw new Error('Provider recording ownership lookup failed.');
      const data=(await lookup.json()).data;
      if(data?.id!==job.recordingId || data.call_control_id!==ctx.evidence.providerCallId || data.call_control_id!==ctx.binding.providerCallId)throw new Error('Provider recording ownership mismatch.');
      const removed=await fetch(url,{method:'DELETE',headers,redirect:'error',signal:AbortSignal.timeout(20000)});
      if(!removed.ok && removed.status!==404)throw new Error('Provider recording deletion is pending.');
    }
    const batch=db.batch();batch.update(ctx.evidenceRef,{providerDeletionStatus:'deleted',providerDeletedAt:FieldValue.serverTimestamp()});batch.update(ref,{status:'complete'});
    batch.set(db.doc(`tenants/${job.tenantId}/auditLogs/recording-deleted-${job.recordingId}`),{tenantId:job.tenantId,callId:job.callId,recordingId:job.recordingId,action:'call.provider_recording_deleted_after_verified_archives',actorUid:'gms-recording-worker',createdAt:FieldValue.serverTimestamp()});await batch.commit();
  }
}
exports.startGmsCallAnalysis=onDocumentCreated({document:'gmsRecordingAnalysisJobs/{recordingId}',secrets:[key],maxInstances:2,timeoutSeconds:540,memory:'512MiB',retry:true},async event=>processJob(event.data.ref));
exports.processGmsCallEvidence=onSchedule({schedule:'every 2 minutes',secrets:[key],maxInstances:1,timeoutSeconds:540,memory:'512MiB'},async()=>{
  if(process.env.GMS_CALL_ANALYSIS_ENABLED!=='true')return;
  const states=['pending','transcribing','scoring_ready',...(process.env.GMS_PROVIDER_RECORDING_DELETE_ENABLED==='true'?['deletion_pending']:[])];
  // Retained/held provider copies must not occupy the entire processing batch
  // and prevent new calls from receiving transcripts and scorecards.
  const batches=await Promise.all(states.map(status=>db.collection('gmsRecordingAnalysisJobs').where('status','==',status).limit(3).get()));
  for(const jobs of batches) for(const job of jobs.docs) {
    try {await processJob(job.ref);} catch {await job.ref.set({attentionRequired:true,lastAttemptAt:FieldValue.serverTimestamp()},{merge:true});}
  }
});
