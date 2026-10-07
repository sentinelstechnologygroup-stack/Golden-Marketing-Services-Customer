const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { mergeProfile } = require('./gohighlevel-profile-policy.cjs');
const { isDeepStrictEqual } = require('node:util');
async function syncProfile(tenantId, settings, actorUid) {
  const db = getFirestore();
  const root = db.doc(`tenants/${tenantId}`), ref = root.collection('config').doc('onboarding');
  const [tenant, draft] = await Promise.all([root.get(), ref.get()]);
  const saved = draft.data(), locationId = saved?.data?.locationId;
  if (!tenant.exists || tenant.data().demo || tenant.data().environment !== 'production' || !locationId) return { status: 'not_linked' };
  const connection=(await db.doc(`gmsProviderConnections/${tenantId}`).get()).data();
  const token = connection?.locationId===locationId && connection.oauthSecretId
    ? await require('./gohighlevel-oauth-store.cjs').locationToken(locationId)
    : settings.locationTokens?.[locationId];
  if (!token) return { status: 'authorization_required' };
  const owner = await db.doc(`ghlLocationTenants/${locationId}`).get();
  if (owner.data()?.tenantId !== tenantId) throw new Error('Location ownership mismatch.');
  const response = await fetch(`https://services.leadconnectorhq.com/locations/${encodeURIComponent(locationId)}`, {
    redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${token}`, Version: 'v3', Accept: 'application/json', 'User-Agent': 'GMS-CRM/1.0' },
  });
  if (!response.ok) throw new Error(`GoHighLevel profile request failed (${response.status}).`);
  const payload = await response.json(), location = payload.location;
  if (settings.companyId && location?.companyId !== settings.companyId) throw new Error('GoHighLevel agency mismatch.');
  const data = mergeProfile(saved.data, location, locationId);
  const changed = !isDeepStrictEqual(data, saved.data);
  await db.runTransaction(async tx => {
    const [fresh, mapped, freshTenant] = await Promise.all([tx.get(ref), tx.get(db.doc(`ghlLocationTenants/${locationId}`)), tx.get(root)]);
    if (fresh.data()?.revision !== saved.revision || fresh.data()?.data?.locationId !== locationId || mapped.data()?.tenantId !== tenantId
        || freshTenant.data()?.demo || freshTenant.data()?.environment !== 'production') throw new Error('Client changed during sync. Reload and retry.');
    const now = FieldValue.serverTimestamp();
    tx.set(ref, { ...(changed ? { data, revision: saved.revision + 1 } : {}), profileSync: { source: 'GoHighLevel', locationId, status: 'synced', syncedAtMs: Date.now() } }, { merge: true });
    if (changed) {
      tx.set(root, { name: data.name, legalName: data.legalName, updatedAt: now }, { merge: true });
      tx.set(root.collection('organizations').doc('default'), { name: data.name, legalName: data.legalName, settings: { timezone: data.timezone, domain: data.domain }, updatedAt: now }, { merge: true });
      tx.set(root.collection('auditLogs').doc(), { tenantId, actorUid, action: 'gohighlevel.profile.synced', target: locationId, occurredAt: now });
    }
  });
  return { status: 'synced', changed };
}
module.exports = { syncProfile };
