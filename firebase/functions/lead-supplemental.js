const {getApps,initializeApp}=require('firebase-admin/app');if(!getApps().length)initializeApp();
const {getAuth}=require('firebase-admin/auth');const {getFirestore,FieldValue}=require('firebase-admin/firestore');const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {financingProfile}=require('./lead-enrichment-policy.cjs');const {saveAgentListingPreference}=require('./agent-listing-preferences.cjs');
const db=getFirestore();
exports.saveLeadSupplementalPreferences=onCall({enforceAppCheck:false,maxInstances:2},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in first.');
 const {tenantId,leadId,financing,weeklyEmail}=request.data || {};
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(tenantId || '') || !/^[a-zA-Z0-9_-]{1,128}$/.test(leadId || '') || (!financing && !weeklyEmail))throw new HttpsError('invalid-argument','A lead and supplemental information are required.');
 const user=await getAuth().getUser(request.auth.uid);if(user.disabled || user.customClaims?.mustChangePassword)throw new HttpsError('permission-denied','Account access unavailable.');
 const admin=user.customClaims?.gmsSuperAdmin===true || user.customClaims?.platformAdmin===true;
 const assignment=admin?null:(await db.doc(`agentUsers/${user.uid}/assignments/${tenantId}`).get()).data();
 if(!admin && (assignment?.status!=='active' || !['agent','supervisor','admin'].includes(assignment.role)))throw new HttpsError('permission-denied','Active GMS phone staff assignment required.');
 const ref=db.doc(`tenants/${tenantId}/leads/${leadId}`);const lead=(await ref.get()).data();
 if(!lead || lead.tenantId!==tenantId)throw new HttpsError('not-found','Lead not found.');
 if(lead.intakeStage!=='gms_qualification' && lead.attribution?.sourceSite!=='homes-around-north-houston')throw new HttpsError('failed-precondition','This action is for the North Houston intake workflow.');
 const brands=[assignment?.brandId,...(assignment?.brandIds || [])].filter(Boolean);
 if(!admin && ((brands.length && !brands.includes(lead.brandId)) || (assignment.campaignIds?.length && !assignment.campaignIds.includes(lead.campaignId)) || (assignment.role==='agent' && lead.assignedTo!==user.uid && lead.queueOwnerUid!==user.uid)))throw new HttpsError('permission-denied','This lead is outside your assignment.');
 if(financing){
  const stamp=FieldValue.serverTimestamp();
  await db.runTransaction(async tx=>{
   const fresh=(await tx.get(ref)).data();if(!fresh || fresh.brandId!==lead.brandId || (assignment?.role==='agent' && fresh.assignedTo!==user.uid && fresh.queueOwnerUid!==user.uid))throw new HttpsError('aborted','Lead assignment changed. Reload.');
   tx.update(ref,{financingProfile:{...financingProfile(financing),recordedAt:stamp,recordedBy:user.uid},updatedAt:stamp,updatedBy:user.uid});
   tx.create(ref.parent.parent.collection('auditLogs').doc(),{tenantId,actorUid:user.uid,action:'lead.optional_financing_saved',target:leadId,occurredAt:stamp,createdAt:stamp});
  });
 }
 if(weeklyEmail)await saveAgentListingPreference({db,recordRef:ref,patch:{communicationPreferences:{weeklyListingEmails:weeklyEmail}},callerUid:user.uid,authorizeLead:fresh=>{if(fresh.brandId!==lead.brandId || (assignment?.role==='agent' && fresh.assignedTo!==user.uid && fresh.queueOwnerUid!==user.uid))throw new HttpsError('aborted','Lead assignment changed. Reload.');}});
 return {saved:true};
});
