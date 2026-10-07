'use strict';
const crypto = require('node:crypto');
function normalizeEvent(provider, body, rawBody) {
  if (provider==='telnyx') {
    const data=body.data || {}, payload=data.payload || {};
    const statuses={'call.initiated':'ringing','call.answered':'in_progress','call.hangup':'completed','call.bridged':'in_progress'};
    let gmsCallId=null,tenantId=null,legRole=null;
    try { const state=JSON.parse(Buffer.from(payload.client_state || '', 'base64').toString()); gmsCallId=state.gmsCallId || null; tenantId=state.tenantId || null; legRole=state.legRole || null; } catch { /* Untrusted provider metadata. */ }
    return {id:data.id || crypto.createHash('sha256').update(rawBody).digest('hex'),callId:payload.call_control_id,gmsCallId,tenantId,legRole,from:payload.from,to:payload.to,connectionId:payload.connection_id,status:statuses[data.event_type] || null,eventType:data.event_type,recordingId:payload.recording_id || null,recordingUrl:payload.recording_urls?.wav || null,timestamp:data.occurred_at,answered:data.event_type==='call.answered'};
  }
  return {id:crypto.createHash('sha256').update(rawBody).digest('hex'),callId:body.CallSid,status:body.CallStatus || null,eventType:body.RecordingSid?'recording':body.CallStatus,recordingUrl:body.RecordingUrl || null,timestamp:body.Timestamp || null,answered:body.CallStatus==='in-progress'};
}
function statusCanAdvance(current,next) {
  const terminal=new Set(['completed','failed','busy','no-answer','canceled']);
  if (!next || terminal.has(current)) return false;
  const order={queued:0,ringing:1,'in-progress':2,in_progress:2,on_hold:2,completed:3,failed:3,busy:3,'no-answer':3,canceled:3};
  return (order[next]??-1)>=(order[current]??-1);
}
module.exports={normalizeEvent,statusCanAdvance};
