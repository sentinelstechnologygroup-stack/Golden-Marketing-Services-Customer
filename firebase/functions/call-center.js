const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {ms,summarize}=require('./call-center-policy.cjs');
const db=getFirestore();
exports.getGmsCallCenterReport=onCall({enforceAppCheck:false,maxInstances:2,timeoutSeconds:120},async request=>{
  if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in first.');
  const user=await getAuth().getUser(request.auth.uid),input=request.data || {},from=Date.parse(input.from),to=Date.parse(input.to);
  if(user.disabled || user.customClaims?.mustChangePassword)throw new HttpsError('permission-denied','Account unavailable.');
  if(!Number.isFinite(from) || !Number.isFinite(to) || from>=to || from>Date.now() || to-from>93*86400000)throw new HttpsError('invalid-argument','Choose a report period of up to 93 days.');
  const global=user.customClaims?.gmsSuperAdmin===true || user.customClaims?.platformAdmin===true;
  const assigned=await db.collection(`agentUsers/${user.uid}/assignments`).get(),scope=new Map(assigned.docs.filter(d=>d.data().status==='active' && d.data().role==='supervisor').map(d=>[d.id,d.data().brandIds || (d.data().brandId?[d.data().brandId]:[])]));
  if(!global && !scope.size)throw new HttpsError('permission-denied','Supervisor or super-admin access required.');
  const tenants=global?(await db.collection('tenants').limit(201).get()).docs:assigned.docs.filter(d=>scope.has(d.id));
  if(tenants.length>200)throw new HttpsError('resource-exhausted','Choose a narrower client scope.');
  const clients=tenants.map(d=>({id:d.id,name:d.data().name || d.data().tenantName || d.id}));
  if(input.clientId && !clients.some(c=>c.id===input.clientId))throw new HttpsError('permission-denied','Client is outside your assignments.');
  const selected=clients.filter(c=>!input.clientId || c.id===input.clientId),calls=[],brands=[],team=new Map();let truncated=false;
  for(const client of selected){
    if(calls.length>=10000){truncated=true;break;}
    const [callRows,brandRows]=await Promise.all([db.collection(`tenants/${client.id}/callRecords`).where('createdAt','>=',Timestamp.fromMillis(from)).where('createdAt','<',Timestamp.fromMillis(to)).orderBy('createdAt').limit(2001).get(),db.collection(`tenants/${client.id}/brands`).get()]);
    if(callRows.size>2000)truncated=true;
    const permits=id=>global || scope.get(client.id)?.includes(id);
    for(const b of brandRows.docs)if(permits(b.id))brands.push({id:b.id,clientId:client.id,name:b.data().displayName || b.data().name || b.id});
    for(const d of callRows.docs.slice(0,2000)){const c=d.data();if(!permits(c.brandId) || input.brandId && c.brandId!==input.brandId || input.agentUid && c.agentUid!==input.agentUid || input.direction && c.direction!==input.direction || input.includeTests===false && c.isTest===true)continue;
      calls.push({id:d.id,tenantId:client.id,clientName:client.name,brandId:c.brandId || null,agentUid:c.agentUid || null,leadId:c.leadId || null,direction:c.direction || 'outbound',status:c.status,connectionConfirmed:Boolean(c.connectedAt || c.leadConferenceJoined || c.transferStatus==='completed'),transferStatus:c.transferStatus || null,callKind:c.callKind || (c.direction==='inbound' && !c.agentUid && c.recordingStatus==='archived'?'voicemail':null),isTest:c.isTest===true,createdAt:ms(c.createdAt),startedAt:ms(c.startedAt),queuedAt:ms(c.queuedAt),queueExitedAt:ms(c.queueExitedAt),acceptedAt:ms(c.acceptedAt),connectedAt:ms(c.connectedAt),endedAt:ms(c.endedAt),handoffAt:ms(c.handoffAt),callbackRequestedAt:ms(c.callbackRequestedAt),holdStartedAt:ms(c.holdStartedAt),holdSeconds:c.holdSeconds ?? null});
    }
    const staff=await db.collection('agentAssignments').where('tenantId','==',client.id).limit(500).get();
    for(const a of staff.docs){const v=a.data();if(v.status!=='active' || !(v.brandIds || [v.brandId]).some(id=>permits(id) && (!input.brandId || id===input.brandId)))continue;const uid=v.agentUid;if(!uid)continue;const [profileDoc,assignmentDoc]=await Promise.all([db.doc(`agentUsers/${uid}`).get(),db.doc(`agentUsers/${uid}/assignments/${client.id}`).get()]);const profile=profileDoc.data(),live=assignmentDoc.data();if(live?.status!=='active')continue;team.set(uid+'|'+client.id,{uid,name:profile?.displayName || profile?.email || uid,status:live.agentStatus || 'offline',clientId:client.id,lastSeen:ms(live.presenceUpdatedAt),statusSince:ms(live.statusChangedAt)});}
  }
  for(const c of calls){if(!c.agentUid || [...team.values()].some(a=>a.uid===c.agentUid))continue;const profile=(await db.doc(`agentUsers/${c.agentUid}`).get()).data();team.set(c.agentUid+'|'+c.tenantId,{uid:c.agentUid,name:profile?.displayName || profile?.email || c.agentUid,status:profile?.status==='archived'?'archived':'inactive',clientId:c.tenantId,lastSeen:null,statusSince:null});}
  const eventRows=await db.collection('gmsAgentPresenceEvents').where('occurredAt','>=',Timestamp.fromMillis(from)).where('occurredAt','<',Timestamp.fromMillis(to)).orderBy('occurredAt').limit(10001).get();
  if(eventRows.size>10000)truncated=true;
  const events=eventRows.docs.slice(0,10000).map(d=>d.data()).filter(e=>selected.some(c=>c.id===e.tenantId) && (global || [...team.values()].some(a=>a.uid===e.agentUid && a.clientId===e.tenantId)) && (!input.agentUid || e.agentUid===input.agentUid));
  // Include the still-open status interval, clipped to the requested report period.
  for(const a of team.values())if((!input.agentUid || a.uid===input.agentUid) && a.statusSince && a.lastSeen){const end=Math.min(to,a.lastSeen+45000,Date.now());if(end>a.statusSince)events.push({agentUid:a.uid,previousStatus:a.status,previousDurationSeconds:(end-a.statusSince)/1000,occurredAt:end});}
  const result=summarize(calls,events,from,Math.min(to,Date.now()));
  const names=new Map([...team.values()].map(a=>[a.uid,a.name]));
  for(const row of result.byAgent)row.label=names.get(row.id) || (row.id==='unassigned'?'Unassigned / voicemail':row.id);
  for(const row of result.byBrand)row.label=brands.find(b=>b.id===row.id)?.name || row.id;
  return {...result,period:{from,to},clients,brands,agents:[...team.values()].filter(a=>!input.agentUid || a.uid===input.agentUid).map(a=>({...a,status:['archived','inactive'].includes(a.status)?a.status:Date.now()-(a.lastSeen || 0)>45000?'offline':a.status})),truncated,generatedAt:Date.now(),notes:['Timing is collected from this release forward. Older calls with missing timestamps are excluded from timing averages.','Handling time runs from connection to handoff or hangup, including hold. Agent status time measures portal activity; it is not a payroll record.','Peak concurrency counts connected calls managed by GMS agents; it excludes conversation after completed handoff.']};
});
