const test=require('node:test');const assert=require('node:assert/strict');
if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Local emulators required');
const f=require('../lead-supplemental');const {getAuth}=require('firebase-admin/auth');const {getFirestore}=require('firebase-admin/firestore');const auth=getAuth();const db=getFirestore();
test('invited assigned staff can record supplemental details; visitors, customers and foreign assignments cannot',async()=>{
 const prefix=`supplemental-${Date.now()}`;const tenantId=prefix;const agent=prefix+'-agent';const client=prefix+'-client';
 await Promise.all([auth.createUser({uid:agent,email:agent+'@example.test'}),auth.createUser({uid:client,email:client+'@example.test'})]);
 const ref=db.doc(`tenants/${tenantId}/leads/lead-one`);await ref.set({tenantId,brandId:'brand-one',campaignId:'campaign-one',intakeStage:'gms_qualification',assignedTo:agent,qualificationStatus:'pending'});
 await db.doc(`agentUsers/${agent}/assignments/${tenantId}`).set({status:'active',role:'agent',brandId:'brand-one',campaignIds:['campaign-one']});
 const call=(uid,data)=>({auth:uid?{uid,token:{}}:null,data:{tenantId,leadId:'lead-one',...data}});
 await assert.rejects(f.saveLeadSupplementalPreferences.run(call(null,{financing:{}})),{code:'unauthenticated'});
 await assert.rejects(f.saveLeadSupplementalPreferences.run(call(client,{financing:{loanPrequalified:'no'}})),{code:'permission-denied'});
 await f.saveLeadSupplementalPreferences.run(call(agent,{financing:{loanPrequalified:'no',workingWithLender:'no',wantsLenderReferral:'yes'},qualificationStatus:'qualified',brandId:'foreign'}));
 let saved=(await ref.get()).data();assert.equal(saved.financingProfile.lenderReferralRequested,true);assert.equal(saved.financingProfile.nonDisqualifying,true);assert.equal(saved.financingProfile.recordedBy,agent);assert.equal(saved.qualificationStatus,'pending');assert.equal(saved.brandId,'brand-one');
 await f.saveLeadSupplementalPreferences.run(call(agent,{weeklyEmail:{presented:true,requested:true,expectedRevision:0}}));saved=(await ref.get()).data();assert.equal(saved.communicationPreferences.weeklyListingEmails.source,'phone_agent');assert.equal(saved.communicationPreferences.weeklyListingEmails.setupStatus,'pending_manual_setup');assert.equal(saved.qualificationStatus,'pending');
 await db.doc(`agentUsers/${agent}/assignments/${tenantId}`).update({brandId:'brand-foreign'});await assert.rejects(f.saveLeadSupplementalPreferences.run(call(agent,{financing:{loanPrequalified:'yes'}})),{code:'permission-denied'});
 await Promise.all([auth.deleteUser(agent),auth.deleteUser(client)]);
});
