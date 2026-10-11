const test=require('node:test');const assert=require('node:assert/strict');const {listingEmailPreference:p,recordPreferenceAndTask:record}=require('../listing-email-policy.cjs');
test('unseen or omitted checkbox cannot enroll; explicit unchecked choice does not affect qualification',()=>{
 assert.equal(p({weeklyListingEmailsRequested:true}).status,'not_asked');assert.equal(p({weeklyListingEmailsRequested:true}).requested,false);
 const no=p({weeklyListingPreferencePresented:true,weeklyListingEmailsRequested:false});assert.equal(no.status,'declined');assert.equal(no.qualificationStatus,undefined);
 const yes=p({weeklyListingPreferencePresented:true,weeklyListingEmailsRequested:true},'now');assert.equal(yes.setupStatus,'pending_manual_setup');assert.equal(yes.unsubscribeVerified,false);assert.equal(yes.smsAccepted,undefined);
});
test('manual setup task is stable and an opt-out cancels rather than creating another task',()=>{
 const writes=[];const tx={set:(...args)=>writes.push(args)};const root={collection:name=>({doc:id=>`${name}/${id}`})};const args={tx,root,leadId:'lead-one',lead:{tenantId:'tenant-one',brandId:'brand-one',assignedTo:'staff'},stamp:'now'};
 record({...args,input:{weeklyListingPreferencePresented:true,weeklyListingEmailsRequested:true}});assert.equal(writes[1][0],'followUpTasks/weekly-listings-lead-one');assert.equal(writes[1][1].status,'pending');assert.equal(writes[1][1].communicationsSuppressed,true);
 record({...args,input:{weeklyListingPreferencePresented:true,weeklyListingEmailsRequested:false}});assert.equal(writes[3][0],writes[1][0]);assert.equal(writes[3][1].status,'cancelled');
});
