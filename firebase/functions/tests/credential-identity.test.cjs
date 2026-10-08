const test=require('node:test');
const assert=require('node:assert/strict');
const {connectionId}=require('../telephony/credential-identity.cjs');
test('accepts actual Telnyx resource identity and matching legacy identity',()=>{
  assert.equal(connectionId({resource_id:'connection:3065099933334898003'}),'3065099933334898003');
  assert.equal(connectionId({resource_id:'connection:123',connection_id:'123'}),'123');
});
test('rejects conflicting, missing and unrelated credential resources',()=>{
  for(const row of [{resource_id:'connection:123',connection_id:'456'},{resource_id:'other:123'},{}]) assert.throws(()=>connectionId(row));
});
