const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {defineSecret} = require('firebase-functions/params');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getStorage} = require('firebase-admin/storage');
const {archiveRecording} = require('./telephony/recording-archive.cjs');
const key = defineSecret('TELNYX_API_KEY');

exports.archiveTelnyxRecording = onDocumentCreated({
  document:'gmsRecordingArchiveJobs/{recordingId}', secrets:[key],
  retry:true, timeoutSeconds:540, memory:'512MiB', maxInstances:2,
}, async event=>{
  const db=getFirestore(), jobSnapshot=await event.data.ref.get(), job=jobSnapshot.data();
  if(!job) throw new Error('Archive job is unavailable.');
  // Firestore can redeliver a creation event after a successful archive. Never
  // fetch a deleted provider copy or reset completed transcript/scorecard state.
  if(job.status==='archived') return;
  if(!/^tenants\/[A-Za-z0-9_-]+\/callRecords\/[A-Za-z0-9_-]+$/.test(job.callPath || '')) throw new Error('Invalid archive job.');
  const callRef=db.doc(job.callPath), savedCall=(await callRef.get()).data();
  const binding=(await db.doc(`gmsCallBindings/${callRef.id}`).get()).data();
  if(!binding || binding.callPath!==job.callPath || binding.tenantId!==job.tenantId) throw new Error('Trusted call binding is unavailable.');
  if(!binding.providerCallId) throw new Error('Trusted provider identity is unavailable.');
  const call={...savedCall,providerCallId:binding.providerCallId,tenantId:binding.tenantId,brandId:binding.brandId,campaignId:binding.campaignId,
    leadId:binding.leadId,agentUid:binding.agentUid,recordingPolicy:binding.recordingPolicy,recordingConsent:binding.recordingConsent,recordingRequested:binding.recordingRequested};
  if(!savedCall || savedCall.tenantId!==job.tenantId) throw new Error('Archive tenant mismatch.');
  const primaryBucket=process.env.GMS_RECORDING_BUCKET, backupBucket=process.env.GMS_RECORDING_BACKUP_BUCKET;
  if(!primaryBucket || !backupBucket || primaryBucket===backupBucket) throw new Error('Independent recording archives are not configured.');
  const path=`private-call-evidence/${job.tenantId}/${callRef.id}/${job.recordingId}.wav`;
  const result=await archiveRecording({call,recordingId:job.recordingId,token:key.value(),
    hosts:(process.env.TELNYX_RECORDING_MEDIA_HOSTS || '').split(',').filter(Boolean),
    primary:getStorage().bucket(primaryBucket).file(path), backup:getStorage().bucket(backupBucket).file(path),
  });
  await db.runTransaction(async tx=>{
    const analysisRef=db.doc(`gmsRecordingAnalysisJobs/${job.recordingId}`);
    const [latest,latestJob,analysisJob]=await Promise.all([tx.get(callRef),tx.get(event.data.ref),tx.get(analysisRef)]);
    if(latestJob.data()?.status==='archived') return;
    if(latest.data()?.providerCallId!==call.providerCallId || latest.data()?.tenantId!==job.tenantId) throw new Error('Call binding changed.');
    tx.set(callRef.collection('recordingEvidence').doc(job.recordingId),{
      ...result, storagePath:path, storageBucket:primaryBucket, backupBucket,
      tenantId:job.tenantId, brandId:call.brandId || null, campaignId:call.campaignId || null,
      leadId:call.leadId || null, agentUid:call.agentUid || call.agentId || null,
      transcriptStatus:'pending', scorecardStatus:'pending', providerDeletionStatus:'retained',
      archivedAt:FieldValue.serverTimestamp(),
    },{merge:true});
    tx.update(callRef,{recordingStatus:'archived',recordingStoragePath:path,updatedAt:FieldValue.serverTimestamp()});
    tx.update(event.data.ref,{status:'archived',verifiedAt:FieldValue.serverTimestamp()});
    if(!analysisJob.exists) tx.create(analysisRef,{tenantId:job.tenantId,callId:callRef.id,recordingId:job.recordingId,
      status:Array.isArray(binding.qualificationRubric) && binding.qualificationRubric.length?'pending':'qualification_rubric_required',
      createdAt:FieldValue.serverTimestamp()});
  });
  // Provider deletion is deliberately separate from archive success. It must also
  // respect retention/hold policy and transcription completion before activation.
});
