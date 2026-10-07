const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeProfile } = require('../gohighlevel-profile-policy.cjs');
const current = { name: 'GCR', adminEmail: 'admin@example.test', locationId: 'gcr', phoneNumber: '+19362499427', telnyxPhoneNumberId: '123', brandName: 'Golden Cross', notes: 'Keep', campaigns: [] };
test('imports business information without changing identity or calling settings', () => {
  const data = mergeProfile(current, { id: 'gcr', name: 'GMS-Golden Cross Realty', email: 'office@example.test', phone: '+19365550100', website: 'GoldenCrossRealty.com', address: 'Main St', city: 'Willis', timezone: 'America/Chicago', business: { legalName: 'Golden Cross Realty LLC' } }, 'gcr');
  assert.equal(data.legalName, 'Golden Cross Realty LLC');
  assert.equal(data.businessEmail, 'office@example.test');
  for (const field of ['adminEmail', 'phoneNumber', 'telnyxPhoneNumberId', 'brandName', 'notes']) assert.equal(data[field], current[field]);
  assert.deepEqual(data.campaigns, current.campaigns);
});
test('rejects a different location and invalid time zone', () => {
  assert.throws(() => mergeProfile(current, { id: 'other' }, 'gcr'), /mismatch/);
  assert.throws(() => mergeProfile(current, { id: 'gcr', timezone: 'invalid' }, 'gcr'), /time zone/);
});
test('absent provider fields retain saved details', () => {
  const data = mergeProfile({ ...current, domain: 'existing.example', phone: 'old' }, { id: 'gcr', website: '', phone: null }, 'gcr');
  assert.equal(data.domain, 'existing.example'); assert.equal(data.phone, 'old');
  assert.equal(mergeProfile({ ...current, legalName: 'Saved legal name' }, { id: 'gcr', business: { name: 'Friendly name' } }, 'gcr').legalName, 'Saved legal name');
});
