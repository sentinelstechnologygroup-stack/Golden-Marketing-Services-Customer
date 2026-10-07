const test = require('node:test');
const assert = require('node:assert/strict');
const { verifiedContact } = require('../gohighlevel-contact-policy.cjs');

test('contact linkage requires matching location and verified lead identity', () => {
  const contact = { id: 'contact-one', locationId: 'location-one', email: 'Owner@Example.com', phone: '+1 (281) 555-0100' };
  assert.deepEqual(verifiedContact(contact, { email: 'owner@example.com' }, 'location-one', 'contact-one'), { contactId: 'contact-one', locationId: 'location-one' });
  assert.equal(verifiedContact(contact, { phone: '+12815550100' }, 'location-one', 'contact-one').phone,'+12815550100');
  for (const lead of [{}, { email: 'other@example.com' }, { phone: '0100' }]) {
    assert.throws(() => verifiedContact(contact, lead, 'location-one', 'contact-one'), /identity/);
  }
  assert.throws(() => verifiedContact(contact, { email: contact.email }, 'other-location', 'contact-one'), /location/);
  assert.throws(() => verifiedContact(contact, { email: contact.email }, 'location-one', 'other-contact'), /location/);
});
