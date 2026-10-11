'use strict';
function openNow(route, now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:route.timezone || 'America/Chicago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const value=type=>Number(parts.find(p=>p.type===type)?.value);
  const minute=value('hour')*60+value('minute');
  return minute >= route.openMinute && minute < route.closeMinute;
}
function eligible(assignment,brandId,now=Date.now()) {
  return assignment?.status==='active' && ['agent','supervisor','gms_super_admin'].includes(assignment.role)
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
