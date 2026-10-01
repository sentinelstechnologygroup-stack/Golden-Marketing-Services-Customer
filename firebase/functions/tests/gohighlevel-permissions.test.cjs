const test = require('node:test');
const assert = require('node:assert/strict');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Local emulators required.');
process.env.GMS_GOHIGHLEVEL_CONFIG = JSON.stringify({ companyId: 'agency-test', agencyToken: 'emulator-only', locationTokens: { 'location-test': 'emulator-only' } });
const functions = require('../index');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const auth = getAuth(); const db = getFirestore();
const prefix = `ghl-${Date.now()}`;
const tenantId = `${prefix}-tenant`;
const call = (uid, data, token = {}) => ({ auth: { uid, token }, data });

test('fresh roles, tenant isolation, canonical ownership and provider response filtering', async () => {
  const ids = {};
  for (const role of ['admin', 'agent', 'scoped', 'customer', 'outsider', 'disabled', 'password', 'revoked']) {
    ids[role] = `${prefix}-${role}`;
    await auth.createUser({ uid: ids[role], disabled: role === 'disabled' });
  }
  await auth.setCustomUserClaims(ids.admin, { lmsSuperAdmin: true });
  await auth.setCustomUserClaims(ids.password, { lmsSuperAdmin: true, mustChangePassword: true });
  const data = { locationId: 'location-test', phoneNumber: '', phoneSid: '' };
  await db.doc(`tenants/${tenantId}`).set({ environment: 'production', demo: false });
  await db.doc(`tenants/${tenantId}/config/onboarding`).set({ data, revision: 1 });
  await db.doc('ghlLocationTenants/location-test').set({ tenantId });
  await db.doc(`agentUsers/${ids.agent}/assignments/${tenantId}`).set({ status: 'active', role: 'agent', brandIds: ['brand-one'] });
  await db.doc(`tenants/${tenantId}/members/${ids.scoped}`).set({ active: true, role: 'client_supervisor', brandId: 'brand-one' });
  await db.doc(`tenants/${tenantId}/members/${ids.customer}`).set({ active: true, role: 'client_admin' });
  const previousFetch = global.fetch; let requests = 0; let wrongLocation = false; let alterSettings = false;
  global.fetch = async url => {
    requests++;
    const path = new URL(url).pathname;
    if (path.startsWith('/locations/')) return { ok: true, json: async () => ({ location: { id: 'location-test', companyId: 'agency-test' } }) };
    if (alterSettings) await db.doc(`tenants/${tenantId}/config/onboarding`).update({ revision: 2 });
    const key = path.includes('conversations') ? 'conversations' : path.includes('calendars') ? 'calendars' : 'opportunities';
    return { ok: true, json: async () => ({ [key]: [{ id: 'record-one', contactId: 'contact-one', locationId: wrongLocation ? 'another-location' : 'location-test', name: 'Emulator only', token: 'never-return' }] }) };
  };
  try {
    await assert.rejects(functions.readGoHighLevelResource.run({ data: { tenantId } }), { code: 'unauthenticated' });
    for (const role of ['agent', 'scoped', 'outsider', 'disabled', 'password', 'revoked']) {
      await assert.rejects(functions.readGoHighLevelResource.run(call(ids[role], { tenantId, resource: 'calendars' }, { lmsSuperAdmin: true })), { code: 'permission-denied' });
    }
    assert.equal(requests, 0, 'unauthorized callers must never reach provider');
    await assert.rejects(functions.connectExistingGoHighLevelLocation.run(call(ids.customer, { tenantId, locationId: 'location-test' })), { code: 'permission-denied' });
    await functions.connectExistingGoHighLevelLocation.run(call(ids.admin, { tenantId, locationId: 'location-test' }));
    const verified = await functions.verifyGoHighLevelConnection.run(call(ids.admin, { tenantId }));
    assert.equal(verified.status, 'connected');
    const readiness = (await db.doc(`tenants/${tenantId}/integrations/readiness`).get()).data();
    assert.equal(readiness.ghlVerified, true); assert.equal(readiness.phoneVerified, false);
    const result = await functions.readGoHighLevelResource.run(call(ids.customer, { tenantId, resource: 'calendars', locationId: 'attacker' }));
    assert.deepEqual(result.items, [{ id: 'record-one', name: 'Emulator only' }]);
    await db.doc(`tenants/${tenantId}/leads/lead-one`).set({ brandId: 'brand-one', assignedTo: ids.agent });
    await assert.rejects(functions.readGoHighLevelResource.run(call(ids.agent, { tenantId, resource: 'conversations', leadId: 'lead-one' })), { code: 'failed-precondition' });
    await db.doc(`gmsProviderContacts/${tenantId}/leads/lead-one`).set({ locationId: 'location-test', contactId: 'contact-one' });
    const agentResult = await functions.readGoHighLevelResource.run(call(ids.agent, { tenantId, resource: 'conversations', leadId: 'lead-one', contactId: 'attacker' }));
    assert.equal(agentResult.items[0].contactId, 'contact-one');
    await db.doc(`tenants/${tenantId}/leads/lead-one`).update({ assignedTo: ids.outsider });
    await assert.rejects(functions.readGoHighLevelResource.run(call(ids.agent, { tenantId, resource: 'conversations', leadId: 'lead-one' })), { code: 'permission-denied' });
    await db.doc(`tenants/${tenantId}/leads/lead-one`).update({ assignedTo: ids.agent, brandId: 'another-brand' });
    await assert.rejects(functions.readGoHighLevelResource.run(call(ids.agent, { tenantId, resource: 'conversations', leadId: 'lead-one' })), { code: 'permission-denied' });
    await assert.rejects(functions.readGoHighLevelResource.run(call(ids.customer, { tenantId: `${tenantId}-other`, resource: 'calendars' })), { code: 'permission-denied' });
    wrongLocation = true;
    await assert.rejects(functions.readGoHighLevelResource.run(call(ids.admin, { tenantId, resource: 'calendars' })), { code: 'data-loss' });
    wrongLocation = false; alterSettings = true;
    await assert.rejects(functions.verifyGoHighLevelConnection.run(call(ids.admin, { tenantId })), { code: 'aborted' });
    alterSettings = false;
    await db.doc('ghlLocationTenants/location-test').set({ tenantId: 'other-tenant' });
    await assert.rejects(functions.readGoHighLevelResource.run(call(ids.admin, { tenantId, resource: 'calendars' })), { code: 'permission-denied' });
  } finally { global.fetch = previousFetch; }
});
