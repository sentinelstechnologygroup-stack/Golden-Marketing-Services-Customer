const crypto = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { HttpsError, onCall, onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require("firebase-functions/v2");

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();
const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID');
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN');
const ROLE_ALIASES = new Map([
  ['customer', 'client'],
  ['admin', 'client_admin'],
  ['supervisor', 'client_supervisor'],
  ['super_admin', 'lms_super_admin'],
]);
const ROLES = new Set(['client', 'client_admin', 'client_supervisor', 'lms_super_admin', 'agent', 'auditor', ...ROLE_ALIASES.keys()]);
const CLIENT_INVITE_ROLES = new Set(['client', 'client_admin', 'client_supervisor']);
const TENANT_ADMIN_ROLES = ['client_admin', 'client_supervisor', 'lms_super_admin'];

function normalizeRole(role) {
  return ROLE_ALIASES.get(role) || role;
}

function roleAllowed(role, roles) {
  return !roles || roles.map(normalizeRole).includes(normalizeRole(role));
}
const AGENT_COLLECTIONS = new Set([
  'organizations', 'brands', 'campaigns', 'leadSources', 'leads', 'followUpTasks',
  'communicationAlerts', 'callRecords', 'callTranscripts', 'callQualityReviews',
  'appointments', 'businessOwners', 'scripts', 'qualificationForms', 'routingRules',
  'phoneNumbers', 'reports', 'documents', 'invoices', 'notifications', 'customerActivity', 'auditLogs',
]);
const AGENT_WRITE_COLLECTIONS = new Set([
  'leads', 'followUpTasks', 'communicationAlerts', 'callRecords', 'callTranscripts',
  'callQualityReviews', 'appointments', 'businessOwners', 'reports',
]);
const BRAND_SCOPED_COLLECTIONS = new Set([
  'brands', 'campaigns', 'leadSources', 'leads', 'followUpTasks',
  'communicationAlerts', 'callRecords', 'callTranscripts', 'callQualityReviews',
  'appointments', 'businessOwners', 'scripts', 'qualificationForms',
  'routingRules', 'phoneNumbers', 'reports', 'documents', 'invoices',
  'notifications', 'customerActivity',
]);
const ADMIN_WRITE_COLLECTIONS = new Set([
  'organizations', 'brands', 'campaigns', 'leadSources', 'scripts',
  'qualificationForms', 'routingRules', 'phoneNumbers',
]);
const REQUIRED_FIELDS = {
  organizations: ['name', 'status', 'settings'],
  brands: ['name', 'status', 'domain'],
  campaigns: ['name', 'brandId', 'status', 'startDate', 'endDate'],
  leadSources: ['name', 'type', 'status'],
  leads: ['firstName', 'lastName', 'email', 'phone', 'status', 'sourceId', 'brandId', 'assignedTo'],
  followUpTasks: ['leadId', 'assignedTo', 'status', 'dueAt'],
  communicationAlerts: ['leadId', 'channel', 'status', 'sentAt'],
  callRecords: ['leadId', 'agentUid', 'status', 'startedAt', 'endedAt'],
  callTranscripts: ['callId', 'storagePath', 'status'],
  callQualityReviews: ['callId', 'reviewerUid', 'score', 'status'],
  appointments: ['leadId', 'title', 'scheduledStart', 'scheduledEnd', 'status', 'calendarProvider'],
  businessOwners: ['name'],
  scripts: ['name', 'status', 'body', 'version'],
  qualificationForms: ['name', 'status', 'fields', 'version'],
  routingRules: ['name', 'status', 'priority', 'conditions', 'destination'],
  phoneNumbers: ['phoneNumber', 'provider', 'status', 'assignedTo'],
  reports: ['name', 'type', 'periodStart', 'periodEnd', 'status', 'storagePath'],
};

const IMMUTABLE_TENANT_FIELDS = new Set([
  'tenantId', 'organization_id', 'industry', 'industryId', 'brandId', 'brand_id',
  'sourceId', 'source_id', 'campaignId', 'campaign_id', 'routingProfileId',
  'workflowVersion', 'scriptSetId', 'qualificationFormId', 'consentPolicyId',
  'retentionPolicyId', 'notificationProfileId', 'receivedAt', 'createdAt', 'createdBy',
]);
const INDUSTRY_POLICY_FIELDS = ['industryId', 'workflowVersion', 'scriptSetId', 'qualificationFormId', 'routingProfileId', 'consentPolicyId', 'retentionPolicyId'];

function writeRolesFor(collectionName) {
  if (ADMIN_WRITE_COLLECTIONS.has(collectionName)) return TENANT_ADMIN_ROLES;
  if (AGENT_WRITE_COLLECTIONS.has(collectionName)) return [...TENANT_ADMIN_ROLES, 'agent'];
  return [];
}

function twilioConfigured() {
  const sid = String(twilioAccountSid.value() || '').trim();
  const token = String(twilioAuthToken.value() || '').trim();
  return Boolean(sid && token && sid !== 'not-configured' && token !== 'not-configured');
}

async function twilioRequest(path, method = 'POST', params = {}) {
  if (!twilioConfigured()) throw new HttpsError('failed-precondition', 'Telephony is not configured.');
  const accountSid = twilioAccountSid.value();
  const authToken = twilioAuthToken.value();
  const body = new URLSearchParams(params);
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`, {
    method,
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpsError('internal', payload.message || 'Telephony provider request failed.');
  return payload;
}

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required.');
  return request.auth;
}

async function getMembership(tenantId, uid) {
  const snapshot = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  const membership = snapshot.exists ? snapshot.data() : null;
  return membership?.active === true ? { ...membership, role: normalizeRole(membership.role) } : null;
}

async function requireMembership(request, tenantId, roles = null) {
  const caller = requireAuth(request);
  if (typeof tenantId !== 'string' || !tenantId.trim()) throw new HttpsError('invalid-argument', 'A tenantId is required.');
  if (caller.token?.lmsSuperAdmin === true) return { caller, membership: { uid: caller.uid, tenantId, role: 'lms_super_admin', active: true } };
  const membership = await getMembership(tenantId, caller.uid);
  if (!membership || !roleAllowed(membership.role, roles)) throw new HttpsError('permission-denied', 'You are not authorized for this tenant.');
  return { caller, membership };
}

async function requireAgentAssignment(request, tenantId, roles = ['agent', 'client_supervisor', 'client_admin', 'lms_super_admin']) {
  const caller = requireAuth(request);
  const membership = await getMembership(tenantId, caller.uid);
  if (caller.token?.lmsSuperAdmin === true) return { caller, membership: { uid: caller.uid, tenantId, role: 'lms_super_admin', active: true }, assignment: null };
  if (membership && TENANT_ADMIN_ROLES.includes(normalizeRole(membership.role)) && roleAllowed(membership.role, roles)) return { caller, membership, assignment: null };
  const assignment = await db.doc(`agentUsers/${caller.uid}/assignments/${tenantId}`).get();
  const data = assignment.exists ? assignment.data() : null;
  if (!data || data.status !== 'active' || !roleAllowed(data.role || 'agent', roles)) throw new HttpsError('permission-denied', 'An active agent assignment is required for this tenant.');
  return { caller, membership: data, assignment: data };
}

function scopedBrandIds(assignment) {
  if (!assignment) return null;
  const values = [
    assignment.brandId,
    ...(Array.isArray(assignment.brandIds) ? assignment.brandIds : []),
  ].filter((value) => typeof value === 'string' && value.trim());
  return values.length ? new Set(values) : null;
}

function recordBrandId(record) {
  return record?.brandId || record?.brand_id || null;
}

function assignmentAllowsBrand(assignment, brandId) {
  const allowed = scopedBrandIds(assignment);
  return !allowed || !brandId || allowed.has(brandId);
}

function normalizedPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function requireAssignmentBrand(assignment, brandId) {
  if (!assignmentAllowsBrand(assignment, brandId)) {
    throw new HttpsError('permission-denied', 'Your assignment does not include this Brand.');
  }
}

function applyAssignmentBrand(assignment, collectionName, value) {
  const input = objectInput(value);
  const allowed = scopedBrandIds(assignment);
  if (!allowed) return input;
  const supplied = recordBrandId(input);
  if (supplied) {
    requireAssignmentBrand(assignment, supplied);
    return input;
  }
  if (!BRAND_SCOPED_COLLECTIONS.has(collectionName)) return input;
  if (allowed.size !== 1) throw new HttpsError('invalid-argument', 'A Brand is required for this record.');
  const [brandId] = allowed;
  return { ...input, brandId };
}

function stripImmutablePatch(data) {
  const patch = objectInput(data);
  for (const field of IMMUTABLE_TENANT_FIELDS) delete patch[field];
  return patch;
}

async function recordAudit({ tenantId, actorUid, action, target = null, metadata = {} }) {
  await db.collection(`tenants/${tenantId}/auditLogs`).add({
    tenantId, actorUid, action, target, metadata,
    occurredAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });
}

function objectInput(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function validateRequiredFields(collectionName, data) {
  const input = objectInput(data);
  const missing = (REQUIRED_FIELDS[collectionName] || []).filter((field) => input[field] === undefined || input[field] === null);
  if (missing.length) throw new HttpsError('invalid-argument', `Missing required fields: ${missing.join(', ')}`);
}

async function createTenantRecord({ request, tenantId, collectionName, data, roles, action, authorize = requireMembership, authorization = null }) {
  const { caller } = authorization || await authorize(request, tenantId, roles);
  const now = FieldValue.serverTimestamp();
  const record = { ...objectInput(data), tenantId, createdBy: caller.uid, createdAt: now, updatedAt: now };
  const ref = await db.collection(`tenants/${tenantId}/${collectionName}`).add(record);
  await recordAudit({ tenantId, actorUid: caller.uid, action, target: ref.id });
  return { id: ref.id, ...record, createdAt: undefined, updatedAt: undefined };
}

// Minimal non-sensitive diagnostic only. Business operations are intentionally
// absent until the shared API contract, authorization model, and tests are ready.
exports.health = onRequest({ cors: false }, (_request, response) => {
  response.status(200).json({ service: 'linkmarketing-backend', status: 'ok' });
});

// Firebase App Check is still being re-registered for the new GMS portal
// domains. Keep Firebase Auth plus the tenant/role checks authoritative while
// allowing the temporary review deployments to load their authenticated data.
exports.getMyProfile = onCall({ enforceAppCheck: false }, async (request) => {
  const caller = requireAuth(request);
  const user = await auth.getUser(caller.uid);
  const [profile, memberships, assignments] = await Promise.all([
    db.doc(`users/${caller.uid}`).get(),
    db.collectionGroup('members').where('uid', '==', caller.uid).where('active', '==', true).get(),
    db.collection(`agentUsers/${caller.uid}/assignments`).where('status', '==', 'active').get(),
  ]);
  const agentAssignments = await Promise.all(assignments.docs.map(async (assignmentDoc) => {
    const assignment = assignmentDoc.data();
    const tenant = await db.doc(`tenants/${assignment.tenantId || assignmentDoc.id}`).get();
    return {
      id: assignmentDoc.id,
      ...assignment,
      tenantId: assignment.tenantId || assignmentDoc.id,
      tenantName: tenant.data()?.name || assignment.tenantName || assignment.tenantId || assignmentDoc.id,
      tenantStatus: tenant.data()?.status || 'active',
      industry: assignment.industry || tenant.data()?.industry || tenant.data()?.vertical || 'general',
    };
  }));
  return {
    uid: user.uid,
    email: user.email || null,
    displayName: profile.data()?.displayName || user.displayName || null,
    phone: profile.data()?.phone || user.phoneNumber || null,
    title: profile.data()?.title || null,
    timezone: profile.data()?.timezone || null,
    locale: profile.data()?.locale || null,
    disabled: user.disabled,
    mustChangePassword: user.customClaims?.mustChangePassword === true,
    lmsSuperAdmin: caller.token?.lmsSuperAdmin === true,
    memberships: memberships.docs.map((doc) => ({ id: doc.id, ...doc.data(), role: normalizeRole(doc.data().role) })),
    agentAssignments,
  };
});

exports.getAccountWorkspace = onCall({ enforceAppCheck: false }, async (request) => {
  const { tenantId } = request.data || {};
  const { caller, membership } = await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  const [tenant, members, invitations, audits, profile] = await Promise.all([
    db.doc(`tenants/${tenantId}`).get(),
    db.collection(`tenants/${tenantId}/members`).limit(250).get(),
    db.collection(`tenants/${tenantId}/invitations`).where('status', '==', 'pending').limit(100).get(),
    db.collection(`tenants/${tenantId}/auditLogs`).orderBy('occurredAt', 'desc').limit(50).get(),
    db.doc(`users/${caller.uid}`).get(),
  ]);
  const tenantData = tenant.exists ? tenant.data() : {};
  const canManage = ['client_admin', 'client_supervisor', 'lms_super_admin'].includes(normalizeRole(membership.role));
  const userRows = await Promise.all(members.docs.map(async (memberDoc) => {
    const member = memberDoc.data();
    const userRecord = await auth.getUser(member.uid || memberDoc.id).catch(() => null);
    return {
      id: member.uid || memberDoc.id,
      name: member.displayName || userRecord?.displayName || member.email || 'Portal user',
      email: member.email || userRecord?.email || '',
      role: normalizeRole(member.role),
      status: member.active === false ? 'Inactive' : 'Active',
      lastActive: member.lastSignInAt || null,
    };
  }));
  return {
    businessProfile: tenantData.businessProfile || tenantData.profile || {},
    program: tenantData.program || { name: tenantData.programName || '', status: tenantData.status || 'Active', services: tenantData.services || [], pricingModel: tenantData.pricingModel || '', rate: tenantData.rate || 0 },
    primaryMarket: tenantData.primaryMarket || '',
    accountOwner: tenantData.accountOwner || '',
    programManager: tenantData.programManager || '',
    billingContact: tenantData.billingContact || {},
    notificationContacts: tenantData.notificationContacts || [],
    salesRoutingContacts: tenantData.salesRoutingContacts || [],
    user: { uid: caller.uid, role: normalizeRole(membership.role), ...(profile.exists ? profile.data() : {}) },
    permissions: { canManageMembers: canManage, canEditBusinessProfile: canManage },
    users: userRows,
    invitations: canManage ? invitations.docs.map((item) => ({ id: item.id, ...item.data(), role: normalizeRole(item.data().role), sent: item.data().createdAt || null })) : [],
    activity: audits.docs.map((item) => ({ id: item.id, event: item.data().action, actor: item.data().actorUid, at: item.data().occurredAt || item.data().createdAt || null })),
  };
});

exports.updateMyProfile = onCall({ enforceAppCheck: true }, async (request) => {
  const caller = requireAuth(request);
  const { displayName = '', phone = '', title = '', timezone = '', locale = 'en-US' } = request.data || {};
  const cleanName = String(displayName).trim();
  if (!cleanName || cleanName.length > 120) throw new HttpsError('invalid-argument', 'A valid display name is required.');
  const profile = { uid: caller.uid, displayName: cleanName, phone: String(phone).trim(), title: String(title).trim(), timezone: String(timezone).trim(), locale: String(locale).trim(), updatedAt: FieldValue.serverTimestamp() };
  await Promise.all([
    auth.updateUser(caller.uid, { displayName: cleanName }),
    db.doc(`users/${caller.uid}`).set(profile, { merge: true }),
  ]);
  return { ok: true, profile: { ...profile, updatedAt: undefined } };
});

exports.getSecurityWorkspace = onCall({ enforceAppCheck: false }, async (request) => {
  const { tenantId } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  const [user, profile, audits] = await Promise.all([
    auth.getUser(caller.uid),
    db.doc(`users/${caller.uid}`).get(),
    db.collection(`tenants/${tenantId}/auditLogs`).where('actorUid', '==', caller.uid).limit(50).get(),
  ]);
  const factors = user.multiFactor?.enrolledFactors || [];
  const events = audits.docs.map((item) => ({ at: item.data().occurredAt || item.data().createdAt || null, event: item.data().action, severity: String(item.data().action || '').includes('denied') ? 'Warning' : 'Info' }));
  return {
    mfaEnabled: factors.length > 0,
    mfaMethods: factors.map((factor) => ({ id: factor.uid, type: factor.factorId === 'phone' ? 'Phone' : 'Authenticator app', name: factor.displayName || factor.phoneNumber || factor.factorId, added: factor.enrollmentTime || '', primary: false })),
    recoveryCodes: [],
    sessions: [{ id: 'current', device: 'Current browser session', location: 'Current device', lastActive: new Date().toISOString(), current: true, trusted: false }],
    trustedDevices: [],
    recentSignIns: [],
    events,
    securityScore: factors.length ? 85 : 60,
    idleTimeoutMinutes: Number(profile.data()?.idleTimeoutMinutes) || 30,
  };
});

exports.updateSecuritySettings = onCall({ enforceAppCheck: true }, async (request) => {
  const caller = requireAuth(request);
  const settings = objectInput(request.data?.settings);
  const idleTimeoutMinutes = Number(settings.idleTimeoutMinutes);
  if (![15, 30, 60, 120].includes(idleTimeoutMinutes)) throw new HttpsError('invalid-argument', 'Idle timeout must be 15, 30, 60, or 120 minutes.');
  await db.doc(`users/${caller.uid}`).set({ idleTimeoutMinutes, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, settings: { idleTimeoutMinutes } };
});

exports.revokeAllSessions = onCall({ enforceAppCheck: true }, async (request) => {
  const caller = requireAuth(request);
  await auth.revokeRefreshTokens(caller.uid);
  return { ok: true, revokedAt: new Date().toISOString() };
});

exports.updateTenantProfile = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, businessProfile } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, TENANT_ADMIN_ROLES);
  const input = objectInput(businessProfile);
  const allowed = ['legalName', 'dba', 'website', 'phone', 'address'];
  const clean = Object.fromEntries(allowed.map((key) => [key, String(input[key] || '').trim()]));
  await db.doc(`tenants/${tenantId}`).set({ businessProfile: clean, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'tenant.profile.updated', target: tenantId });
  return { ok: true, businessProfile: clean };
});

exports.updateMemberRole = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, uid, role } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, TENANT_ADMIN_ROLES);
  const normalizedRole = normalizeRole(role);
  if (typeof uid !== 'string' || !uid || !CLIENT_INVITE_ROLES.has(normalizedRole)) throw new HttpsError('invalid-argument', 'A valid member and client role are required.');
  if (uid === caller.uid) throw new HttpsError('failed-precondition', 'You cannot change your own role.');
  await db.doc(`tenants/${tenantId}/members/${uid}`).set({ role: normalizedRole, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid }, { merge: true });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'membership.role.updated', target: uid, metadata: { role: normalizedRole } });
  return { ok: true, uid, role: normalizedRole };
});

exports.setMembershipStatus = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, uid, active } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, TENANT_ADMIN_ROLES);
  if (typeof uid !== 'string' || !uid || typeof active !== 'boolean') throw new HttpsError('invalid-argument', 'A valid member and status are required.');
  if (uid === caller.uid) throw new HttpsError('failed-precondition', 'You cannot deactivate your own membership.');
  await db.doc(`tenants/${tenantId}/members/${uid}`).set({ active, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid }, { merge: true });
  await recordAudit({ tenantId, actorUid: caller.uid, action: active ? 'membership.activated' : 'membership.deactivated', target: uid });
  return { ok: true, uid, active };
});

exports.createInvitation = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, email, role, brandIds = [] } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, TENANT_ADMIN_ROLES);
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedRole = normalizeRole(role);
  if (!normalizedEmail.includes('@') || !CLIENT_INVITE_ROLES.has(normalizedRole)) throw new HttpsError('invalid-argument', 'A valid email and client role are required.');
  if (!Array.isArray(brandIds) || brandIds.some((id) => typeof id !== 'string')) throw new HttpsError('invalid-argument', 'brandIds must be an array of strings.');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const invitation = await db.collection(`tenants/${tenantId}/invitations`).add({ tenantId, email: normalizedEmail, role: normalizedRole, brandIds, tokenHash, status: 'pending', invitedBy: caller.uid, createdAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'invitation.created', target: invitation.id, metadata: { email: normalizedEmail, role: normalizedRole } });
  return { id: invitation.id, invitationId: invitation.id, email: normalizedEmail, role: normalizedRole, status: 'pending', delivery: 'pending' };
});

exports.acceptInvitation = onCall({ enforceAppCheck: true }, async (request) => {
  const caller = requireAuth(request);
  const { tenantId, invitationId, token } = request.data || {};
  if (!tenantId || !invitationId || typeof token !== 'string') throw new HttpsError('invalid-argument', 'tenantId, invitationId, and token are required.');
  const invitationRef = db.doc(`tenants/${tenantId}/invitations/${invitationId}`);
  const snapshot = await invitationRef.get();
  const invitation = snapshot.exists ? snapshot.data() : null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (!invitation || invitation.status !== 'pending' || invitation.tokenHash !== tokenHash || invitation.expiresAt.toDate() < new Date()) throw new HttpsError('permission-denied', 'Invitation is invalid or expired.');
  const user = await auth.getUser(caller.uid);
  if ((user.email || '').toLowerCase() !== invitation.email) throw new HttpsError('permission-denied', 'Invitation email does not match the signed-in user.');
  const membershipRef = db.doc(`tenants/${tenantId}/members/${caller.uid}`);
  await db.runTransaction(async (transaction) => {
    transaction.set(membershipRef, { uid: caller.uid, tenantId, email: invitation.email, role: invitation.role, brandIds: invitation.brandIds || [], active: true, invitedBy: invitation.invitedBy, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.update(invitationRef, { status: 'accepted', acceptedBy: caller.uid, acceptedAt: FieldValue.serverTimestamp(), tokenHash: FieldValue.delete() });
  });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'invitation.accepted', target: caller.uid });
  return { tenantId, uid: caller.uid, role: invitation.role, active: true };
});

exports.listMyMemberships = onCall({ enforceAppCheck: false }, async (request) => {
  const caller = requireAuth(request);
  const memberships = await db.collectionGroup('members').where('uid', '==', caller.uid).where('active', '==', true).get();
  return { memberships: memberships.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});

exports.createSupportRequest = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, subject, category = 'general', priority = 'normal', body } = request.data || {};
  if (typeof subject !== 'string' || !subject.trim() || typeof body !== 'string' || !body.trim()) throw new HttpsError('invalid-argument', 'subject and body are required.');
  const caller = requireAuth(request);
  return createTenantRecord({ request, tenantId, collectionName: 'supportRequests', roles: ['client', 'client_admin', 'client_supervisor', 'lms_super_admin'], action: 'support.created', data: { subject: subject.trim(), type: category, category, priority, body: body.trim(), status: 'open', assigned: 'Queued - Link team', thread: [{ fromUid: caller.uid, from: caller.token?.name || caller.token?.email || 'Portal user', body: body.trim(), at: new Date().toISOString() }] } });
});

exports.createBillingReview = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, invoiceId, reason, note = '' } = request.data || {};
  if (typeof invoiceId !== 'string' || !invoiceId.trim() || typeof reason !== 'string' || !reason.trim()) throw new HttpsError('invalid-argument', 'invoiceId and reason are required.');
  return createTenantRecord({ request, tenantId, collectionName: 'billingReviews', roles: ['admin', 'supervisor', 'customer'], action: 'billing.review.created', data: { invoiceId: invoiceId.trim(), reason: reason.trim(), note, status: 'submitted' } });
});

exports.updateNotificationPreferences = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, preferences } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, ['admin', 'supervisor', 'agent', 'auditor', 'customer']);
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) throw new HttpsError('invalid-argument', 'preferences must be an object.');
  await db.doc(`tenants/${tenantId}/notificationPreferences/${caller.uid}`).set({ tenantId, uid: caller.uid, preferences, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'notifications.preferences.updated', target: caller.uid });
  return { ok: true, preferences };
});

exports.getNotificationWorkspace = onCall({ enforceAppCheck: false }, async (request) => {
  const { tenantId } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  const [preferences, notifications] = await Promise.all([
    db.doc(`tenants/${tenantId}/notificationPreferences/${caller.uid}`).get(),
    db.collection(`tenants/${tenantId}/notifications`).where('recipientUid', 'in', [caller.uid, 'all']).limit(100).get().catch(() => null),
  ]);
  return {
    preferences: preferences.exists ? preferences.data().preferences || {} : {},
    recent: notifications ? notifications.docs.map((item) => ({ id: item.id, ...item.data() })) : [],
  };
});

exports.createDocumentMetadata = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, documentId, name, category, storagePath, contentType, sizeBytes } = request.data || {};
  if (typeof name !== 'string' || !name.trim() || typeof storagePath !== 'string' || !storagePath.startsWith(`tenants/${tenantId}/`)) throw new HttpsError('invalid-argument', 'A tenant-scoped name and storagePath are required.');
  if (typeof documentId !== 'string' || !documentId || !storagePath.startsWith(`tenants/${tenantId}/documents/${documentId}/`)) throw new HttpsError('invalid-argument', 'Document metadata must match its tenant-scoped Storage path.');
  const { caller } = await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  const now = FieldValue.serverTimestamp();
  const record = { tenantId, name: name.trim(), category: category || 'general', storagePath, contentType: contentType || 'application/octet-stream', sizeBytes: Number(sizeBytes) || 0, status: 'available', createdBy: caller.uid, createdAt: now, updatedAt: now };
  await db.doc(`tenants/${tenantId}/documents/${documentId}`).set(record);
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'document.metadata.created', target: documentId });
  return { id: documentId, ...record, createdAt: undefined, updatedAt: undefined };
});

exports.addSupportReply = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, requestId, body } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  if (typeof requestId !== 'string' || !requestId || typeof body !== 'string' || !body.trim()) throw new HttpsError('invalid-argument', 'A request and reply are required.');
  const ref = db.doc(`tenants/${tenantId}/supportRequests/${requestId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Support request not found.');
  const message = { fromUid: caller.uid, from: caller.token?.name || caller.token?.email || 'Portal user', body: body.trim(), at: new Date().toISOString() };
  await ref.update({ thread: FieldValue.arrayUnion(message), updatedAt: FieldValue.serverTimestamp() });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'support.reply.created', target: requestId });
  return { ok: true, message };
});

