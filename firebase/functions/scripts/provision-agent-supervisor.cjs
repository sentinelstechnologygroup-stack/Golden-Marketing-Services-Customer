const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'gms-prod-1089114348316';
const tenantId = process.env.AGENT_SUPERVISOR_TENANT_ID || 'tenant-golden-cross-beta';
const brandId = process.env.AGENT_SUPERVISOR_BRAND_ID || 'brand-golden-cross-realty';
const email = String(process.env.AGENT_SUPERVISOR_EMAIL || '').trim().toLowerCase();
const password = String(process.env.AGENT_SUPERVISOR_PASSWORD || '');
const displayName = String(process.env.AGENT_SUPERVISOR_NAME || 'Golden Cross Agent Supervisor').trim();

if (process.env.CONFIRM_AGENT_SUPERVISOR !== 'yes') {
  throw new Error('Set CONFIRM_AGENT_SUPERVISOR=yes to provision a production Agent Supervisor.');
}
if (!email || !email.includes('@')) throw new Error('AGENT_SUPERVISOR_EMAIL is required.');
if (password.length < 16) throw new Error('AGENT_SUPERVISOR_PASSWORD must contain at least 16 characters.');

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

  const assignmentId = `${user.uid}__${tenantId}`;
  const now = FieldValue.serverTimestamp();
  const assignment = {
    assignmentId,
    agentUid: user.uid,
    tenantId,
    tenantName: tenant.data().name || tenantId,
    industry: tenant.data().industry || tenant.data().vertical || 'general',
    brandId,
    brandIds: [brandId],
    campaignIds: [],
    sourceIds: [],
    scope: 'assigned',
    permissions: ['queue.manage', 'lead.assign', 'report.view'],
    role: 'supervisor',
    status: 'active',
    assignedBy: 'gms-super-admin-provisioning',
    createdAt: now,
    updatedAt: now,
  };
  const batch = db.batch();
  batch.set(db.doc(`users/${user.uid}`), {
    uid: user.uid,
    email,
    displayName,
    title: 'Agent Supervisor',
    status: 'active',
    updatedAt: now,
    ...(created ? { createdAt: now } : {}),
  }, { merge: true });
  batch.set(db.doc(`agentUsers/${user.uid}`), {
    uid: user.uid,
    email,
    displayName,
    role: 'supervisor',
    status: 'active',
    updatedAt: now,
    ...(created ? { createdAt: now } : {}),
  }, { merge: true });
  batch.set(db.doc(`agentAssignments/${assignmentId}`), assignment, { merge: true });
  batch.set(db.doc(`agentUsers/${user.uid}/assignments/${tenantId}`), assignment, { merge: true });
  batch.set(tenantRef.collection('auditLogs').doc(), {
    tenantId,
    brandId,
    actorUid: 'gms-super-admin-provisioning',
    action: created ? 'agent_supervisor.provisioned' : 'agent_supervisor.refreshed',
    target: user.uid,
    metadata: { role: 'supervisor' },
    occurredAt: now,
    createdAt: now,
  });
  await batch.commit();

  console.log(JSON.stringify({ created, uid: user.uid, email, role: 'supervisor', tenantId, brandId }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
