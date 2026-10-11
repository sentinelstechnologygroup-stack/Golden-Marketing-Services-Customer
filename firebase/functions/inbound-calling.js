// Dedicated live-agent inbound route. No AI, SMS, or outbound gate changes.
const crypto=require('node:crypto');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {defineSecret}=require('firebase-functions/params');
const {getFirestore,FieldValue,Timestamp}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {createProvider}=require('./telephony/providers.cjs');
const {openNow,eligible,id,canClaim,canFallback,ownsEvent,noticeFinished}=require('./telephony/inbound-policy.cjs');
const key=defineSecret('TELNYX_API_KEY');
const db=getFirestore();
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const stamp=()=>FieldValue.serverTimestamp();
const callbackUrl=()=>process.env.TELEPHONY_STATUS_URL;
function provider(){return createProvider('telnyx',{token:key.value(),connectionId:process.env.TELNYX_CONNECTION_ID});}
async function command(callId,action,body={}) {
  const r=await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callId)}/actions/${action}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key.value(),'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){const error=new Error('Inbound phone command failed');error.providerStatus=r.status;throw error;}
  return (await r.json()).data;
}
async function routeFor(tenantId){return (await db.doc(`tenants/${tenantId}/config/inboundCalling`).get()).data();}
async function authorized(request) {
  if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in first.');
  let tenantId;try{tenantId=id(request.data?.tenantId);}catch{throw new HttpsError('invalid-argument','Choose a client.');}
  const user=await getAuth().getUser(request.auth.uid);
  if(user.disabled || user.customClaims?.mustChangePassword)throw new HttpsError('permission-denied','Account unavailable.');
  const ref=db.doc(`agentUsers/${user.uid}/assignments/${tenantId}`),assignment=(await ref.get()).data(),route=await routeFor(tenantId);
  if(!route?.enabled || assignment?.status!=='active' || !(['agent','supervisor','gms_super_admin'].includes(assignment.role) || assignment.role==='admin' && user.customClaims?.gmsSuperAdmin===true) || ![assignment.brandId,...(assignment.brandIds || [])].includes(route.brandId))throw new HttpsError('permission-denied','No inbound assignment for this client.');
  return {user,tenantId,ref,assignment,route};
}
async function matchLead(route,caller,callId) {
  const collection=db.collection(`tenants/${route.tenantId}/leads`);
  const validPhone=/^\+[1-9]\d{7,14}$/.test(caller);
  const rows=validPhone ? await collection.where('phone','==',caller).limit(20).get() : {docs:[]};
  const matches=rows.docs.filter(d=>d.data().brandId===route.brandId);
  if(matches.length===1)return {leadId:matches[0].id,leadMatch:'caller_number'};
  // Preserve ambiguous existing records. New inquiry is not identity verification.
  const ref=collection.doc(`inbound_${callId}`);
  if(!(await ref.get()).exists)await ref.set({tenantId:route.tenantId,brandId:route.brandId,firstName:'Inbound caller',phone:validPhone?caller:null,status:'new',sourceId:route.sourceId,assignedTo:null,contactAttempts:0,verificationStatus:'pending',qualificationStatus:'pending',lifecycleStage:'inquiry',inboundMatch:matches.length?'ambiguous':'unmatched',candidateLeadIds:matches.map(d=>d.id),createdAt:stamp(),updatedAt:stamp()});
  return {leadId:ref.id,leadMatch:matches.length?'ambiguous':'unmatched'};
}
async function callbackTask(ref,call,reason) {
  await db.doc(`tenants/${call.tenantId}/followUpTasks/inbound_${ref.id}`).set({tenantId:call.tenantId,brandId:call.brandId,leadId:call.leadId,callId:ref.id,task_type:'callback_reminder',status:'pending',title:'Return inbound call',notes:reason,dueAt:stamp(),createdAt:stamp()},{merge:true});
}
async function voicemail(ref,route,expectedStatus) {
  const reserved=await db.runTransaction(async tx=>{const call=(await tx.get(ref)).data();if(!canFallback(call,expectedStatus))return null;tx.update(ref,{status:'voicemail_prompt',callKind:'voicemail',updatedAt:stamp()});return call;});
  if(!reserved)return;
  await callbackTask(ref,reserved,'Caller reached voicemail.');
  if(reserved.agentCallId)await provider().end(reserved.agentCallId).catch(()=>{});
  await command(reserved.providerCallId,'gather_stop').catch(()=>{});
  await command(reserved.providerCallId,'speak_stop').catch(()=>{});
  await command(reserved.providerCallId,'playback_stop',{stop:'all'}).catch(()=>{});
  await command(reserved.providerCallId,'speak',{payload:`Thank you for calling ${route.brandName}. Our team is unavailable. This call may be recorded for quality assurance and training. Please leave your name, callback number, and reason for calling after the tone.`,voice:'female',language:'en-US',client_state:Buffer.from(JSON.stringify({gmsCallId:ref.id,tenantId:route.tenantId,legRole:'caller',prompt:'voicemail'})).toString('base64'),command_id:require('./telephony/server-dial.cjs').commandId(ref.id,'voicemail-prompt')});
}
async function queue(ref,route) {
  if(!openNow(route))return voicemail(ref,route,'recording_notice');
  const call=await db.runTransaction(async tx=>{const value=(await tx.get(ref)).data();if(!value || !['recording_notice','starting_queue'].includes(value.status))return null;tx.update(ref,{status:'starting_queue',recordingRequested:true,recordingPolicy:'record_all',recordingDisclosurePlayed:true});return value;});
  if(!call)return;
  const conf=call.conferenceId?{id:call.conferenceId}:await provider().conference(call.providerCallId,ref.id);
  await ref.update({conferenceId:conf.id,conferenceStatus:'waiting_for_agent'});
  await db.doc(`gmsCallBindings/${ref.id}`).update({recordingRequested:true,recordingPolicy:'record_all',recordingDisclosurePlayed:true});
  await ref.update({status:'queued',queueDeadline:Timestamp.fromMillis(Date.now()+(route.maxWaitSeconds || 600)*1000),lastQueuePromptAt:stamp(),queueCycle:0,updatedAt:stamp()});
  await queueWindow(ref,{...call,queueCycle:0});
}
async function queueWindow(ref,call,startMusic=true) {
  if((await ref.get()).data()?.status!=='queued')return;
  await command(call.providerCallId,'gather',{minimum_digits:1,maximum_digits:1,valid_digits:'12',initial_timeout_millis:(call.queueCycle || 0)===0?10000:30000,timeout_millis:(call.queueCycle || 0)===0?10000:30000,command_id:require('./telephony/server-dial.cjs').commandId(ref.id,`options-${call.queueCycle || 0}`)});
  if(startMusic)await command(call.providerCallId,'playback_start',{playback_content:require('./telephony/hold-music.cjs').holdMusic(),audio_type:'wav',loop:'infinity',target_legs:'self',command_id:require('./telephony/server-dial.cjs').commandId(ref.id,`music-${call.queueCycle || 0}`)});
}
async function queueAnnouncement(ref,route,eventId) {
  const call=await db.runTransaction(async tx=>{const c=(await tx.get(ref)).data();if(c?.status!=='queued')return null;tx.update(ref,{queueCycle:(c.queueCycle || 0)+1,lastQueuePromptAt:stamp()});return c;});
  if(!call)return;
  if(!openNow(route) || call.queueDeadline?.toMillis()<Date.now())return voicemail(ref,route,'queued');
  const rows=await ref.parent.where('status','==','queued').limit(500).get();
  const position=1+rows.docs.filter(d=>d.id!==ref.id && d.data().brandId===call.brandId && (d.data().createdAt?.toMillis() || 0)<(call.createdAt?.toMillis() || 0)).length;
  await command(call.providerCallId,'playback_stop',{stop:'all'});
  await command(call.providerCallId,'speak',{payload:`You are caller number ${position} in line. Please continue to hold for the next available ${route.brandName} representative. Press 1 to leave a voicemail, or press 2 to request a callback.`,voice:'female',language:'en-US',client_state:Buffer.from(JSON.stringify({gmsCallId:ref.id,tenantId:route.tenantId,legRole:'caller',prompt:'queue_announcement'})).toString('base64'),command_id:require('./telephony/server-dial.cjs').commandId(ref.id,eventId)});
}
async function requestCallback(ref,route) {
  const current=(await ref.get()).data();if(!/^\+[1-9]\d{7,14}$/.test(current?.destination || ''))return voicemail(ref,route,'queued');
  const call=await db.runTransaction(async tx=>{const c=(await tx.get(ref)).data();if(c?.status!=='queued')return null;tx.update(ref,{status:'callback_requested'});return c;});if(!call)return;
  await callbackTask(ref,call,'Caller requested a callback from the inbound queue.');
  await command(call.providerCallId,'playback_stop',{stop:'all'});
  await command(call.providerCallId,'speak',{payload:`Thank you. Your callback request has been saved for ${route.brandName}. A representative will return your call. Goodbye.`,voice:'female',language:'en-US',client_state:Buffer.from(JSON.stringify({prompt:'callback_confirmation'})).toString('base64'),command_id:require('./telephony/server-dial.cjs').commandId(ref.id,'callback-confirmation')});
}
async function saveRecording(ref,call,recordingId) {
  if(!require('./telephony/readiness.cjs').recordingAllowed(call) || !recordingId)return;
  require('./telephony/recording-archive.cjs').recordingIdentity(recordingId);
  const job=db.doc(`gmsRecordingArchiveJobs/${recordingId}`);
  await db.runTransaction(async tx=>{const seen=await tx.get(job);if(seen.exists)return;tx.create(job,{recordingId,callPath:ref.path,tenantId:call.tenantId,status:'pending',createdAt:stamp()});tx.update(ref,{recordingStatus:'archive_pending'});});
}
// Called only after the existing Telnyx Ed25519 signature check.
async function handleInbound({event,payload}) {
  const map=db.doc(`gmsInboundProviderBindings/${digest(event.callId)}`);
  let mapping=(await map.get()).data();
  if(!mapping && event.eventType==='call.initiated' && payload.direction==='incoming') {
    const rows=await db.collection('gmsInboundNumberRoutes').where('phoneNumber','==',event.to).limit(2).get();
    if(rows.size!==1)return false;
    const route=rows.docs[0].data();
    if(!route.enabled || event.connectionId!==route.connectionId)return false;
    const callId=digest(event.callId),ref=db.doc(`tenants/${route.tenantId}/callRecords/${callId}`);
    const exists=await ref.get();
    if(!exists.exists){
      const caller=String(event.from || 'anonymous').slice(0,100),lead=await matchLead(route,caller,callId);
      const batch=db.batch();
      const call={...lead,tenantId:route.tenantId,brandId:route.brandId,provider:'telnyx',direction:'inbound',from:route.phoneNumber,destination:caller,providerCallId:event.callId,status:'answering',agentUid:null,recordingPolicy:'record_all',recordingConsent:false,recordingRequested:false,conferenceMode:true,createdAt:stamp(),updatedAt:stamp()};
      batch.create(ref,call);batch.create(db.doc(`gmsCallBindings/${callId}`),{...call,callPath:ref.path});
      mapping={callPath:ref.path,tenantId:route.tenantId,role:'caller',connectionId:event.connectionId,from:String(event.from || ''),to:event.to};batch.create(map,mapping);await batch.commit();
    }else mapping={callPath:ref.path,tenantId:route.tenantId,role:'caller',connectionId:event.connectionId,from:event.from,to:event.to};
    await provider().answer(event.callId);return true;
  }
  if(!mapping && event.legRole==='inbound_agent' && /^[A-Za-z0-9_-]{1,128}$/.test(event.gmsCallId || '') && /^[A-Za-z0-9_-]{1,128}$/.test(event.tenantId || '')) {
    const ref=db.doc(`tenants/${event.tenantId}/callRecords/${event.gmsCallId}`),call=(await ref.get()).data();
    if(call?.direction!=='inbound' || call.status!=='dialing_agent' || call.agentSipDestination!==event.to || call.from!==event.from || event.connectionId!==process.env.TELNYX_CONNECTION_ID)return false;
    mapping={callPath:ref.path,tenantId:call.tenantId,role:'agent',from:event.from,to:event.to,connectionId:event.connectionId};await map.set(mapping);
  }
  if(!mapping)return false;
  if(!ownsEvent(mapping,event))throw new Error('Inbound ownership mismatch');
  const ref=db.doc(mapping.callPath),route=await routeFor(mapping.tenantId),call=(await ref.get()).data();
  if(!route || !call)return true;
  const seen=ref.collection('providerEvents').doc(event.id);
  // Commands are idempotent; mark events after success so provider retries repair failures.
  if((await seen.get()).exists)return true;
  if(mapping.role==='agent') {
    if(event.answered && ['dialing_agent','bridging_agent'].includes(call.status)) {
      await ref.update({status:'bridging_agent'});
      const conf=call.conferenceId?{id:call.conferenceId}:await provider().conference(call.providerCallId,ref.id);
      await provider().join(conf.id,event.callId);
      await command(call.providerCallId,'gather_stop').catch(()=>{});
      await command(call.providerCallId,'playback_stop',{stop:'all',command_id:require('./telephony/server-dial.cjs').commandId(ref.id,'queue-music-stop')});
      await command(call.providerCallId,'speak',{payload:'You are now connected.',voice:'female',language:'en-US',command_id:require('./telephony/server-dial.cjs').commandId(ref.id,'connected-cue')});
      await ref.update({agentCallId:event.callId,conferenceId:conf.id,conferenceStatus:'ready',leadConferenceJoined:true,status:'in_progress'});
      if(require('./telephony/readiness.cjs').recordingAllowed(call)){await provider().record(call.providerCallId,true);await ref.update({recordingStatus:'recording'});}
    }
    if(event.status==='completed' && !['completed','completion_requested'].includes(call.transferStatus)) {
      if(['in_progress','on_hold'].includes(call.status))await provider().end(call.providerCallId);
      else if(call.status==='dialing_agent')await voicemail(ref,route);
    }
  }else {
    if(event.eventType==='call.initiated' && call.status==='answering')await provider().answer(event.callId);
    if(event.answered && call.status==='answering') {
      if(!openNow(route))await voicemail(ref,route);
      else {await ref.update({status:'recording_notice'});await command(event.callId,'speak',{payload:`Thank you for calling ${route.brandName}. This call may be recorded for quality assurance and training. Please hold while we connect you with a representative.`,voice:'female',language:'en-US',client_state:Buffer.from(JSON.stringify({gmsCallId:ref.id,tenantId:route.tenantId,legRole:'caller',prompt:'recording_notice'})).toString('base64'),command_id:require('./telephony/server-dial.cjs').commandId(ref.id,'recording-notice')});}
    }
    if(noticeFinished(event,payload,call))await queue(ref,route);
    let prompt;try{prompt=JSON.parse(Buffer.from(payload.client_state || '', 'base64').toString()).prompt;}catch{}
    if(event.eventType==='call.speak.ended' && payload.status==='completed' && prompt==='queue_announcement' && call.status==='queued')await queueWindow(ref,call);
    if(event.eventType==='call.speak.ended' && payload.status==='completed' && prompt==='callback_confirmation' && call.status==='callback_requested')await provider().end(event.callId);
    if(event.eventType==='call.dtmf.received' && call.status==='queued'){if(payload.digit==='1')await voicemail(ref,route,'queued');else if(payload.digit==='2')await requestCallback(ref,route);}
    if(event.eventType==='call.gather.ended' && call.status==='queued'){if(payload.digits==='1')await voicemail(ref,route,'queued');else if(payload.digits==='2')await requestCallback(ref,route);else await queueAnnouncement(ref,route,event.id);}
    if(event.eventType==='call.speak.ended' && payload.status==='completed' && prompt==='voicemail' && call.status==='voicemail_prompt') {
      await ref.update({status:'voicemail',recordingConsent:false,recordingRequested:true,recordingPolicy:'record_all',recordingDisclosurePlayed:true,recordingStatus:'starting'});await db.doc(`gmsCallBindings/${ref.id}`).update({recordingConsent:false,recordingRequested:true,recordingPolicy:'record_all',recordingDisclosurePlayed:true});
      await command(event.callId,'record_start',{format:'wav',channels:'single',play_beep:true,max_length:120,timeout_secs:5,command_id:require('./telephony/server-dial.cjs').commandId(ref.id,'voicemail-record')});
    }
    if(event.eventType==='call.recording.saved'){await saveRecording(ref,call,event.recordingId);if(call.status==='voicemail')await provider().end(event.callId);}
    if(event.status==='completed') {
      await ref.update({status:'completed',endedAt:stamp(),updatedAt:stamp()});
      if(call.agentCallId)await provider().end(call.agentCallId).catch(()=>{});
      if(call.consultationCallId && call.consultationStatus!=='completed')await provider().end(call.consultationCallId).catch(()=>{});
      if(!['in_progress','on_hold','callback_requested'].includes(call.status))await callbackTask(ref,call,'Missed inbound call / voicemail.');
      if(call.leadId){const lr=db.doc(`tenants/${call.tenantId}/leads/${call.leadId}`);await db.runTransaction(async tx=>{const lead=await tx.get(lr);if(lead.data()?.activeCallId===ref.id)tx.update(lr,{activeCallId:null});});}
    }
  }
  await seen.set({provider:'telnyx',eventType:event.eventType,receivedAt:stamp()});return true;
}
exports.handleInbound=handleInbound;
exports.inboundCommunications=onCall({enforceAppCheck:false,secrets:[key]},async request=>{
  const ctx=await authorized(request),{action,callId,status,enabled}=request.data || {};
  if(action==='browser_session')return require('./telephony/browser-session.cjs').browserSession('telnyx',{token:key.value(),browserConnectionId:process.env.TELNYX_BROWSER_CONNECTION_ID},`gms_${ctx.user.uid}`,ctx.assignment);
  if(action==='presence') {
    if(!['offline','available','standby','do_not_disturb','break','lunch','after_call_work','busy'].includes(status))throw new HttpsError('invalid-argument','Invalid agent status');
    const statusChangedAtMs=await db.runTransaction(async tx=>{const previous=(await tx.get(ctx.ref)).data() || {};const now=Date.now(),changed=previous.agentStatus!==status,since=changed?now:previous.statusChangedAt?.toMillis?.() || now;tx.set(ctx.ref,{agentStatus:status,inboundEnabled:enabled===true,presenceUpdatedAt:stamp(),...((changed || !previous.statusChangedAt)?{statusChangedAt:Timestamp.fromMillis(since)}: {})},{merge:true});tx.set(db.doc(`agentUsers/${ctx.user.uid}`),{agent_status:status,presenceUpdatedAt:stamp()},{merge:true});if(changed)tx.create(db.collection('gmsAgentPresenceEvents').doc(),{tenantId:ctx.tenantId,agentUid:ctx.user.uid,status,previousStatus:previous.agentStatus || 'offline',previousDurationSeconds:previous.statusChangedAt?.toMillis?Math.max(0,Math.floor((now-previous.statusChangedAt.toMillis())/1000)):null,occurredAt:stamp()});return since;});return {ok:true,statusChangedAtMs};
  }
  if(action==='list') {
    if(request.data.connected===true && ctx.assignment.agentStatus==='available' && ctx.assignment.inboundEnabled===true){await ctx.ref.update({presenceUpdatedAt:stamp()});ctx.assignment.presenceUpdatedAt=Timestamp.now();}
    if(!eligible(ctx.assignment,ctx.route.brandId))return {calls:[]};
    const rows=await db.collection(`tenants/${ctx.tenantId}/callRecords`).where('status','==','queued').limit(500).get();
    return {calls:rows.docs.filter(d=>d.data().direction==='inbound' && canClaim(d.data(),ctx.route,ctx.assignment)).sort((a,b)=>(a.data().createdAt?.toMillis() || 0)-(b.data().createdAt?.toMillis() || 0)).slice(0,1).map(d=>({callId:d.id,leadId:d.data().leadId,brandName:ctx.route.brandName,callerNumber:d.data().destination,leadMatch:d.data().leadMatch}))};
  }
  if(action==='accept') {
    const ref=db.doc(`tenants/${ctx.tenantId}/callRecords/${id(callId)}`);
    const credential=await provider().credential(ctx.assignment.telnyxCredentialId);
    if(credential.connection_id!==process.env.TELNYX_BROWSER_CONNECTION_ID || !credential.sip_username)throw new HttpsError('failed-precondition','Agent phone is not provisioned');
    const sip=require('./telephony/server-dial.cjs').agentDestination(credential.sip_username);
    const call=await db.runTransaction(async tx=>{
      const [saved,assignment]=await Promise.all([tx.get(ref),tx.get(ctx.ref)]);const c=saved.data();
      if(!c || c.direction!=='inbound' || c.brandId!==ctx.route.brandId || !canClaim(c,ctx.route,assignment.data()))throw new HttpsError('already-exists','This call is no longer available.');
      const lr=db.doc(`tenants/${ctx.tenantId}/leads/${c.leadId}`),lead=await tx.get(lr);
      if(lead.data()?.activeCallId)throw new HttpsError('failed-precondition','This lead already has an active call.');
      tx.update(ref,{status:'dialing_agent',agentUid:ctx.user.uid,agentSipDestination:sip,agentDeadline:Timestamp.fromMillis(Date.now()+25000)});
      tx.update(ctx.ref,{agentStatus:'busy',statusChangedAt:stamp(),presenceUpdatedAt:stamp()});tx.create(db.collection('gmsAgentPresenceEvents').doc(),{tenantId:ctx.tenantId,agentUid:ctx.user.uid,status:'busy',previousStatus:assignment.data().agentStatus,previousDurationSeconds:assignment.data().statusChangedAt?.toMillis?Math.max(0,Math.floor((Date.now()-assignment.data().statusChangedAt.toMillis())/1000)):null,occurredAt:stamp()});tx.update(lr,{activeCallId:ref.id});tx.update(db.doc(`gmsCallBindings/${ref.id}`),{agentUid:ctx.user.uid,agentSipDestination:sip});return c;
    });
    try {const result=await provider().start({to:sip,from:call.from,callbackUrl:callbackUrl(),timeoutSeconds:20,commandId:require('./telephony/server-dial.cjs').commandId(ref.id,'inbound-agent'),clientState:require('./telephony/server-dial.cjs').state(ref.id,ctx.tenantId,'inbound_agent')});await ref.update({agentCallId:result.id});}
    catch(error){await voicemail(ref,ctx.route);throw new HttpsError('unavailable','Agent connection failed; caller routed to voicemail.');}
    return {callId:ref.id,leadId:call.leadId};
  }
  throw new HttpsError('invalid-argument','Unsupported inbound action');
});
exports.expireInboundOffers=onSchedule({schedule:'every 1 minutes',secrets:[key],maxInstances:1},async()=>{
  const routes=await db.collection('gmsInboundNumberRoutes').where('enabled','==',true).get();
  for(const r of routes.docs){const route=r.data();const calls=await db.collection(`tenants/${route.tenantId}/callRecords`).where('status','in',['queued','dialing_agent']).limit(500).get();for(const d of calls.docs){const c=d.data();if(c.direction==='inbound' && ((c.status==='queued' && c.queueDeadline?.toMillis()<Date.now()) || (c.status==='dialing_agent' && c.agentDeadline?.toMillis()<Date.now())))await voicemail(d.ref,route,c.status);}}
});