function percentage(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

function leadStatus(lead) {
  return String(lead.stage || lead.status || lead.disposition || '').trim().toLowerCase();
}

function hasContact(lead) {
  return Boolean(lead.contactedAt || lead.firstResponseAt || lead.conversationCompletedAt || ['contacted', 'qualified', 'appointment set', 'handed off', 'closed', 'closed-won', 'closed won'].includes(leadStatus(lead)));
}

function isQualified(lead) {
  return Boolean(lead.qualifiedAt || ['qualified', 'appointment set', 'handed off', 'closed', 'closed-won', 'closed won'].includes(leadStatus(lead)));
}

function isHandedOff(lead) {
  return Boolean(lead.handedOffAt || lead.liveTransferAt || ['handed off', 'appointment set', 'closed', 'closed-won', 'closed won'].includes(leadStatus(lead)));
}

function isAccepted(appointment) {
  return ['accepted', 'confirmed'].includes(String(appointment.acceptance || appointment.status || appointment.confirmation || '').toLowerCase());
}

function isShow(appointment) {
  return ['show', 'completed', 'attended'].includes(String(appointment.attendance || appointment.status || '').toLowerCase());
}

function averageResponseMinutes(leads) {
  const values = leads.map((lead) => {
    const received = lead.receivedAt?.toDate?.() || lead.createdAt?.toDate?.() || (lead.receivedAt || lead.createdAt ? new Date(lead.receivedAt || lead.createdAt) : null);
    const response = lead.firstResponseAt?.toDate?.() || (lead.firstResponseAt ? new Date(lead.firstResponseAt) : null);
    return received && response ? Math.max(0, (response.getTime() - received.getTime()) / 60000) : null;
  }).filter((value) => Number.isFinite(value));
  return values.length ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1)) : 0;
}

