'use strict';
const {identifier}=require('./gohighlevel-contract.cjs');
function text(value,max,required=false) {
  if(typeof value!=='string' || value.length>max || (required && !value.trim())) throw new Error('Invalid workflow text.');
  return value.trim();
}
function date(value) {
  if(typeof value!=='string' || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('A valid appointment/task time is required.');
  return new Date(value).toISOString();
}
function workflowRequest(action,input,{contactId,locationId}) {
  identifier(contactId); identifier(locationId);
  switch(action) {
    case 'add_note': return {method:'POST',path:`/contacts/${contactId}/notes`,body:{body:text(input.body,4000,true),title:text(input.title || 'GMS call notes',200,true)}};
    case 'create_task': return {method:'POST',path:`/contacts/${contactId}/tasks`,body:{title:text(input.title,200,true),body:text(input.body || '',4000),dueDate:date(input.dueDate),completed:false}};
    case 'update_contact': {
      const body={};
      for(const key of ['firstName','lastName','email','phone']) if(input[key]!==undefined) body[key]=text(input[key],key==='email'?320:100,true);
      if(!Object.keys(body).length) throw new Error('No contact changes supplied.');
      if(body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('Invalid email.');
      if(body.phone && !/^\+[1-9]\d{7,14}$/.test(body.phone)) throw new Error('Use an international phone number.');
      return {method:'PUT',path:`/contacts/${contactId}`,body};
    }
    case 'update_opportunity_status': {
      if(!['open','won','lost','abandoned'].includes(input.status)) throw new Error('Invalid opportunity status.');
      return {method:'PUT',path:`/opportunities/${identifier(input.opportunityId)}/status`,body:{status:input.status},verify:{type:'opportunity',id:input.opportunityId}};
    }
    case 'create_appointment': {
      const startTime=date(input.startTime),endTime=date(input.endTime);
      if(Date.parse(endTime)<=Date.parse(startTime)) throw new Error('Appointment end must follow start.');
      return {method:'POST',path:'/calendars/events/appointments',body:{calendarId:identifier(input.calendarId),locationId,contactId,startTime,endTime,title:text(input.title || 'GMS appointment',200,true),appointmentStatus:'new'},verify:{type:'calendar',id:input.calendarId}};
    }
    default: throw new Error('Unsupported workflow action.');
  }
}
module.exports={workflowRequest};
