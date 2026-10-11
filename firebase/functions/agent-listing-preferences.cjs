const {FieldValue}=require('firebase-admin/firestore');const {HttpsError}=require('firebase-functions/v2/https');
const {listingEmailPreference,recordPreferenceAndTask}=require('./listing-email-policy.cjs');
async function saveAgentListingPreference({db,recordRef,patch,callerUid}) {
 const selection=patch.communicationPreferences?.weeklyListingEmails;
 if(!selection || selection.presented!==true || typeof selection.requested!=='boolean' || !Number.isInteger(selection.expectedRevision) || selection.expectedRevision<0)throw new HttpsError('invalid-argument','Record the prospect’s actual weekly email choice.');
 await db.runTransaction(async tx=>{
  const fresh=(await tx.get(recordRef)).data();if(!fresh)throw new HttpsError('not-found','Lead not found.');
  const previous=fresh.communicationPreferences?.weeklyListingEmails;
  if((previous?.revision || 0)!==selection.expectedRevision)throw new HttpsError('aborted','The email preference changed. Reload before saving.');
  if(selection.requested && (fresh.doNotContact || fresh.optOut || fresh.emailOptOut || ['unsubscribed','suppressed'].includes(previous?.status)))throw new HttpsError('failed-precondition','An existing unsubscribe must be resolved through the approved resubscription process.');
  const stamp=FieldValue.serverTimestamp();const input={weeklyListingPreferencePresented:true,weeklyListingEmailsRequested:selection.requested};
  const preference={...listingEmailPreference(input,stamp,'phone_agent'),revision:(previous?.revision || 0)+1,recordedBy:callerUid};
  const merged={...fresh.communicationPreferences,weeklyListingEmails:preference};
  tx.update(recordRef,{...patch,communicationPreferences:merged,updatedAt:stamp,updatedBy:callerUid});
  recordPreferenceAndTask({tx,root:recordRef.parent.parent,leadId:recordRef.id,lead:fresh,input,stamp,source:'phone_agent'});
  tx.set(recordRef,{communicationPreferences:{weeklyListingEmails:{recordedBy:callerUid}}},{merge:true});
  patch.communicationPreferences=merged;
 });
}
module.exports={saveAgentListingPreference};
