const crypto = require('node:crypto');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const policy = require('./staff-policy.cjs');
const db = getFirestore(), key = defineSecret('TELNYX_API_KEY');
const options = { enforceAppCheck: false, maxInstances: 2, timeoutSeconds: 60 };
exports.getGmsAgentTeam = onCall(options, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const user = await getAuth().getUser(request.auth.uid), tenantId = request.data?.tenantId;
  if (user.disabled || !/^[A-Za-z0-9_-]{1,128}$/.test(tenantId || '')) throw new HttpsError('permission-denied', 'Account access unavailable.');
  const global = user.customClaims?.gmsSuperAdmin === true || user.customClaims?.platformAdmin === true;
  const supervisor = (await db.doc(`agentUsers/${user.uid}/assignments/${tenantId}`).get()).data();
  if (!global && (supervisor?.status !== 'active' || supervisor.role !== 'supervisor')) throw new HttpsError('permission-denied', 'Supervisor access required.');
  const rows = await db.collection('agentAssignments').where('tenantId','==',tenantId).limit(200).get();
  const ids = [...new Set(rows.docs.map(doc => doc.data().agentUid).filter(Boolean))];
  const team = await Promise.all(ids.map(async uid => {
    const [root, assigned] = await Promise.all([db.doc(`agentUsers/${uid}`).get(),db.doc(`agentUsers/${uid}/assignments/${tenantId}`).get()]);
    const assignment = assigned.data(), profile = root.data();
    if (!profile || assignment?.status !== 'active') return null;
    const brands = assignment.brandIds || (assignment.brandId ? [assignment.brandId] : []);
    const permitted = supervisor?.brandIds || (supervisor?.brandId ? [supervisor.brandId] : []);
    if (!global && (!permitted.length || !brands.some(id => permitted.includes(id)))) return null;
    return { id:uid, full_name:profile.displayName || profile.email || 'Agent', role:assignment.role, agent_status:assignment.agentStatus || 'offline', presenceUpdatedAt:assignment.presenceUpdatedAt?.toDate?.().toISOString() || null };
  }));
  return { rows:team.filter(Boolean) };
});
async function admin(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const user = await getAuth().getUser(request.auth.uid);
  if (user.disabled || user.customClaims?.mustChangePassword || !(user.customClaims?.gmsSuperAdmin === true || user.customClaims?.platformAdmin === true)) throw new HttpsError('permission-denied', 'Super admin access is required to manage staff.');
  return user.uid;
}
async function audit(actorUid, tenantId, action, uid) {
  await db.collection(`tenants/${tenantId}/auditLogs`).add({ tenantId, actorUid, action, target: uid, occurredAt: FieldValue.serverTimestamp() });
}
exports.getGmsStaff = onCall(options, async request => {
  await admin(request);
  const rows = await db.collection('agentUsers').limit(200).get();
  return { presets: policy.PRESETS, rows: await Promise.all(rows.docs.map(async doc => {
    const user = doc.data(), assignments = await doc.ref.collection('assignments').get();
    return { uid: doc.id, name: user.displayName || '', email: user.email || '', role: user.role || '', status: user.status || '', assignments: assignments.docs.map(item => ({ tenantId: item.id, tenantName: item.data().tenantName || item.id, role: item.data().role, status: item.data().status, brandIds: item.data().brandIds || [], phoneReady: Boolean(item.data().telnyxCredentialId) })) };
  })) };
});
exports.createGmsStaff = onCall(options, async request => {
  const actorUid = await admin(request);
  let data;
  try { data = policy.input(request.data); } catch (error) { throw new HttpsError('invalid-argument', error.message); }
  const tenant = await db.doc(`tenants/${data.tenantId}`).get();
  if (!tenant.exists || tenant.data().status === 'disabled') throw new HttpsError('failed-precondition', 'Choose an active client.');
  for (const id of data.brandIds) if (!(await db.doc(`tenants/${data.tenantId}/brands/${id}`).get()).exists) throw new HttpsError('invalid-argument', 'Brand does not belong to this client.');
  const uid = 'gmsstaff_' + crypto.createHash('sha256').update(data.email).digest('hex').slice(0, 28);
  const auth = getAuth();
  let existing;
  try { existing = await auth.getUserByEmail(data.email); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  if (existing) throw new HttpsError('already-exists', 'This email already has a login. No existing account or role was changed.');
  // The new identity remains disabled until all permissions and assignments are saved.
  await auth.createUser({ uid, email: data.email, displayName: data.name, disabled: true, password: crypto.randomBytes(32).toString('base64url') });
  const now = FieldValue.serverTimestamp();
  const assignment = { agentUid: uid, tenantId: data.tenantId, tenantName: tenant.data().name || data.tenantId, industry: tenant.data().industry || 'real_estate', brandIds: data.brandIds, brandId: data.brandIds.length === 1 ? data.brandIds[0] : null, role: data.role, permissions: data.permissions, scope: 'assigned', status: 'active', assignedBy: actorUid, createdAt: now, updatedAt: now };
  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), { uid, email: data.email, displayName: data.name, status: 'active', createdAt: now });
  batch.set(db.doc(`agentUsers/${uid}`), { uid, email: data.email, displayName: data.name, role: data.role, status: 'active', managedBy: 'gms_staff', createdAt: now });
  batch.set(db.doc(`agentUsers/${uid}/assignments/${data.tenantId}`), assignment);
  batch.set(db.doc(`agentAssignments/${uid}__${data.tenantId}`), { ...assignment, assignmentId: `${uid}__${data.tenantId}` });
  await batch.commit();
  await auth.setCustomUserClaims(uid, { role: data.role, gmsSuperAdmin: data.role === 'gms_super_admin' });
  await auth.updateUser(uid, { disabled: false });
  await audit(actorUid, data.tenantId, 'staff.created', uid);
  const setupLink = await auth.generatePasswordResetLink(data.email, { url: 'https://agentcrm.goldenmarketingservices.com/login', handleCodeInApp: false });
  return { uid, email: data.email, role: data.role, setupLink, delivery: 'not_sent', phoneReady: false };
});
exports.getGmsStaffSetupLink = onCall(options, async request => {
  const actorUid = await admin(request), uid = String(request.data?.uid || '');
  if (!/^gmsstaff_[a-f0-9]{28}$/.test(uid)) throw new HttpsError('invalid-argument', 'Choose a staff account created here.');
  const user = await getAuth().getUser(uid), record = await db.doc(`agentUsers/${uid}`).get();
  if (user.disabled || record.data()?.managedBy !== 'gms_staff') throw new HttpsError('failed-precondition', 'Staff access is unavailable.');
  await audit(actorUid, request.data.tenantId, 'staff.setup_link.created', uid);
  return { setupLink: await getAuth().generatePasswordResetLink(user.email, { url: 'https://agentcrm.goldenmarketingservices.com/login', handleCodeInApp: false }), delivery: 'not_sent' };
});
exports.provisionGmsStaffPhone = onCall({ ...options, secrets: [key] }, async request => {
  const actorUid = await admin(request), { uid, tenantId } = request.data || {};
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(tenantId || '')) throw new HttpsError('invalid-argument', 'Choose an agent and client.');
  const ref = db.doc(`agentUsers/${uid}/assignments/${tenantId}`);
  await db.runTransaction(async tx => {
    const assignment = (await tx.get(ref)).data();
    if (!assignment || assignment.status !== 'active' || !['agent','supervisor','gms_super_admin'].includes(assignment.role)) throw new HttpsError('permission-denied', 'This role cannot place calls.');
    if (assignment.telnyxCredentialId) throw new HttpsError('already-exists', 'Agent phone is already configured.');
    if (assignment.phoneProvisioningStatus) throw new HttpsError('failed-precondition', 'Phone setup requires administrator reconciliation before retrying.');
    tx.update(ref, { phoneProvisioningStatus: 'in_progress' });
  });
  const token = key.value(), headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const connectionId = process.env.TELNYX_BROWSER_CONNECTION_ID;
  try {
    const response = await fetch('https://api.telnyx.com/v2/credential_connections/' + encodeURIComponent(connectionId), { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
    const connection = response.ok ? (await response.json()).data : null;
    if (!connection?.active || connection.outbound?.outbound_voice_profile_id) throw new Error();
    const created = await fetch('https://api.telnyx.com/v2/telephony_credentials', { method: 'POST', headers, body: JSON.stringify({ connection_id: connectionId, name: `GMS ${uid}` }), signal: AbortSignal.timeout(15000), redirect: 'error' });
    const credential = created.ok ? (await created.json()).data : null;
    if (!credential?.id || require('./telephony/credential-identity.cjs').connectionId(credential) !== connectionId) throw new Error();
    await ref.update({ telnyxCredentialId: credential.id, phoneProvisioningStatus: 'configured', updatedAt: FieldValue.serverTimestamp() });
    await audit(actorUid, tenantId, 'staff.phone.configured', uid);
    return { ok: true, phoneReady: true, callingGatesUnchanged: true };
  } catch {
    await ref.update({ phoneProvisioningStatus: 'attention_required' });
    throw new HttpsError('failed-precondition', 'Phone setup could not be confirmed. Calling permissions have not been expanded.');
  }
});
