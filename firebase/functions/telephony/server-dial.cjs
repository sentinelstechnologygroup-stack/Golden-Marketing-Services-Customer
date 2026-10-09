'use strict';
const crypto=require('node:crypto');
function commandId(callId,leg) {
  const hex=crypto.createHash('sha256').update(`${callId}:${leg}`).digest('hex').slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function state(callId,tenantId,legRole) {
  for(const value of [callId,tenantId]) if(typeof value!=='string' || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) throw new Error('Invalid call ownership.');
  return Buffer.from(JSON.stringify({gmsCallId:callId,tenantId,legRole})).toString('base64');
}
function agentDestination(username) {
  if(typeof username!=='string' || !/^[A-Za-z0-9_-]{1,120}$/.test(username)) throw new Error('Agent SIP identity is not provisioned.');
  return `sip:${username}@sip.telnyx.com`;
}
function agentDial(callId,call,callbackUrl) {
  if(!/^\+[1-9]\d{7,14}$/.test(call.from || '')) throw new Error('Invalid server-selected caller ID.');
  return {to:agentDestination(call.agentSipUsername),from:call.from,callbackUrl,
    commandId:commandId(callId,'agent'),clientState:state(callId,call.tenantId,'agent')};
}
function leadDial(callId,call,callbackUrl) {
  if(!call.agentCallId || call.agentLegStatus!=='answered' || call.leadDialStatus!=='requested' || !/^\+[1-9]\d{7,14}$/.test(call.destination || '')) throw new Error('Agent must answer before calling the lead.');
  return {to:call.destination,from:call.from,callbackUrl,...(call.conferenceMode?{}:{linkTo:call.agentCallId}),
    commandId:commandId(callId,'lead'),clientState:state(callId,call.tenantId,'lead')};
}
module.exports={agentDial,leadDial,agentDestination,state,commandId};
