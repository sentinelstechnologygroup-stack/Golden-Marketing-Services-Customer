const VERSION='north-houston-weekly-listings-v1';
const LABEL='Send me a weekly email with newly listed homes that match my search preferences. I can unsubscribe at any time.';
function listingEmailPreference(input={},capturedAt=null,source='website') {
 const presented=input.weeklyListingPreferencePresented===true;
 const requested=presented && input.weeklyListingEmailsRequested===true;
 return {revision:0,status:presented?(requested?'requested':'declined'):'not_asked',requested,presented,version:VERSION,text:LABEL,cadence:'weekly',source,capturedAt:presented?capturedAt:null,setupStatus:requested?'pending_manual_setup':'not_requested',unsubscribeVerified:false};
}
function recordPreferenceAndTask({tx,root,leadId,lead,input,stamp,source='website'}) {
 const previous=lead.communicationPreferences?.weeklyListingEmails;
 const suppressed=lead.doNotContact || lead.optOut || lead.emailOptOut || ['unsubscribed','suppressed'].includes(previous?.status);
 const preference=listingEmailPreference(suppressed?{...input,weeklyListingEmailsRequested:false}:input,stamp,source);
 if (suppressed) preference.status=previous?.status || 'suppressed';
 preference.revision=(previous?.revision || 0)+1;
 if(!preference.presented)return;
 tx.set(root.collection('leads').doc(leadId),{communicationPreferences:{weeklyListingEmails:preference}},{merge:true});
 tx.set(root.collection('followUpTasks').doc(`weekly-listings-${leadId}`),{
  tenantId:lead.tenantId,brandId:lead.brandId,leadId,assignedTo:lead.assignedTo || null,
  task_type:'weekly_listing_setup',title:'Realtor: configure weekly matching-property emails',
  status:preference.requested?'pending':'cancelled',requestedAt:stamp,dueAt:stamp,updatedAt:stamp,
  isTest:lead.isTest===true,communicationsSuppressed:true,
  notes:preference.requested?'Coordinate manual Realtor setup using the saved search criteria. Confirm the current email preference and provider suppression list. Verify the unsubscribe option works before activating delivery. No alert or email has been sent.':'Weekly listing emails declined. Do not activate alerts; if a provider alert already exists, remove this recipient and confirm suppression.',
 },{merge:true});
}
module.exports={listingEmailPreference,recordPreferenceAndTask,VERSION,LABEL};
