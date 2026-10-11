'use strict';
const {HttpsError}=require('firebase-functions/v2/https');
async function enforceWebsiteQualification({db,tenantId,lead,patch,reader=db}) {
 if(lead.intakeStage!=='gms_qualification' && lead.attribution?.sourceSite!=='homes-around-north-houston')return;
 const next={...lead,...patch};
 const qualifying=patch.qualificationStatus==='qualified' || patch.qualification_status==='qualified' || ['qualified','handed_off','warm_transfer'].includes(patch.status || patch.lead_status) || Boolean(patch.qualifiedAt) || patch.disposition==='warm_transfer_completed' || patch.handoff_status==='ready';
 if(!qualifying)return;
 const form=(await reader.get(db.doc(`tenants/${tenantId}/qualificationForms/${lead.qualificationFormId}`))).data();
 if(!form || form.brandId!==lead.brandId || !['approved','active'].includes(form.status) || form.approvalStatus==='pending_broker_approval' || form.scoringStatus==='pending_broker_approval')throw new HttpsError('failed-precondition','Broker approval of this website qualification form is required.');
 const fields=form.questions || form.fields;const threshold=Number(form.qualificationThreshold ?? form.qualification_threshold);
 const answers=next.qualification_data || next.qualificationData || {};
 const weight=q=>Number(q.score_weight ?? q.weight ?? 0);
 if(!Array.isArray(fields) || !fields.length || !Number.isFinite(threshold) || threshold<=0 || !fields.some(q=>weight(q)>0))throw new HttpsError('failed-precondition','Broker-approved scoring criteria are required; form completion alone is not qualification.');
 if(fields.some(q=>q.required && !String(answers[q.id] ?? '').trim()) || fields.reduce((score,q)=>score+(answers[q.id]==='yes'?weight(q):0),0)<threshold)throw new HttpsError('failed-precondition','Required qualification answers and approved passing score must be recorded.');
 if((next.verification_status || next.verificationStatus)!=='verified' || !next.conversationCompletedAt)throw new HttpsError('failed-precondition','Identity verification and the phone conversation must be documented before qualification.');
 if(['handed_off','warm_transfer'].includes(patch.status || patch.lead_status) || patch.disposition==='warm_transfer_completed'){
  const calls=await reader.get(db.collection(`tenants/${tenantId}/callRecords`).where('leadId','==',lead.id).limit(100));
  if(!calls.docs.some(d=>d.data().provider==='telnyx' && d.data().transferStatus==='completed' && d.data().consultationStatus==='answered' && d.data().consultationJoined===true && d.data().handoffAt && d.data().handoffRecipientId))throw new HttpsError('failed-precondition','A completed provider handoff is required; a manually entered disposition cannot certify a live transfer.');
 }
}
async function enforceWebsiteHandoff({db,tenantId,lead}) {
 if(lead.intakeStage!=='gms_qualification' && lead.attribution?.sourceSite!=='homes-around-north-houston')return;
 if((lead.qualificationStatus || lead.qualification_status)!=='qualified')throw new HttpsError('failed-precondition','Save verified, broker-approved qualification before starting the Realtor handoff.');
 await enforceWebsiteQualification({db,tenantId,lead,patch:{status:'qualified'}});
}
module.exports={enforceWebsiteQualification,enforceWebsiteHandoff};
