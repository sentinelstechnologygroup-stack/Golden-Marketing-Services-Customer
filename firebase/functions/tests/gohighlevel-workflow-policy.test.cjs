const test=require('node:test');
const assert=require('node:assert/strict');
const {workflowRequest}=require('../gohighlevel-workflow-policy.cjs');
const context={contactId:'contact-one',locationId:'gcr-location'};
test('provider-owned contact and location cannot be overridden by browser input',()=>{
  const result=workflowRequest('create_appointment',{calendarId:'calendar-one',contactId:'victim',locationId:'other',startTime:'2026-10-07T10:00:00Z',endTime:'2026-10-07T10:30:00Z'},context);
  assert.equal(result.body.contactId,'contact-one');assert.equal(result.body.locationId,'gcr-location');
  assert.deepEqual(result.verify,{type:'calendar',id:'calendar-one'});
});
test('arbitrary provider proxy paths and destructive operations are rejected',()=>{
  for(const action of ['delete_contact','send_sms','https://evil.example','update_user']) assert.throws(()=>workflowRequest(action,{},context));
  assert.throws(()=>workflowRequest('update_opportunity_status',{opportunityId:'../other',status:'won'},context));
});
test('invalid appointment ranges, missing task times and oversized notes fail before mutation',()=>{
  assert.throws(()=>workflowRequest('create_appointment',{calendarId:'one',startTime:'2026-10-07T11:00:00Z',endTime:'2026-10-07T10:00:00Z'},context));
  assert.throws(()=>workflowRequest('create_task',{title:'Call'},context));
  assert.throws(()=>workflowRequest('add_note',{body:'x'.repeat(4001)},context));
});