exports.getCustomerCollection = onCall({ enforceAppCheck: false }, async (request) => {
  const { tenantId, collectionName } = request.data || {};
  const { membership } = await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  if (!['leads', 'appointments', 'billing', 'invoices', 'documents', 'supportRequests'].includes(collectionName)) {
    throw new HttpsError('invalid-argument', 'Collection is not available to the customer portal.');
  }
  const snapshot = await db.collection(`tenants/${tenantId}/${collectionName}`).where('tenantId', '==', tenantId).limit(250).get();
  const allowedBrands = Array.isArray(membership.brandIds) && membership.brandIds.length ? new Set(membership.brandIds) : null;
  return { rows: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((row) => row.archived !== true && (!allowedBrands || !recordBrandId(row) || allowedBrands.has(recordBrandId(row)))) };
});

exports.getDashboardWorkspace = onCall({ enforceAppCheck: false }, async (request) => {
  const { tenantId } = request.data || {};
  await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  const [tenant, leadsSnapshot, appointmentsSnapshot] = await Promise.all([
    db.doc(`tenants/${tenantId}`).get(),
    db.collection(`tenants/${tenantId}/leads`).where('tenantId', '==', tenantId).get(),
    db.collection(`tenants/${tenantId}/appointments`).where('tenantId', '==', tenantId).get(),
  ]);
  const tenantData = tenant.exists ? tenant.data() : {};
  const leads = leadsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((row) => row.archived !== true);
  const appointments = appointmentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((row) => row.archived !== true);
  const conversations = leads.filter(hasContact).length;
  const qualified = leads.filter(isQualified).length;
  const handedOff = leads.filter(isHandedOff).length;
  const accepted = appointments.filter(isAccepted).length;
  const shows = appointments.filter(isShow).length;
  return {
    greeting: tenantData.dashboardGreeting || 'Welcome to your customer workspace',
    programStatus: tenantData.programStatus || tenantData.status || 'Active',
    reportingPeriod: tenantData.reportingPeriod || 'Current reporting period',
    previousPeriod: tenantData.previousPeriod || 'Previous reporting period',
    metrics: {
      leadsReceived: { value: leads.length, change: 0 },
      conversations: { value: conversations, change: 0 },
      qualifiedOpportunities: { value: qualified, change: 0 },
      appointmentsAndTransfers: { value: appointments.length, change: 0 },
      contactRate: { value: percentage(conversations, leads.length), change: 0 },
      qualificationRate: { value: percentage(qualified, conversations || leads.length), change: 0 },
      handoffRate: { value: percentage(handedOff, qualified || leads.length), change: 0 },
      showRate: { value: percentage(shows, accepted || appointments.length), change: 0 },
    },
    averageResponse: { minutes: averageResponseMinutes(leads), change: 0 },
    recentLeads: leads.slice(0, 8),
    upcomingAppointments: appointments.slice(0, 8),
    generatedAt: new Date().toISOString(),
  };
});

