const { test } = require('node:test');
const assert = require('node:assert/strict');
const p = require('../client-onboarding-policy.cjs');
const form = () => p.normalize({ name: 'Test client', brandName: 'Test brand', adminEmail: 'client@example.com', industry: 'services', locationId: 'location-one', phoneNumber: '+13125551234', telnyxPhoneNumberId: '123456789012345678', campaigns: [{ id: 'campaign-one', name: 'Service', type: 'search', source: 'Search ads', agentUids: ['agent-one'], script: 'Script', qualification: 'Question', consent: 'Consent', adCopy: 'Ad', documentIds: ['creative-one'] }] });
const evidence = data => ({ connections: { configHash: p.connectionVersion(data), verifiedAtMs: Date.now()-1000, ghlVerified: true, phoneVerified: true }, membershipReady: true, agentsReady: true, documentsReady: true, approvals: { 'campaign-one': { status: 'approved', version: p.campaignVersion(data.campaigns[0]) } } });
test('identifiers and phone inputs reject path traversal / invalid numbers', () => {
  assert.throws(() => p.id('../other-client'));
  assert.throws(() => p.normalize({ name:'Client', phoneNumber:'312' }));
  assert.throws(() => p.normalize({ name:'Client', timezone:'invalid' }));
});
test('draft saves without fixtures or required connection fields', () => {
  const data = p.normalize({ name: 'New client', secret:'never copied', campaigns: [] });
  assert.equal(data.secret, undefined); assert.equal(data.locationId, '');
  assert.equal(p.readiness(data).ready, false); assert.equal(p.readiness(data).percent, 0);
});
test('only complete verified evidence can reach 100 percent', () => {
  const data = form();
  assert.equal(p.readiness(data, evidence(data)).percent, 100);
  assert.equal(p.readiness(data, { ...evidence(data), connections:{} }).ready, false);
  assert.equal(p.readiness(data, { ...evidence(data), membershipReady:false }).ready, false);
  assert.equal(p.readiness(data, { ...evidence(data), agentsReady:false }).ready, false);
  assert.equal(p.readiness(data, { ...evidence(data), documentsReady:false }).ready, false);
});
test('ad, script, file or routing edits invalidate client approval', () => {
  for (const key of ['adCopy','script','agentUids','documentIds']) {
    const data = form(); const proof = evidence(data);
    data.campaigns[0][key] = Array.isArray(data.campaigns[0][key]) ? ['different'] : 'Updated';
    assert.equal(p.readiness(data, proof).ready, false);
  }
});
test('expired, future-dated or mismatched provider verification is rejected', () => {
  for (const patch of [{ verifiedAtMs:Date.now()-86400001 }, { verifiedAtMs:Date.now()+100000 }, { configHash:'wrong' }]) {
    const data = form(); const proof = evidence(data);
    Object.assign(proof.connections,patch); assert.equal(p.readiness(data,proof).ready,false);
  }
});
