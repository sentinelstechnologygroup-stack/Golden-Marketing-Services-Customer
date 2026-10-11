'use strict';
function openNow(route, now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:route.timezone || 'America/Chicago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const value=type=>Number(parts.find(p=>p.type===type)?.value);
  const minute=value('hour')*60+value('minute');
  return minute >= route.openMinute && minute < route.closeMinute;
}
function eligible(assignment,brandId,now=Date.now()) {
  return assignment?.status==='active' && ['agent','supervisor','gms_super_admin','admin'].includes(assignment.role)
    && [assignment.brandId,...(assignment.brandIds || [])].includes(brandId)
    && assignment.agentStatus==='available' && assignment.inboundEnabled===true
    && assignment.telnyxCredentialId && assignment.presenceUpdatedAt?.toMillis?.()>now-75000;
}
function id(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))throw new Error('Invalid identifier');return value;}
function canClaim(call,route,assignment,now=Date.now()) {
  return route.enabled===true && openNow(route,new Date(now)) && call.status==='queued'
    && call.queueDeadline?.toMillis?.()>now && eligible(assignment,call.brandId,now);
}
module.exports={openNow,eligible,id,canClaim};

function canFallback(call,expectedStatus) {
 return Boolean(call && (!expectedStatus || call.status===expectedStatus) && !['completed','voicemail','in_progress','on_hold','voicemail_prompt','bridging_agent'].includes(call.status));
}
function ownsEvent(mapping,event) {
 const lifecycle=['call.initiated','call.answered','call.hangup'].includes(event.eventType);
 return !((lifecycle || event.connectionId) && mapping.connectionId!==event.connectionId || (lifecycle || event.from) && mapping.from!==String(event.from || '') || (lifecycle || event.to) && mapping.to!==event.to);
}
module.exports.canFallback=canFallback;
module.exports.ownsEvent=ownsEvent;

function noticeFinished(event,payload,call){
 if(event.eventType!=='call.speak.ended' || payload.status!=='completed' || !['recording_notice','starting_queue'].includes(call.status))return false;
 try{return JSON.parse(Buffer.from(payload.client_state || '', 'base64').toString()).prompt==='recording_notice';}catch{return false;}
}
module.exports.noticeFinished=noticeFinished;
