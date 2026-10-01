const test = require('node:test');
const assert = require('node:assert/strict');
const { identifier, readRequest, publicRows, locationPayload } = require('../gohighlevel-contract.cjs');

test('provider requests use only the server-owned location', () => {
  const result = readRequest('conversations', 'location-gms', { locationId: 'attacker', token: 'secret', path: '/users', limit: 10 });
  assert.equal(result.path, '/conversations/search?locationId=location-gms&limit=10');
});
test('arbitrary endpoints and unsafe IDs are refused', () => {
  for (const value of ['../secrets', '', 'a/b', 'a?locationId=x']) assert.throws(() => identifier(value));
  assert.throws(() => readRequest('sendSMS', 'location-gms'));
  assert.throws(() => readRequest('__proto__', 'location-gms'));
  assert.throws(() => readRequest('toString', 'location-gms'));
  for (const limit of [-1, 0, 101, 1.5, 'NaN']) assert.throws(() => readRequest('conversations', 'location-gms', { limit }));
});
test('provider secrets and unexpected data are never returned', () => {
  assert.deepEqual(publicRows('calendars', { calendars: [{ id: 'calendar-1', name: 'GMS', access_token: 'secret', locationId: 'location-gms' }] }, 'location-gms'), [{ id: 'calendar-1', name: 'GMS' }]);
  assert.throws(() => publicRows('calendars', { calendars: [{ id: 'x', locationId: 'other' }] }, 'location-gms'));
  assert.throws(() => publicRows('calendars', {}, 'location-gms'));
});
test('provisioning needs an approved snapshot and preserves communications settings', () => {
  assert.throws(() => locationPayload({ name: 'GMS' }, {}, { companyId: 'agency-1' }));
  const result = locationPayload({ name: 'GMS' }, { settings: { timezone: 'America/Chicago' } }, { companyId: 'agency-1', snapshotId: 'snapshot-1' });
  assert.equal(result.snapshotId, 'snapshot-1');
  assert.equal(result.twilio, undefined);
  assert.equal(result.mailgun, undefined);
});
