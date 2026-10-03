const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'gms-prod-1089114348316';
const email = String(process.env.GMS_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.GMS_SUPER_ADMIN_PASSWORD || '');
const displayName = String(process.env.GMS_SUPER_ADMIN_NAME || 'GMS Super Admin').trim();

if (process.env.CONFIRM_GMS_SUPER_ADMIN !== 'yes') {
  throw new Error('Set CONFIRM_GMS_SUPER_ADMIN=yes to provision a production GMS Super Admin.');
}
if (!email || !email.includes('@')) throw new Error('GMS_SUPER_ADMIN_EMAIL is required.');
if (password.length < 16) throw new Error('GMS_SUPER_ADMIN_PASSWORD must contain at least 16 characters.');

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });

async function main() {
  const auth = getAuth();
  const db = getFirestore();
  let user;
  let created = false;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password, displayName, emailVerified: false, disabled: false });
    created = true;
  }

  const tenants = await db.collection('tenants').get();
  if (tenants.empty) throw new Error('No production tenants are available for administrative assignment.');
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.doc(`users/${user.uid}`), {
    uid: user.uid,
    email,
    displayName,
    title: 'GMS Super Admin',
    status: 'active',
    updatedAt: now,
    ...(created ? { createdAt: now } : {}),
  }, { merge: true });
  batch.set(db.doc(`agentUsers/${user.uid}`), {
    uid: user.uid,
    email,
    displayName,
    role: 'super_admin',
    status: 'active',
    updatedAt: now,
    ...(created ? { createdAt: now } : {}),
  }, { merge: true });

  for (const tenantDocument of tenants.docs) {
    const tenant = tenantDocument.data();
    const tenantId = tenantDocument.id;
    const assignmentId = `${user.uid}__${tenantId}`;
    const assignment = {
      assignmentId,
      agentUid: user.uid,
      tenantId,
      tenantName: tenant.name || tenantId,
      industry: tenant.industry || tenant.vertical || 'general',
      brandId: null,
      brandIds: [],
      campaignIds: [],
      sourceIds: [],
      scope: 'all',
      permissions: ['*'],
      role: 'admin',
      status: 'active',
      assignedBy: 'gms-super-admin-provisioning',
      createdAt: now,
      updatedAt: now,
    };
    batch.set(db.doc(`agentAssignments/${assignmentId}`), assignment, { merge: true });
    batch.set(db.doc(`agentUsers/${user.uid}/assignments/${tenantId}`), assignment, { merge: true });
    batch.set(db.collection(`tenants/${tenantId}/auditLogs`).doc(), {
      tenantId,
      actorUid: 'gms-super-admin-provisioning',
      action: created ? 'gms_super_admin.assignment.provisioned' : 'gms_super_admin.assignment.refreshed',
      target: user.uid,
      metadata: { role: 'gms_super_admin' },
      occurredAt: now,
      createdAt: now,
    });
  }
  batch.set(db.collection('auditLogs').doc(), {
    actorUid: 'gms-super-admin-provisioning',
    action: created ? 'gms_super_admin.provisioned' : 'gms_super_admin.refreshed',
    targetUid: user.uid,
    tenantCount: tenants.size,
    createdAt: now,
  });
  await batch.commit();

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    gmsSuperAdmin: true,
    platformAdmin: true,
  });
  await auth.revokeRefreshTokens(user.uid);

  console.log(JSON.stringify({ created, uid: user.uid, email, role: 'gms_super_admin', tenantCount: tenants.size }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
