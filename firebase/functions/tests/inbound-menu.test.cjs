const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const crypto=require('node:crypto');
test('raw queued keypad input reaches voicemail and only the voicemail notice starts recording',async()=>{
 const callId='provider-test-call',id=crypto.createHash('sha256').update(callId).digest('hex'),path=`tenants/test-tenant/callRecords/${id}`;
 const rows=new Map([[path,{tenantId:'test-tenant',brandId:'test-brand',leadId:'test-lead',providerCallId:callId,status:'queued',recordingDisclosurePlayed:true}],
  [`gmsInboundProviderBindings/${id}`,{callPath:path,tenantId:'test-tenant',role:'caller',connectionId:'test-connection'}],
  ['tenants/test-tenant/config/inboundCalling',{enabled:true,tenantId:'test-tenant',brandName:'Test brand'}]]);
 const ref=path=>({path,id:path.split('/').pop(),get:async()=>({exists:rows.has(path),data:()=>rows.get(path)}),set:async data=>rows.set(path,{...rows.get(path),...data}),update:async data=>rows.set(path,{...rows.get(path),...data}),collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)})});
 const db={doc:ref,runTransaction:async fn=>fn({get:r=>r.get(),update:(r,d)=>r.update(d)} )};
 const original=Module._load,oldFetch=global.fetch,commands=[];
 Module._load=function(name,...rest){
  if(name==='firebase-functions/v2/https')return {onCall:(_,fn)=>fn,HttpsError:Error};
  if(name==='firebase-functions/v2/scheduler')return {onSchedule:(_,fn)=>fn};
  if(name==='firebase-functions/params')return {defineSecret:()=>({value:()=> 'test-token'})};
  if(name==='firebase-admin/firestore')return {getFirestore:()=>db,FieldValue:{serverTimestamp:()=>new Date()},Timestamp:{fromMillis:ms=>({toMillis:()=>ms})}};
  if(name==='firebase-admin/auth')return {getAuth:()=>({})};
  return original.call(this,name,...rest);
 };
 global.fetch=async(url,options)=>{commands.push({action:url.split('/').pop(),body:JSON.parse(options.body)});return {ok:true,json:async()=>({data:{result:'ok'}})};};
 try {
  const {handleInbound}=require('../inbound-calling.js');
  await handleInbound({event:{id:'press-one',callId,eventType:'call.dtmf.received'},payload:{digit:'1',client_state:Buffer.from(JSON.stringify({prompt:'queue_announcement'})).toString('base64')}});
  assert.equal(rows.get(path).status,'voicemail_prompt');assert.equal(rows.get(path).callKind,'voicemail');
  assert.deepEqual(commands.map(c=>c.action),['gather_stop','speak_stop','playback_stop','speak']);
  const notice=commands.at(-1).body;
  assert.equal(JSON.parse(Buffer.from(notice.client_state,'base64')).prompt,'voicemail');assert.equal(notice.voice,'male');assert.ok(!notice.payload.includes('recorded'));
  await handleInbound({event:{id:'old-queue-notice',callId,eventType:'call.speak.ended'},payload:{status:'completed',client_state:Buffer.from(JSON.stringify({prompt:'queue_announcement'})).toString('base64')}});
  assert.equal(rows.get(path).status,'voicemail_prompt');
  await handleInbound({event:{id:'voicemail-notice',callId,eventType:'call.speak.ended'},payload:{status:'completed',client_state:notice.client_state}});
  assert.equal(rows.get(path).status,'voicemail');assert.equal(commands.at(-1).action,'record_start');assert.equal(commands.at(-1).body.play_beep,true);
  const count=commands.length;
  await handleInbound({event:{id:'late-press',callId,eventType:'call.dtmf.received'},payload:{digit:'1'}});
  assert.equal(commands.length,count);
 } finally {Module._load=original;global.fetch=oldFetch;delete require.cache[require.resolve('../inbound-calling.js')];}
});
