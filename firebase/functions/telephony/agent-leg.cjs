'use strict';
const {FieldValue}=require('firebase-admin/firestore');
const {leadDial}=require('./server-dial.cjs');
async function handleAgentLeg({db,event,connectionId,provider,callbackUrl,enabled}) {
  if(event.legRole!=='agent') return false;
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(event.gmsCallId || '') || !/^[A-Za-z0-9_-]{1,120}$/.test(event.tenantId || '')) throw new Error('Invalid agent call mapping.');
  const binding=(await db.doc(`gmsCallBindings/${event.gmsCallId}`).get()).data();
  if(!binding || binding.tenantId!==event.tenantId || event.connectionId!==connectionId || event.from!==binding.from || event.to!==binding.agentSipDestination) throw new Error('Agent leg ownership mismatch.');
  const ref=db.doc(binding.callPath),eventRef=ref.collection('providerEvents').doc(event.id);
  await db.runTransaction(async tx=>{
    const [seen,saved]=await Promise.all([tx.get(eventRef),tx.get(ref)]);
    const call=saved.data();
    if(!call || (call.agentCallId && call.agentCallId!==event.callId)) throw new Error('Conflicting agent call binding.');
    if(seen.exists) return;
    const agentLegStatus=event.answered?'answered':event.status==='completed'?'completed':event.status==='ringing'?'ringing':call.agentLegStatus;
    tx.update(ref,{agentCallId:event.callId,agentLegStatus,updatedAt:FieldValue.serverTimestamp()});
    tx.create(eventRef,{provider:'telnyx',eventType:event.eventType,legRole:'agent',receivedAt:FieldValue.serverTimestamp()});
  });
  if(event.answered && enabled) {
    const dial=await db.runTransaction(async tx=>{
      const call=(await tx.get(ref)).data();
      if(!call || call.agentLegStatus!=='answered' || call.leadDialStatus || ['completed','failed','needs_reconciliation'].includes(call.status)) return null;
      tx.update(ref,{leadDialStatus:'requested',status:'ringing'});
      return leadDial(ref.id,{...call,leadDialStatus:'requested'},callbackUrl);
    });
    if(dial) {
      try {
        const result=await provider.start(dial);
        if(!result.id) throw new Error('Missing lead leg.');
        await db.runTransaction(async tx=>{
          const bindingRef=db.doc(`gmsCallBindings/${ref.id}`),fresh=await tx.get(bindingRef);
          if(fresh.data()?.providerCallId && fresh.data().providerCallId!==result.id) throw new Error('Conflicting lead provider identity.');
          tx.update(bindingRef,{providerCallId:result.id});
          tx.update(ref,{providerCallId:result.id,leadDialStatus:'dialed'});
        });
      } catch {
        await ref.update({leadDialStatus:'needs_reconciliation',status:'needs_reconciliation'});
        throw new Error('Lead dial needs reconciliation.');
      }
    }
  }
  if(event.status==='completed') {
    const call=(await ref.get()).data();
    if(call.providerCallId && !['completed','failed'].includes(call.status)) await provider.end(call.providerCallId);
    if(!call.providerCallId && !call.leadDialStatus) {
      await db.runTransaction(async tx=>{
        const leadRef=db.doc(`tenants/${call.tenantId}/leads/${call.leadId}`),lead=await tx.get(leadRef);
        tx.update(ref,{status:'completed',endedAt:FieldValue.serverTimestamp()});
        if(lead.data()?.activeCallId===ref.id) tx.update(leadRef,{activeCallId:null,callStartPending:false});
      });
    }
  }
  return true;
}
module.exports={handleAgentLeg};
