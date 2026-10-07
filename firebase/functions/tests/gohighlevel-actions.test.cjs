const assert=require('node:assert/strict'),test=require('node:test');
const {getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
process.env.GMS_GOHIGHLEVEL_CONFIG=JSON.stringify({locationTokens:{'action-location':'emulator-only-location-token'}});
const functions=require('../index.js'),db=getFirestore(),auth=getAuth();
const tenantId='ghl-action-tenant',uid='ghl-action-agent',locationId='action-location',leadId='authorized-lead';
const request=(commandId,input={body:'Approved test note'})=>({auth:{uid,token:{}},data:{tenantId,leadId,action:'add_note',commandId,input}});
const originalFetch=global.fetch;
let writes=0,reads=0;
test.before(async()=>{
  await auth.createUser({uid,email:'ghl-actions@example.test'});
  await Promise.all([
    db.doc(`tenants/${tenantId}`).set({environment:'production',demo:false}),
    db.doc(`tenants/${tenantId}/config/onboarding`).set({revision:1,data:{locationId}}),
    db.doc(`gmsProviderConnections/${tenantId}`).set({locationId,status:'connected'}),
    db.doc(`ghlLocationTenants/${locationId}`).set({tenantId}),
    db.doc(`agentUsers/${uid}/assignments/${tenantId}`).set({status:'active',role:'agent',brandId:'authorized-brand'}),
    db.doc(`tenants/${tenantId}/leads/${leadId}`).set({tenantId,brandId:'authorized-brand',assignedTo:uid}),
    db.doc(`gmsProviderContacts/${tenantId}/leads/${leadId}`).set({locationId,contactId:'server-contact'}),
  ]);
  global.fetch=async(url,options)=>{
    assert.equal(url,'https://services.leadconnectorhq.com/contacts/server-contact'+(options.method==='POST'?'/notes':''));
    assert.equal(options.headers.Authorization,'Bearer emulator-only-location-token');
    if(options.method==='GET') {reads++;return {ok:true,json:async()=>({contact:{id:'server-contact',locationId}})};}
    assert.equal(options.method,'POST');writes++;
    return {ok:true,json:async()=>({note:{id:'provider-note'}})};
  };
});
test.after(()=>{global.fetch=originalFetch;});
test('authorized notes use server contact ownership, audit and prevent duplicate provider writes',async()=>{
  const result=await functions.performGoHighLevelAction.run(request('command-one',{body:'Approved test note',contactId:'foreign-contact',locationId:'foreign-location'}));
  assert.equal(result.providerRecordId,'provider-note');
  assert.equal((await functions.performGoHighLevelAction.run(request('command-one'))).status,'succeeded');
  assert.equal(writes,1);
  const audit=await db.collection(`tenants/${tenantId}/auditLogs`).where('commandId','==','command-one').get();
  assert.equal(audit.size,1);
  await assert.rejects(functions.performGoHighLevelAction.run(request('command-one',{body:'Different operation'})),e=>e.code==='already-exists');
  assert.equal(writes,1);
});
test('foreign brands, unassigned leads and disabled identities cannot mutate provider records',async()=>{
  const before=reads;
  await db.doc(`tenants/${tenantId}/leads/foreign-lead`).set({tenantId,brandId:'foreign-brand',assignedTo:uid});
  const foreign=request('foreign-command');foreign.data.leadId='foreign-lead';
  await assert.rejects(functions.performGoHighLevelAction.run(foreign),e=>e.code==='permission-denied');
  assert.equal(reads,before);
  await auth.updateUser(uid,{disabled:true});
  await assert.rejects(functions.performGoHighLevelAction.run(request('disabled-command')),e=>e.code==='permission-denied');
  assert.equal(reads,before);assert.equal(writes,1);
});