exports.getLiveReport = onCall({ enforceAppCheck: false }, async (request) => {
  const { tenantId, range = null, comparison = null, rangeStart = null, rangeEnd = null } = request.data || {};
  await requireMembership(request, tenantId, ['client', 'client_admin', 'client_supervisor', 'lms_super_admin']);
  const [leadsSnapshot, appointmentsSnapshot] = await Promise.all([
    db.collection(`tenants/${tenantId}/leads`).where('tenantId', '==', tenantId).get(),
    db.collection(`tenants/${tenantId}/appointments`).where('tenantId', '==', tenantId).get(),
  ]);
  const inRange = (item) => {
    const value = item.createdAt?.toDate?.() || (item.createdAt ? new Date(item.createdAt) : null);
    return (!rangeStart || !value || value >= new Date(rangeStart)) && (!rangeEnd || !value || value <= new Date(rangeEnd));
  };
  const leads = leadsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((row) => row.archived !== true).filter(inRange);
  const appointments = appointmentsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((row) => row.archived !== true).filter(inRange);
  const contacted = leads.filter(hasContact);
  const qualified = leads.filter(isQualified);
  const handedOff = leads.filter(isHandedOff);
  const accepted = appointments.filter(isAccepted);
  const shows = appointments.filter(isShow);
  return {
    tenantId,
    range: range || (rangeStart && rangeEnd ? `${rangeStart} - ${rangeEnd}` : 'Current period'),
    comparison: comparison || 'Previous period',
    metrics: {
      leadVolume: { value: leads.length, change: 0 },
      contactRate: { value: percentage(contacted.length, leads.length), change: 0 },
      qualificationRate: { value: percentage(qualified.length, contacted.length || leads.length), change: 0 },
      appointmentRate: { value: percentage(appointments.length, qualified.length || leads.length), change: 0 },
      liveTransferRate: { value: percentage(handedOff.length, qualified.length || leads.length), change: 0 },
      acceptanceRate: { value: percentage(accepted.length, appointments.length), change: 0 },
      showRate: { value: percentage(shows.length, accepted.length || appointments.length), change: 0 },
    },
    leads,
    appointments,
    generatedAt: new Date().toISOString(),
  };
});

