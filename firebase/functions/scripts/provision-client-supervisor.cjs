const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'gms-prod-1089114348316';
const tenantId = process.env.CLIENT_SUPERVISOR_TENANT_ID || 'tenant-golden-cross-beta';
const brandId = process.env.CLIENT_SUPERVISOR_BRAND_ID || 'brand-golden-cross-realty';
const email = String(process.env.CLIENT_SUPERVISOR_EMAIL || '').trim().toLowerCase();
const password = String(process.env.CLIENT_SUPERVISOR_PASSWORD || '');
const displayName = String(process.env.CLIENT_SUPERVISOR_NAME || 'Golden Cross Client Supervisor').trim();

if (process.env.CONFIRM_CLIENT_SUPERVISOR !== 'yes') {
  throw new Error('Set CONFIRM_CLIENT_SUPERVISOR=yes to provision a production Client Supervisor.');
}
if (!email || !email.includes('@')) throw new Error('CLIENT_SUPERVISOR_EMAIL is required.');
if (password.length < 12) throw new Error('CLIENT_SUPERVISOR_PASSWORD must contain at least 12 characters.');

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
  const memberRef = tenantRef.collection('members').doc(user.uid);
  const profileRef = db.collection('users').doc(user.uid);
  const auditRef = tenantRef.collection('auditLogs').doc();
  const batch = db.batch();
  batch.set(memberRef, {
    uid: user.uid,
    tenantId,
    role: 'client_supervisor',
    active: true,
    brandIds: [brandId],
    email,
    invitedBy: 'gms-super-admin-provisioning',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(profileRef, {
    uid: user.uid,
    email,
    displayName,
    status: 'active',
    updatedAt: now,
    ...(created ? { createdAt: now } : {}),
  }, { merge: true });
  batch.set(auditRef, {
    tenantId,
    brandId,
    actorUid: 'gms-super-admin-provisioning',
    action: created ? 'client_supervisor.provisioned' : 'client_supervisor.membership_refreshed',
    targetUid: user.uid,
    role: 'client_supervisor',
    createdAt: now,
  });
  await batch.commit();

  console.log(JSON.stringify({ created, uid: user.uid, email, tenantId, brandId, role: 'client_supervisor' }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
