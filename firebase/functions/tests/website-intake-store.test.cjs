const test=require('node:test');const assert=require('node:assert/strict');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Local Firestore emulator required');
const {initializeApp}=require('firebase-admin/app');initializeApp({projectId:'demo-gms-local'});
const {getFirestore}=require('firebase-admin/firestore');const {persistWebsiteLead}=require('../website-intake-store.cjs');const db=getFirestore();
test('concurrent retries persist one lead, audit and staff notification; conflicts and durable throttling enforced',async()=>{
 const tenantId=`intake-${Date.now()}`;const route={tenantId,brandId:'brand-one',intakeStage:'gms_qualification'};
 const lead={name:'Synthetic Intake',email:'intake@example.test',phone:'+15555550100',assignedTo:'phone-staff',isTest:true,consent:{accepted:true,version:'v1',capturedAt:'first'}};
 const save=(key,data=lead)=>persistWebsiteLead({db,routeKey:'website-one',route,leadRef:db.collection(`tenants/${tenantId}/leads`).doc(),lead:data,idempotencyKey:key,brandName:'Test Brokerage',clientContactUid:'broker'});
 const results=await Promise.all(Array.from({length:8},()=>save('a'.repeat(64))));assert.equal(new Set(results.map(r=>r.leadId)).size,1);assert.equal(results.filter(r=>!r.duplicate).length,1);
 for(const collection of ['leads','auditLogs','notifications'])assert.equal((await db.collection(`tenants/${tenantId}/${collection}`).get()).size,1);
 const notes=await db.collection(`tenants/${tenantId}/notifications`).get();assert.equal(notes.docs[0].data().recipientUid,'phone-staff');
 assert.equal((await save('a'.repeat(64),{...lead,consent:{...lead.consent,capturedAt:'retry'}})).duplicate,true);
 await assert.rejects(save('a'.repeat(64),{...lead,phone:'+15555550200'}),{code:'intake-conflict'});await assert.rejects(save('bad-key'),{code:'intake-key'});
 for(const key of ['b','c','d','e'])await save(key.repeat(64));await assert.rejects(save('f'.repeat(64)),{code:'intake-throttled'});assert.equal((await save('a'.repeat(64))).duplicate,true);
});
