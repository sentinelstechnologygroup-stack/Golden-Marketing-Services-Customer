const test = require('node:test');
const assert = require('node:assert/strict');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator required.');
const { initializeApp, getApps } = require('firebase-admin/app');
if (!getApps().length) initializeApp({ projectId: 'demo-gms-local' });
const { getFirestore } = require('firebase-admin/firestore');
const { syncProfile } = require('../gohighlevel-profile-sync.cjs');
const { normalize } = require('../client-onboarding-policy.cjs');
test('refresh is idempotent, protects identity and rejects changed location ownership', async () => {
  const db = getFirestore(), tenantId = 'sync-test-' + Date.now(), locationId = 'loc-' + Date.now();
  const root = db.doc(`tenants/${tenantId}`), ref = root.collection('config').doc('onboarding');
  await root.set({ environment: 'production', demo: false });
  await ref.set({ revision: 1, data: normalize({ name: 'Original', legalName: 'Saved legal name', adminEmail: 'admin@example.test', locationId, phoneNumber: '+19362499427', campaigns: [] }) });
  const owner = db.doc(`ghlLocationTenants/${locationId}`); await owner.set({ tenantId });
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ location: { id: locationId, name: 'GCR', website: 'example.test', email: 'office@example.test', business: { name: 'Friendly' } } }) });
  const settings = { locationTokens: { [locationId]: 'test-only' } };
  try {
    assert.equal((await syncProfile(tenantId, settings, 'admin')).changed, true);
    assert.equal((await syncProfile(tenantId, settings, 'admin')).changed, false);
    const saved = (await ref.get()).data();
    assert.equal(saved.revision, 2); assert.equal(saved.data.adminEmail, 'admin@example.test');
    assert.equal(saved.data.legalName, 'Saved legal name'); assert.equal(saved.data.phoneNumber, '+19362499427');
    global.fetch = async () => { await owner.set({ tenantId: 'different' }); return { ok: true, json: async () => ({ location: { id: locationId, name: 'Bad update' } }) }; };
    await assert.rejects(syncProfile(tenantId, settings, 'admin'), /changed/);
    assert.equal((await ref.get()).data().data.name, 'GCR');
  } finally { global.fetch = originalFetch; await db.recursiveDelete(root); await owner.delete(); }
});
