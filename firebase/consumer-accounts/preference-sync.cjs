const {FieldValue}=require('firebase-admin/firestore');
const {recipientId}=require('./messaging-policy.cjs');
const digits=x=>String(x||'').replace(/\D/g,'');
function blocked(contact={}){const settings=contact.dndSettings||{};const active=k=>contact.dnd===true||Object.entries(settings).some(([key,v])=>key.toLowerCase()===k&&v?.status==='active');return {sms:active('sms'),email:active('email'),call:active('call')||active('phone')};}
async function provider(db,tenantId){
 const connection=(await db.doc(`gmsProviderConnections/${tenantId}`).get()).data();
 if(!connection?.locationId||(await db.doc(`ghlLocationTenants/${connection.locationId}`).get()).data()?.tenantId!==tenantId)throw Error('preference_location_mismatch');
 const token=await require('./gohighlevel-oauth-store.cjs').locationToken(connection.locationId,JSON.parse(process.env.GMS_GOHIGHLEVEL_CONFIG||'{}'));
 if(!token)throw Error('preference_authorization_unavailable');
 const api=async(path,method='GET',body)=>{const r=await fetch('https://services.leadconnectorhq.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,Version:'v3','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('preference_provider_'+r.status);return r.json();};
 return {connection,api};
}
async function register({db,tenantId,contactId,locationId,leadId,draftPath,phone,email}){
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(contactId||'')||!/^tenants\/[A-Za-z0-9_-]+\/websiteFunnelDrafts\/[a-f0-9]{64}$/.test(draftPath||'')||draftPath.split('/')[1]!==tenantId)throw Error('preference_mapping_invalid');
 if((await db.doc(`ghlLocationTenants/${locationId}`).get()).data()?.tenantId!==tenantId)throw Error('preference_location_mismatch');
 const ref=db.doc(`gmsPreferenceContacts/${tenantId}/contacts/${contactId}`);
 await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();if(old&&(old.locationId!==locationId||digits(old.phone)!==digits(phone)))throw Error('preference_mapping_conflict');tx.set(db.doc(`gmsProviderContacts/${tenantId}/leads/${leadId}`),{tenantId,locationId,contactId,leadId,phone,verifiedAt:FieldValue.serverTimestamp()},{merge:true});tx.set(db.doc(`gmsProviderContactOwners/${locationId}/contacts/${contactId}`),{tenantId,locationId,contactId,leadId,updatedAt:FieldValue.serverTimestamp()},{merge:true});tx.set(db.doc(`gmsPreferenceContacts/${tenantId}`),{tenantId,enabled:true},{merge:true});tx.set(ref,{tenantId,contactId,locationId,leadId,draftPath,phone,email:email||'',updatedAt:FieldValue.serverTimestamp()},{merge:true});});
}
async function applyBlocked({db,record,channels,source='gohighlevel'}){
 const root=db.doc(`tenants/${record.tenantId}`),leadRef=root.collection('leads').doc(record.leadId),stamp=FieldValue.serverTimestamp();
 await db.runTransaction(async tx=>{const [leadSnap,taskSnap]=await Promise.all([tx.get(leadRef),tx.get(root.collection('followUpTasks').doc('weekly-listings-'+record.leadId))]);const lead=leadSnap.data(),patch={};
  if(channels.sms){patch.smsOptOut=true;patch['communicationPreferences.sms.status']='unsubscribed';tx.set(db.doc(`gmsMessagingConsents/${record.tenantId}/recipients/${recipientId(record.phone)}`),{phone:record.phone,status:'opted_out',source,optedOutAt:stamp},{merge:true});}
  if(channels.email){patch.emailOptOut=true;patch['communicationPreferences.email.status']='unsubscribed';patch['communicationPreferences.weeklyListingEmails.status']='unsubscribed';patch['communicationPreferences.weeklyListingEmails.requested']=false;}
  if(channels.call){patch.doNotCall=true;patch['communicationPreferences.call.status']='unsubscribed';}
  if(lead&&lead.tenantId===record.tenantId&&digits(lead.phone)===digits(record.phone)&&Object.keys(patch).length)tx.update(leadRef,{...patch,preferencesSyncedAt:stamp});
  if(channels.email&&taskSnap.exists)tx.update(root.collection('followUpTasks').doc('weekly-listings-'+record.leadId),{status:'cancelled',updatedAt:stamp});
 });
}
async function read({db,record,client}){
 client=client||await provider(db,record.tenantId);if(client.connection.locationId!==record.locationId)throw Error('preference_location_mismatch');
 const contact=(await client.api('/contacts/'+encodeURIComponent(record.contactId))).contact;
 if(contact?.id!==record.contactId||contact.locationId!==record.locationId||digits(contact.phone)!==digits(record.phone))throw Error('preference_contact_mismatch');
 return {client,contact,channels:blocked(contact)};
}
async function syncOne({db,record,client}){
 const state=await read({db,record,client});const consent=(await db.doc(`gmsMessagingConsents/${record.tenantId}/recipients/${recipientId(record.phone)}`).get()).data();const lead=(await db.doc(`tenants/${record.tenantId}/leads/${record.leadId}`).get()).data();
 const local={sms:consent?.status==='opted_out'||lead?.smsOptOut===true,email:lead?.emailOptOut===true,call:lead?.doNotCall===true};
 const required=Object.fromEntries(Object.entries(local).filter(([k,v])=>v&&!state.channels[k]).map(([k])=>[k,{status:'active',message:'Recipient communication preference recorded by GMS'}]));
 if(Object.keys(required).length){await state.client.api('/contacts/'+encodeURIComponent(record.contactId),'PUT',{dndSettings:{...Object.fromEntries(Object.entries(state.contact.dndSettings||{}).map(([k,v])=>[k.toLowerCase(),v])),...required}});const verify=await read({db,record,client:state.client});if(Object.keys(required).some(k=>!verify.channels[k]))throw Error('preference_provider_readback_failed');state.channels=verify.channels;}
 await applyBlocked({db,record,channels:state.channels});
 await db.doc(`gmsPreferenceContacts/${record.tenantId}/contacts/${record.contactId}`).set({lastSyncedAt:FieldValue.serverTimestamp(),syncStatus:'current'},{merge:true});
 return state.channels;
}
async function beforeSms({db,tenantId,receipt,draft}){
 const record={tenantId,contactId:receipt.contactId,locationId:receipt.locationId,leadId:draft.leadId,draftPath:`tenants/${tenantId}/websiteFunnelDrafts/${draft.inquiryEmailReference}`,phone:draft.lead.phone,email:draft.lead.email};
 await register({db,...record});const state=await read({db,record});if(state.channels.sms){await applyBlocked({db,record,channels:state.channels});throw Error('recipient_unsubscribed');}return record;
}
async function resubscribeSms({db,record}){const state=await read({db,record});if(state.contact.dnd===true)throw Error('global_contact_opt_out');const settings=Object.fromEntries(Object.entries(state.contact.dndSettings||{}).map(([k,v])=>[k.toLowerCase(),v]));await state.client.api('/contacts/'+encodeURIComponent(record.contactId),'PUT',{dndSettings:{...settings,sms:{status:'inactive'}}});const verified=await read({db,record,client:state.client});if(verified.channels.sms)throw Error('recipient_resubscription_pending');const ref=db.doc(`tenants/${record.tenantId}/leads/${record.leadId}`);if((await ref.get()).exists)await ref.update({smsOptOut:false,'communicationPreferences.sms.status':'opted_in',preferencesSyncedAt:FieldValue.serverTimestamp()});}
module.exports={resubscribeSms,blocked,provider,register,applyBlocked,read,syncOne,beforeSms};