exports.getAgentCollection = onCall({ enforceAppCheck: false }, async (request) => {
  const { tenantId, collectionName, limit: requestedLimit = 200 } = request.data || {};
  const { assignment } = await requireAgentAssignment(request, tenantId, ['admin', 'supervisor', 'agent', 'auditor']);
  if (!AGENT_COLLECTIONS.has(collectionName)) throw new HttpsError('invalid-argument', 'Collection is not available through the CRM API.');
  const pageSize = Math.min(Math.max(Number(requestedLimit) || 200, 1), 500);
  const snapshot = await db.collection(`tenants/${tenantId}/${collectionName}`).where('tenantId', '==', tenantId).limit(pageSize).get();
  const rows = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.archived !== true && assignmentAllowsBrand(assignment, recordBrandId(item)));
  return { rows };
});

exports.createAgentRecord = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, collectionName, data } = request.data || {};
  if (!AGENT_COLLECTIONS.has(collectionName) || collectionName === 'auditLogs') throw new HttpsError('invalid-argument', 'Collection is not writable through the CRM API.');
  const roles = writeRolesFor(collectionName);
  if (!roles.length) throw new HttpsError('permission-denied', 'This collection is not writable through the CRM API.');
  const authorization = await requireAgentAssignment(request, tenantId, roles);
  const input = applyAssignmentBrand(authorization.assignment, collectionName, data);
  validateRequiredFields(collectionName, input);
  if (collectionName === 'leads' && INDUSTRY_POLICY_FIELDS.some((field) => input[field] === undefined && field !== 'receivedAt')) throw new HttpsError('invalid-argument', 'Lead workflow metadata is required.');
  return createTenantRecord({ request, tenantId, collectionName, roles, authorize: requireAgentAssignment, authorization, action: `crm.${collectionName}.created`, data: input });
});

