const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'gms-prod-1089114348316';
const tenantId = process.env.CLIENT_USER_TENANT_ID || 'tenant-golden-cross-beta';
const brandId = process.env.CLIENT_USER_BRAND_ID || 'brand-golden-cross-realty';
const email = String(process.env.CLIENT_USER_EMAIL || '').trim().toLowerCase();
const password = String(process.env.CLIENT_USER_PASSWORD || '');
const displayName = String(process.env.CLIENT_USER_NAME || 'Golden Cross Client User').trim();

if (process.env.CONFIRM_CLIENT_USER !== 'yes') {
  throw new Error('Set CONFIRM_CLIENT_USER=yes to provision a production Client user.');
}
if (!email || !email.includes('@')) throw new Error('CLIENT_USER_EMAIL is required.');
if (password.length < 16) throw new Error('CLIENT_USER_PASSWORD must contain at least 16 characters.');

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });

async function main() {
  const auth = getAuth();
  const db = getFirestore();
  const tenantRef = db.collection('tenants').doc(tenantId);
  const brandRef = tenantRef.collection('brands').doc(brandId);
  const [tenant, brand] = await Promise.all([tenantRef.get(), brandRef.get()]);
  if (!tenant.exists) throw new Error(`Tenant ${tenantId} does not exist.`);
  if (!brand.exists) throw new Error(`Brand ${brandId} does not exist inside ${tenantId}.`);

  let user;
  let created = false;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password, displayName, emailVerified: false, disabled: false });
    created = true;
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.doc(`users/${user.uid}`), {
    uid: user.uid,
    email,
    displayName,
    title: 'Client User',
    status: 'active',
    updatedAt: now,
    ...(created ? { createdAt: now } : {}),
  }, { merge: true });
  batch.set(tenantRef.collection('members').doc(user.uid), {
    uid: user.uid,
    tenantId,
    email,
    role: 'client',
    active: true,
    brandIds: [brandId],
    invitedBy: 'gms-super-admin-provisioning',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(tenantRef.collection('auditLogs').doc(), {
    tenantId,
    brandId,
    actorUid: 'gms-super-admin-provisioning',
    action: created ? 'client.provisioned' : 'client.membership_refreshed',
    target: user.uid,
    metadata: { role: 'client' },
    occurredAt: now,
    createdAt: now,
  });
  await batch.commit();

  console.log(JSON.stringify({ created, uid: user.uid, email, role: 'client', tenantId, brandId }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
