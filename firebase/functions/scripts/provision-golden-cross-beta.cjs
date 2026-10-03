const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT || 'gms-prod-1089114348316' });
const db = getFirestore();
const auth = getAuth();

async function main() {
  if (process.env.CONFIRM_GOLDEN_CROSS_BETA !== 'yes') throw new Error('Set CONFIRM_GOLDEN_CROSS_BETA=yes to provision the production beta tenant.');
  const tenantId = 'tenant-golden-cross-beta';
  const brandId = 'brand-golden-cross-realty';
  const routeKey = 'golden-cross-beta';
  const now = FieldValue.serverTimestamp();
  const route = { routeKey, tenantId, brandId, industryId: 'real-estate', sourceId: 'source-golden-cross-pilot', campaignId: 'campaign-golden-cross-pilot', routingProfileId: 'routing-golden-cross-default', workflowVersion: '1.0', scriptSetId: 'script-golden-cross-default', qualificationFormId: 'qualification-golden-cross-default', consentPolicyId: 'consent-standard', retentionPolicyId: 'retention-standard', notificationProfileId: 'notification-default', status: 'active', assignedAgentUids: [], createdAt: now, updatedAt: now, createdBy: 'server:beta-bootstrap' };
  const gmsTenantId = 'gms-internal';
  const gmsBrandId = 'brand-golden-marketing-services';
  const gmsRoute = { routeKey: 'gms-website', tenantId: gmsTenantId, brandId: gmsBrandId, industryId: 'business-services', sourceId: 'source-gms-website', campaignId: 'campaign-gms-website', routingProfileId: 'routing-gms-sales', workflowVersion: '1.0', scriptSetId: 'script-gms-sales', qualificationFormId: 'qualification-gms-sales', consentPolicyId: 'consent-standard', retentionPolicyId: 'retention-standard', notificationProfileId: 'notification-default', status: 'active', assignedAgentUids: [], createdAt: now, updatedAt: now, createdBy: 'server:beta-bootstrap' };
  const agents = await db.collection('agentUsers').where('status', '==', 'active').get();
  route.assignedAgentUids = agents.docs.map((item) => item.id);
  gmsRoute.assignedAgentUids = route.assignedAgentUids;
  const betaEmail = process.env.GOLDEN_CROSS_BETA_EMAIL || 'goldencross.beta@goldenmarketingservices.com';
  const betaPassword = process.env.GOLDEN_CROSS_BETA_PASSWORD || '';
  let betaUser = await auth.getUserByEmail(betaEmail).catch(() => null);
  if (!betaUser && betaPassword) betaUser = await auth.createUser({ email: betaEmail, password: betaPassword, displayName: 'Golden Cross Beta Admin', emailVerified: true });
  const batch = db.batch();
  batch.set(db.doc(`tenants/${tenantId}`), { tenantId, name: 'Golden Cross Realty', legalName: 'Golden Cross Realty', status: 'beta', environment: 'production', industry: 'real-estate', vertical: 'real-estate', demo: false, createdAt: now, updatedAt: now, createdBy: 'server:beta-bootstrap' }, { merge: true });
  batch.set(db.doc(`tenants/${tenantId}/organizations/default`), { tenantId, name: 'Golden Cross Realty', status: 'active', settings: { timezone: 'America/Chicago' }, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${tenantId}/brands/${brandId}`), { tenantId, brandId, name: 'Golden Cross Realty', status: 'active', domain: '', industryId: 'real-estate', createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${tenantId}/leadSources/${route.sourceId}`), { tenantId, brandId, name: 'Golden Cross pilot', type: 'website', status: 'active', createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${tenantId}/campaigns/${route.campaignId}`), { tenantId, brandId, name: 'Golden Cross beta pilot', status: 'active', startDate: new Date().toISOString().slice(0, 10), endDate: null, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${tenantId}/routingRules/${route.routingProfileId}`), { tenantId, brandId, name: 'Golden Cross client contact rotation', status: 'active', priority: 1, conditions: [], destination: { type: 'client_contact_rotation' }, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${tenantId}/config/workflow`), { ...route, notificationChannels: ['in_app', 'email'], retentionDays: 2555 }, { merge: true });
  batch.set(db.doc(`industryConfigs/real-estate`), { industryId: 'real-estate', workflowVersion: route.workflowVersion, scriptSetId: route.scriptSetId, qualificationFormId: route.qualificationFormId, routingProfileId: route.routingProfileId, consentPolicyId: route.consentPolicyId, retentionPolicyId: route.retentionPolicyId, updatedAt: now, updatedBy: 'server:beta-bootstrap' }, { merge: true });
  batch.set(db.doc(`ingestionRoutes/${routeKey}`), route, { merge: true });
  if (betaUser) {
    batch.set(db.doc(`tenants/${tenantId}/members/${betaUser.uid}`), { uid: betaUser.uid, tenantId, email: betaEmail, role: 'client_admin', active: true, brandIds: [brandId], invitedBy: 'server:beta-bootstrap', createdAt: now, updatedAt: now }, { merge: true });
    batch.set(db.doc(`users/${betaUser.uid}`), { uid: betaUser.uid, email: betaEmail, displayName: 'Golden Cross Beta Admin', updatedAt: now }, { merge: true });
    batch.set(db.doc(`tenants/${tenantId}/businessOwners/${betaUser.uid}`), { tenantId, brandId, uid: betaUser.uid, memberUid: betaUser.uid, name: 'Golden Cross Beta Admin', email: betaEmail, phone: '', roleType: 'client_contact', status: 'active', routingEligible: true, createdAt: now, updatedAt: now }, { merge: true });
  } else {
    batch.set(db.collection(`tenants/${tenantId}/invitations`).doc('golden-cross-beta-admin'), { tenantId, email: betaEmail, role: 'client_admin', brandIds: [brandId], status: 'pending', note: 'Dedicated beta invitation; demo membership remains unchanged.', invitedBy: 'server:beta-bootstrap', createdAt: now, updatedAt: now }, { merge: true });
  }
  batch.set(db.doc(`tenants/${gmsTenantId}`), { tenantId: gmsTenantId, name: 'Golden Marketing Services Sales', legalName: 'Golden Marketing Services', status: 'active', environment: 'production', industry: 'business-services', vertical: 'business-services', demo: false, createdAt: now, updatedAt: now, createdBy: 'server:beta-bootstrap' }, { merge: true });
  batch.set(db.doc(`tenants/${gmsTenantId}/organizations/default`), { tenantId: gmsTenantId, name: 'Golden Marketing Services Sales', status: 'active', settings: { timezone: 'America/Chicago', domain: 'goldenmarketingservices.com' }, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${gmsTenantId}/brands/${gmsBrandId}`), { tenantId: gmsTenantId, brandId: gmsBrandId, name: 'Golden Marketing Services', status: 'active', domain: 'goldenmarketingservices.com', industryId: 'business-services', createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${gmsTenantId}/leadSources/${gmsRoute.sourceId}`), { tenantId: gmsTenantId, brandId: gmsBrandId, name: 'GMS website', type: 'website', status: 'active', createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${gmsTenantId}/campaigns/${gmsRoute.campaignId}`), { tenantId: gmsTenantId, brandId: gmsBrandId, name: 'GMS website inquiries', status: 'active', startDate: new Date().toISOString().slice(0, 10), endDate: null, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${gmsTenantId}/routingRules/${gmsRoute.routingProfileId}`), { tenantId: gmsTenantId, brandId: gmsBrandId, name: 'GMS sales queue', status: 'active', priority: 1, conditions: [], destination: { type: 'agent_pool' }, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(db.doc(`tenants/${gmsTenantId}/config/workflow`), { ...gmsRoute, notificationChannels: ['in_app', 'email'], retentionDays: 2555 }, { merge: true });
  batch.set(db.doc('ingestionRoutes/gms-website'), gmsRoute, { merge: true });
  for (const agent of agents.docs) {
    const assignmentRef = db.collection('agentAssignments').doc();
    const role = agent.data().role || 'agent';
    const assignment = { agentUid: agent.id, tenantId, industry: 'real-estate', brandId, brandIds: [brandId], campaignIds: [route.campaignId], sourceIds: [route.sourceId], scope: role === 'gms_super_admin' ? 'all' : 'assigned', permissions: ['lead.read', 'lead.update', 'appointment.manage'], role, status: 'active', assignedBy: 'server:beta-bootstrap', createdAt: now, updatedAt: now };
    batch.set(assignmentRef, assignment);
    batch.set(db.doc(`agentUsers/${agent.id}/assignments/${tenantId}`), { ...assignment, assignmentId: assignmentRef.id }, { merge: true });
    const gmsAssignmentRef = db.collection('agentAssignments').doc();
    const gmsAssignment = { ...assignment, tenantId: gmsTenantId, industry: 'business-services', brandId: gmsBrandId, brandIds: [gmsBrandId], campaignIds: [gmsRoute.campaignId], sourceIds: [gmsRoute.sourceId] };
    batch.set(gmsAssignmentRef, gmsAssignment);
    batch.set(db.doc(`agentUsers/${agent.id}/assignments/${gmsTenantId}`), { ...gmsAssignment, assignmentId: gmsAssignmentRef.id }, { merge: true });
  }
  batch.set(db.collection(`tenants/${tenantId}/auditLogs`).doc(), { tenantId, actorUid: 'server:beta-bootstrap', action: 'beta.provisioned', target: tenantId, metadata: { brandId, routeKey, agentCount: agents.size }, occurredAt: now, createdAt: now });
  batch.set(db.collection(`tenants/${gmsTenantId}/auditLogs`).doc(), { tenantId: gmsTenantId, actorUid: 'server:beta-bootstrap', action: 'internal.sales.provisioned', target: gmsTenantId, metadata: { brandId: gmsBrandId, routeKey: gmsRoute.routeKey, agentCount: agents.size }, occurredAt: now, createdAt: now });
  await batch.commit();
  console.log(JSON.stringify({ ok: true, tenantId, brandId, routeKey, betaAdminEmail: betaEmail, betaAdminUid: betaUser?.uid || null, gmsTenantId, gmsBrandId, gmsRouteKey: gmsRoute.routeKey, agentCount: agents.size }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