exports.updateAgentRecord = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, collectionName, recordId, data } = request.data || {};
  if (!AGENT_COLLECTIONS.has(collectionName) || collectionName === 'auditLogs' || typeof recordId !== 'string' || !recordId) throw new HttpsError('invalid-argument', 'A valid writable collection and recordId are required.');
  const roles = writeRolesFor(collectionName);
  if (!roles.length) throw new HttpsError('permission-denied', 'This collection is not writable through the CRM API.');
  const { caller, assignment } = await requireAgentAssignment(request, tenantId, roles);
  const recordRef = db.doc(`tenants/${tenantId}/${collectionName}/${recordId}`);
  const current = await recordRef.get();
  if (!current.exists || current.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Record not found.');
  requireAssignmentBrand(assignment, recordBrandId(current.data()));
  const patch = stripImmutablePatch(data);
  await recordRef.update({ ...patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid });
  await recordAudit({ tenantId, actorUid: caller.uid, action: `crm.${collectionName}.updated`, target: recordId });
  return { id: recordId, ...current.data(), ...patch };
});

exports.createAgentAssignment = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, agentUid, industry, brandId = null, campaignIds = [], sourceIds = [], scope = 'assigned', permissions = [], role = 'agent' } = request.data || {};
  const assignmentRole = role === 'supervisor' ? 'supervisor' : 'agent';
  const { caller } = await requireMembership(request, tenantId, assignmentRole === 'supervisor' ? ['admin'] : ['admin', 'supervisor']);
  if (typeof agentUid !== 'string' || !agentUid || typeof industry !== 'string' || !industry) throw new HttpsError('invalid-argument', 'agentUid and industry are required.');
  const user = await auth.getUser(agentUid).catch(() => null);
  if (!user || user.disabled) throw new HttpsError('not-found', 'Agent account is unavailable.');
  const assignment = { agentUid, tenantId, industry, brandId, campaignIds, sourceIds, scope, permissions, role: assignmentRole, status: 'active', assignedBy: caller.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  const ref = db.collection('agentAssignments').doc();
  await db.runTransaction(async (transaction) => {
    transaction.set(ref, assignment);
    transaction.set(db.doc(`agentUsers/${agentUid}`), { uid: agentUid, email: user.email || null, displayName: user.displayName || null, role: assignmentRole, status: 'active', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(db.doc(`agentUsers/${agentUid}/assignments/${tenantId}`), { ...assignment, assignmentId: ref.id }, { merge: true });
  });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'agent.assignment.created', target: ref.id, metadata: { agentUid, industry, role: assignmentRole } });
  return { id: ref.id, ...assignment, status: 'active' };
});

