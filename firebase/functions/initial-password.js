const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { validateInitialPassword } = require('./initial-password-policy.cjs');

// Initial accounts have no memberships or admin privileges until this completes.
exports.completeInitialPasswordChange = onCall({ enforceAppCheck: false, maxInstances: 2 }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Please sign in again.');
  const auth = getAuth();
  const db = getFirestore();
  const user = await auth.getUser(request.auth.uid);
  if (user.customClaims?.initialAdminSetup !== true || user.customClaims?.mustChangePassword !== true) {
    throw new HttpsError('permission-denied', 'This account is not awaiting initial administrator setup.');
  }
  const authTime = Number(request.auth.token.auth_time || 0);
  if (Date.now() / 1000 - authTime > 300) throw new HttpsError('unauthenticated', 'For security, sign out and sign in again before changing your password.');
  const password = request.data?.newPassword;
  if (!validateInitialPassword(password)) throw new HttpsError('invalid-argument', 'Use 12–128 characters with uppercase, lowercase, a number, and a symbol.');
  const tenants = await db.collection('tenants').get();
  if (tenants.empty || tenants.size > 120) throw new HttpsError('failed-precondition', 'Administrator tenant assignment needs review.');
  // Firebase Auth owns the password; it is never saved in Firestore or logs.
  await auth.updateUser(user.uid, { password });
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.doc(`users/${user.uid}`), { title: 'GMS Super Admin', status: 'active', mustChangePassword: false, passwordChangedAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`agentUsers/${user.uid}`), { uid: user.uid, email: user.email, displayName: user.displayName, role: 'super_admin', status: 'active', updatedAt: now }, { merge: true });
  for (const tenant of tenants.docs) {
    const assignmentId = `${user.uid}__${tenant.id}`;
    const assignment = { assignmentId, agentUid: user.uid, tenantId: tenant.id, tenantName: tenant.data().name || tenant.id, role: 'admin', scope: 'all', brandId: null, brandIds: [], campaignIds: [], sourceIds: [], permissions: ['*'], status: 'active', assignedBy: 'gms-admin-bootstrap', createdAt: now, updatedAt: now };
    batch.set(db.doc(`tenants/${tenant.id}/members/${user.uid}`), { uid: user.uid, tenantId: tenant.id, tenantName: assignment.tenantName, email: user.email, displayName: user.displayName, role: 'gms_super_admin', active: true, brandIds: [], createdAt: now, updatedAt: now }, { merge: true });
    batch.set(db.doc(`agentAssignments/${assignmentId}`), assignment, { merge: true });
    batch.set(db.doc(`agentUsers/${user.uid}/assignments/${tenant.id}`), assignment, { merge: true });
    batch.set(db.collection(`tenants/${tenant.id}/auditLogs`).doc(), { tenantId: tenant.id, actorUid: user.uid, action: 'gms_super_admin.initial_setup.completed', target: user.uid, createdAt: now, occurredAt: now });
  }
  await batch.commit();
  const claims = { ...user.customClaims, gmsSuperAdmin: true, platformAdmin: true, mustChangePassword: false };
  delete claims.initialAdminSetup;
  await auth.setCustomUserClaims(user.uid, claims);
  await auth.revokeRefreshTokens(user.uid);
  return { ok: true, signInAgain: true };
});
