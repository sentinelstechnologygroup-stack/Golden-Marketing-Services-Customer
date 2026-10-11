const crypto=require('node:crypto');
const {FieldValue}=require('firebase-admin/firestore');
const {trustedEvidence}=require('./evidence-access.cjs');
const {recordingIdentity}=require('./recording-archive.cjs');
async function removeVerifiedCopy({evidence,binding,primary,backup,token,transport=fetch}){
 recordingIdentity(evidence.recordingId);
 if(!trustedEvidence(evidence,binding,evidence.tenantId,binding.callPath.split('/')[3],evidence.recordingId) || !evidence.sha256 || !evidence.storageBucket || evidence.storageBucket===evidence.backupBucket)throw new Error('Verified independent archives required.');
 for(const file of [primary,backup]){const [bytes]=await file.download();if(bytes.length!==evidence.bytes || crypto.createHash('sha256').update(bytes).digest('hex')!==evidence.sha256)throw new Error('Archive readback failed; provider copy retained.');}
 const url=`https://api.telnyx.com/v2/recordings/${evidence.recordingId}`,options={headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)};
 const lookup=await transport(url,options);if(lookup.status!==404){if(!lookup.ok)throw new Error('Provider ownership lookup failed.');const data=(await lookup.json()).data;if(data.id!==evidence.recordingId || data.call_control_id!==binding.providerCallId || data.call_control_id!==evidence.providerCallId)throw new Error('Provider ownership mismatch.');const removed=await transport(url,{...options,method:'DELETE'});if(!removed.ok && removed.status!==404)throw new Error('Provider cleanup failed.');}
 const check=await transport(url,options);if(check.status!==404)throw new Error('Provider deletion not yet confirmed.');
 return true;
}
async function cleanupArchivedRecording({db,storage,jobRef,job,token,primaryBucket,backupBucket}){
 const policy=(await db.doc(`gmsRecordingRetentionPolicies/${job.tenantId}`).get()).data();if(policy?.removeProviderAfterVerifiedArchive!==true)return;
 const callRef=db.doc(job.callPath),evidenceRef=callRef.collection('recordingEvidence').doc(job.recordingId);
 const [saved,bound,call,tenant,connection]=await Promise.all([evidenceRef.get(),db.doc(`gmsCallBindings/${callRef.id}`).get(),callRef.get(),db.doc(`tenants/${job.tenantId}`).get(),db.doc(`gmsProviderConnections/${job.tenantId}`).get()]);const evidence=saved.data(),binding=bound.data();
 if(evidence?.providerDeletionStatus==='deleted')return;
 if(!evidence || call.data()?.provider!=='telnyx' || binding?.callPath!==job.callPath || tenant.data()?.environment!=='production' || tenant.data()?.demo || evidence.storageBucket!==primaryBucket || evidence.backupBucket!==backupBucket)throw new Error('Archive ownership could not be confirmed.');
 const brand=(await db.doc(`tenants/${job.tenantId}/brands/${binding.brandId}`).get()).data();if([policy,evidence,call.data(),tenant.data(),brand,connection.data()?.recording].some(v=>v?.legalHold===true || (v?.providerRetentionUntilMs || 0)>Date.now()))return;
 await removeVerifiedCopy({evidence,binding,primary:storage.bucket(primaryBucket).file(evidence.storagePath),backup:storage.bucket(backupBucket).file(evidence.storagePath),token});
 const batch=db.batch();batch.update(evidenceRef,{providerDeletionStatus:'deleted',providerDeletedAt:FieldValue.serverTimestamp()});batch.update(jobRef,{providerDeletionStatus:'deleted',providerDeletedAt:FieldValue.serverTimestamp()});batch.set(db.doc(`tenants/${job.tenantId}/auditLogs/recording-deleted-${job.recordingId}`),{tenantId:job.tenantId,callId:callRef.id,recordingId:job.recordingId,action:'call.provider_recording_deleted_after_verified_archives',actorUid:'gms-recording-worker',createdAt:FieldValue.serverTimestamp()});await batch.commit();
}
module.exports={removeVerifiedCopy,cleanupArchivedRecording};