exports.revokeAgentAssignment = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, agentUid, assignmentId } = request.data || {};
  const { caller } = await requireMembership(request, tenantId, ['admin', 'supervisor']);
  if (typeof agentUid !== 'string' || typeof assignmentId !== 'string') throw new HttpsError('invalid-argument', 'agentUid and assignmentId are required.');
  const assignmentSnapshot = await db.doc(`agentAssignments/${assignmentId}`).get();
  if (!assignmentSnapshot.exists || assignmentSnapshot.data().tenantId !== tenantId || assignmentSnapshot.data().agentUid !== agentUid) {
    throw new HttpsError('not-found', 'Assignment not found.');
  }
  await db.doc(`agentAssignments/${assignmentId}`).update({ status: 'revoked', updatedAt: FieldValue.serverTimestamp(), revokedBy: caller.uid });
  await db.doc(`agentUsers/${agentUid}/assignments/${tenantId}`).set({ status: 'revoked', updatedAt: FieldValue.serverTimestamp(), revokedBy: caller.uid }, { merge: true });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'agent.assignment.revoked', target: assignmentId, metadata: { agentUid } });
  return { ok: true, assignmentId, status: 'revoked' };
});

exports.setIndustryConfig = onCall({ enforceAppCheck: true }, async (request) => {
  const { industryId, config } = request.data || {};
  const caller = requireAuth(request);
  if (typeof industryId !== 'string' || !industryId || !config || typeof config !== 'object') throw new HttpsError('invalid-argument', 'industryId and config are required.');
  const current = await auth.getUser(caller.uid);
  if (!current.customClaims?.lmsSuperAdmin && !current.customClaims?.platformAdmin) throw new HttpsError('permission-denied', 'LMS Super Admin access is required.');
  const missing = INDUSTRY_POLICY_FIELDS.filter((field) => config[field] === undefined || config[field] === null);
  if (missing.length) throw new HttpsError('invalid-argument', `Missing policy fields: ${missing.join(', ')}`);
  await db.doc(`industryConfigs/${industryId}`).set({ ...config, industryId, updatedBy: caller.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, industryId };
});

exports.transitionLead = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, leadId, status, disposition = null, note = null } = request.data || {};
  const allowed = new Set(['new', 'contacted', 'qualified', 'appointment_scheduled', 'handed_off', 'closed', 'duplicate']);
  if (!allowed.has(status) || typeof leadId !== 'string' || !leadId) throw new HttpsError('invalid-argument', 'A valid leadId and status are required.');
  const { caller, assignment } = await requireAgentAssignment(request, tenantId, ['admin', 'supervisor', 'agent']);
  const leadRef = db.doc(`tenants/${tenantId}/leads/${leadId}`);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(leadRef);
    if (!snapshot.exists || snapshot.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Lead not found.');
    requireAssignmentBrand(assignment, recordBrandId(snapshot.data()));
    const patch = { status, lead_status: status, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
    if (disposition !== null) patch.disposition = String(disposition).slice(0, 500);
    if (note !== null) patch.latestNote = String(note).slice(0, 2000);
    transaction.update(leadRef, patch);
    return { id: leadId, ...snapshot.data(), ...patch };
  });
  await recordAudit({ tenantId, actorUid: caller.uid, action: 'lead.transitioned', target: leadId, metadata: { status } });
  return result;
});

exports.appointmentWorkflow = onCall({ enforceAppCheck: true }, async (request) => {
  const { tenantId, action, appointmentId, data = {} } = request.data || {};
  if (!['create', 'confirm', 'reschedule', 'cancel', 'attendance'].includes(action)) throw new HttpsError('invalid-argument', 'Unsupported appointment action.');
  const { caller, assignment } = await requireAgentAssignment(request, tenantId, ['admin', 'supervisor', 'agent']);
  const appointments = db.collection(`tenants/${tenantId}/appointments`);
  let result;
  if (action === 'create') {
    const leadId = data.leadId || data.lead_id;
    const title = data.title || data.subject;
    if (typeof leadId !== 'string' || !leadId || typeof title !== 'string' || !title.trim()) throw new HttpsError('invalid-argument', 'leadId and title are required.');
    const ref = appointments.doc();
    await db.runTransaction(async (transaction) => {
      const leadRef = db.doc(`tenants/${tenantId}/leads/${leadId}`);
      const lead = await transaction.get(leadRef);
      if (!lead.exists || lead.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Lead not found.');
      const leadData = lead.data();
      const brandId = recordBrandId(leadData);
      requireAssignmentBrand(assignment, brandId);
      const record = {
        ...stripImmutablePatch(data), leadId, title: title.trim(), tenantId,
        brandId, brand_id: brandId, status: data.status || 'booked',
        createdBy: caller.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.set(ref, record);
      transaction.update(leadRef, { status: 'appointment_scheduled', updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid });
      result = { id: ref.id, ...record };
    });
  } else {
    if (typeof appointmentId !== 'string' || !appointmentId) throw new HttpsError('invalid-argument', 'appointmentId is required.');
    const ref = appointments.doc(appointmentId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Appointment not found.');
    requireAssignmentBrand(assignment, recordBrandId(snapshot.data()));
    const status = action === 'confirm' ? 'confirmed' : action === 'reschedule' ? 'booked' : action === 'cancel' ? 'canceled' : String(data.status || 'completed');
    const patch = { ...stripImmutablePatch(data), status, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
    await ref.update(patch);
    result = { id: appointmentId, ...snapshot.data(), ...patch };
  }
  await recordAudit({ tenantId, actorUid: caller.uid, action: `appointment.${action}`, target: result.id });
  return result;
});

exports.communications = onCall({ enforceAppCheck: true, secrets: [twilioAccountSid, twilioAuthToken] }, async (request) => {
  const { tenantId, action, params = {}, adminCheck = false } = request.data || {};
  const roles = adminCheck ? ['admin', 'supervisor'] : ['admin', 'supervisor', 'agent'];
  const { caller, assignment } = await requireAgentAssignment(request, tenantId, roles);
  if (!['health_check', 'start_call', 'end_call', 'hold_call', 'resume_call', 'warm_transfer'].includes(action)) throw new HttpsError('invalid-argument', 'Unsupported communications action.');
  if (action === 'health_check') return { ok: true, configured: twilioConfigured(), provider: 'twilio', actorUid: caller.uid };
  const callSid = typeof params.callId === 'string' ? params.callId : '';
  if (!callSid && action !== 'start_call') throw new HttpsError('invalid-argument', 'A callId is required.');
  let result;
  let callId = callSid;
  let leadId = typeof params.leadId === 'string' ? params.leadId : '';
  let brandId = null;
  let callRef = null;
  if (action === 'start_call') {
    if (!leadId) throw new HttpsError('invalid-argument', 'An authorized leadId is required.');
    const leadSnapshot = await db.doc(`tenants/${tenantId}/leads/${leadId}`).get();
    if (!leadSnapshot.exists || leadSnapshot.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Lead not found.');
    const leadData = leadSnapshot.data();
    brandId = recordBrandId(leadData);
    requireAssignmentBrand(assignment, brandId);
    if (!params.to || !normalizedPhone(leadData.phone) || normalizedPhone(params.to) !== normalizedPhone(leadData.phone)) {
      throw new HttpsError('permission-denied', 'The call destination must match the authorized lead phone.');
    }
    if (!process.env.TWILIO_FROM_NUMBER) throw new HttpsError('failed-precondition', 'Telephony is not configured.');
    result = await twilioRequest('/Calls.json', 'POST', { To: params.to, From: process.env.TWILIO_FROM_NUMBER, Url: params.twimlUrl || process.env.TWILIO_VOICE_WEBHOOK_URL });
    callId = result.sid;
    if (!callId) throw new HttpsError('internal', 'The telephony provider did not return a call identifier.');
    callRef = db.doc(`tenants/${tenantId}/callRecords/${callId}`);
    await callRef.set({
      tenantId, brandId, leadId, agentUid: caller.uid, provider: 'twilio', providerCallId: callId,
      clientContactId: leadData.routedClientContactId || null,
      direction: 'outbound', destination: String(params.to).slice(0, 80), status: result.status || 'queued',
      startedAt: FieldValue.serverTimestamp(), endedAt: null, createdBy: caller.uid,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  } else if (action === 'end_call') {
    callRef = db.doc(`tenants/${tenantId}/callRecords/${callSid}`);
    const callSnapshot = await callRef.get();
    if (!callSnapshot.exists || callSnapshot.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Call not found.');
    brandId = recordBrandId(callSnapshot.data());
    leadId = callSnapshot.data().leadId || '';
    requireAssignmentBrand(assignment, brandId);
    result = await twilioRequest(`/Calls/${encodeURIComponent(callSid)}.json`, 'POST', { Status: 'completed' });
  } else if (action === 'hold_call' || action === 'resume_call') {
    callRef = db.doc(`tenants/${tenantId}/callRecords/${callSid}`);
    const callSnapshot = await callRef.get();
    if (!callSnapshot.exists || callSnapshot.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Call not found.');
    brandId = recordBrandId(callSnapshot.data());
    leadId = callSnapshot.data().leadId || '';
    requireAssignmentBrand(assignment, brandId);
    result = await twilioRequest(`/Calls/${encodeURIComponent(callSid)}.json`, 'POST', { Twiml: action === 'hold_call' ? '<Response><Say>The call is on hold.</Say><Pause length="60"/></Response>' : '<Response><Say>Resuming call.</Say></Response>' });
  } else {
    callRef = db.doc(`tenants/${tenantId}/callRecords/${callSid}`);
    const callSnapshot = await callRef.get();
    if (!callSnapshot.exists || callSnapshot.data().tenantId !== tenantId) throw new HttpsError('not-found', 'Call not found.');
    const callData = callSnapshot.data();
    brandId = recordBrandId(callData);
    leadId = callData.leadId || '';
    requireAssignmentBrand(assignment, brandId);
    if (!params.transferTo) throw new HttpsError('invalid-argument', 'A transfer destination is required.');
    const leadSnapshot = await db.doc(`tenants/${tenantId}/leads/${leadId}`).get();
    if (!leadSnapshot.exists || leadSnapshot.data().tenantId !== tenantId || recordBrandId(leadSnapshot.data()) !== brandId) {
      throw new HttpsError('not-found', 'The routed lead is unavailable.');
    }
    const clientContactId = callData.clientContactId || leadSnapshot.data().routedClientContactId;
    if (!clientContactId) throw new HttpsError('failed-precondition', 'The lead has no routed Client Contact.');
    const contactSnapshot = await db.doc(`tenants/${tenantId}/businessOwners/${clientContactId}`).get();
    const contact = contactSnapshot.exists ? contactSnapshot.data() : null;
    if (!contact || contact.status === 'inactive' || contact.routingEligible === false || (recordBrandId(contact) && recordBrandId(contact) !== brandId)) {
      throw new HttpsError('failed-precondition', 'The routed Client Contact is unavailable.');
    }
    if (!normalizedPhone(contact.phone) || normalizedPhone(params.transferTo) !== normalizedPhone(contact.phone)) {
      throw new HttpsError('permission-denied', 'Transfers must use the routed Client Contact phone.');
    }
    result = await twilioRequest(`/Calls/${encodeURIComponent(callSid)}.json`, 'POST', { Twiml: `<Response><Dial>${String(params.transferTo).replace(/[<>]/g, '')}</Dial></Response>` });
  }
  if (callRef && action !== 'start_call') {
    const status = action === 'end_call' ? 'completed' : action === 'hold_call' ? 'on_hold' : action === 'resume_call' ? 'in_progress' : 'transferred';
    await callRef.update({
      status, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid,
      ...(action === 'end_call' ? { endedAt: FieldValue.serverTimestamp() } : {}),
    });
  }
  await recordAudit({ tenantId, actorUid: caller.uid, action: `telephony.${action}`, target: callId || null, metadata: { brandId, leadId } });
  return { ok: true, action, callId, status: result.status || 'accepted' };
});

exports.twilioWebhook = onRequest({ cors: false, secrets: [twilioAuthToken] }, async (request, response) => {
  if (request.method !== 'POST') return response.status(405).send('Method not allowed');
  const authToken = twilioAuthToken.value();
  if (!authToken || authToken === 'not-configured') return response.status(503).send('Telephony is not configured');
  const signature = request.get('X-Twilio-Signature') || '';
  const url = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
  const params = request.body || {};
  const data = url + Object.keys(params).sort().map((key) => `${key}${params[key]}`).join('');
  const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return response.status(403).send('Invalid signature');
  response.type('text/xml').send('<Response><Say>Link Marketing Services call connected.</Say></Response>');
});
