// One tenant-owned onboarding record. Provider secrets never enter this API.
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const policy = require('./client-onboarding-policy.cjs');
const db = getFirestore();
const options = { enforceAppCheck: false, maxInstances: 2, timeoutSeconds: 60 };
// These narrowly-scoped callables use fresh Auth records plus server-side role
// checks; the Agent client does not yet support App Check. No generic writes.
async function identity(request, adminOnly = true) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const user = await getAuth().getUser(request.auth.uid);
  if (user.disabled || user.customClaims?.mustChangePassword) throw new HttpsError('permission-denied', 'Account access is unavailable.');
  const admin = user.customClaims?.lmsSuperAdmin === true || user.customClaims?.platformAdmin === true;
  if (adminOnly && !admin) throw new HttpsError('permission-denied', 'GMS Super Admin access required.');
  return { user, admin };
}
function identifier(value) {
  try { return policy.id(value); } catch (error) { throw new HttpsError('invalid-argument', error.message); }
}
async function access(request, tenantId, adminOnly = true) {
  const caller = await identity(request, adminOnly);
  if (!caller.admin) {
    const member = await db.doc(`tenants/${tenantId}/members/${caller.user.uid}`).get();
    if (!member.exists || member.data().active !== true || !['client_admin', 'client_supervisor'].includes(member.data().role) || member.data().brandIds?.length) {
      throw new HttpsError('permission-denied', 'Full client administrator membership required.');
    }
  }
  return caller;
}
const plain = snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
async function workspace(tenantId, reader) {
  const root = db.doc(`tenants/${tenantId}`);
  const [tenant, onboarding, connections, approvals, documents, members, assignments, brands, campaigns] = await Promise.all([
    root.get(), root.collection('config').doc('onboarding').get(), root.collection('integrations').doc('readiness').get(),
    root.collection('campaignApprovals').get(), root.collection('documents').get(), root.collection('members').get(),
    db.collection('agentAssignments').where('tenantId', '==', tenantId).get(), root.collection('brands').get(), root.collection('campaigns').get(),
  ]);
  if (!tenant.exists || tenant.data().demo === true) throw new HttpsError('not-found', 'Production client not found.');
  const saved = onboarding.data();
  const data = saved?.data || {
    name: tenant.data().name || '', legalName: tenant.data().legalName || '', industry: tenant.data().industry || '',
    brandName: brands.docs[0]?.data().name || '', adminEmail: '', timezone: 'America/Chicago',
    campaigns: plain(campaigns).filter(c => c.managedBy === 'onboarding'),
  };
  const approvalMap = Object.fromEntries(approvals.docs.map(doc => [doc.id, doc.data()]));
  const activeAgents = assignments.docs.filter(doc => doc.data().status === 'active' && doc.data().role === 'agent').map(doc => doc.data().agentUid);
  const availableDocs = documents.docs.filter(doc => doc.data().archived !== true).map(doc => doc.id);
  const memberReady = members.docs.some(doc => doc.data().active === true && doc.data().email?.toLowerCase() === data.adminEmail && doc.data().role === 'client_admin');
  const readiness = policy.readiness(data, {
    connections: connections.data() || {}, approvals: approvalMap, membershipReady: memberReady,
    agentsReady: (data.campaigns || []).every(c => c.agentUids?.every(uid => activeAgents.includes(uid))),
    documentsReady: (data.campaigns || []).every(c => c.documentIds?.every(id => availableDocs.includes(id))),
  });
  return {
    tenantId, data: reader.admin ? data : { ...data, notes: '', billingNotes: '', adminEmail: '', phoneSid: '' }, revision: saved?.revision || 0, lifecycle: saved?.lifecycle || 'not_started', readiness,
    approvals: approvalMap, campaignVersions: Object.fromEntries((data.campaigns || []).map(c => [c.id, policy.campaignVersion(c)])), documents: plain(documents).filter(doc => doc.archived !== true).map(doc => ({ id: doc.id, name: doc.name, category: doc.category, storagePath: doc.storagePath })),
    ...(reader.admin ? { activeAgents } : {}),
  };
}
exports.listGmsClients = onCall(options, async request => {
  await identity(request);
  const tenants = await db.collection('tenants').where('demo', '==', false).limit(200).get();
  const clients = await Promise.all(tenants.docs.filter(tenant => tenant.data().workspaceKind !== 'internal').map(async tenant => {
    const record = await tenant.ref.collection('config').doc('onboarding').get();
    const saved = record.data();
    return { tenantId: tenant.id, name: tenant.data().name || tenant.id, industry: tenant.data().industry || '', lifecycle: saved?.lifecycle || 'not_started', revision: saved?.revision || 0 };
  }));
  const assignments = await db.collection('agentAssignments').where('status','==','active').limit(100).get();
  const ids = [...new Set(assignments.docs.filter(d => d.data().role === 'agent').map(d => d.data().agentUid).filter(Boolean))];
  const users = ids.length ? (await getAuth().getUsers(ids.map(uid => ({uid})))).users : [];
  const agents = users.filter(u => !u.disabled).map(u => ({uid:u.uid,name:u.displayName || u.email || u.uid}));
  return { clients: clients.sort((a, b) => a.name.localeCompare(b.name)), agents, truncated: tenants.size === 200 };
});
exports.getGmsClient = onCall(options, async request => {
  const tenantId = identifier(request.data?.clientId);
  const reader = await access(request, tenantId, false);
  return workspace(tenantId, reader);
});
exports.saveGmsClient = onCall(options, async request => {
  const caller = await identity(request);
  const tenantId = identifier(request.data?.clientId);
  let data;
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(tenantId)) throw new HttpsError('invalid-argument', 'Client identifiers use lowercase letters, numbers and hyphens, up to 40 characters.');
  try { data = policy.normalize(request.data?.data); } catch (error) { throw new HttpsError('invalid-argument', error.message); }
  const expectedRevision = Number(request.data?.revision);
  const chosenAgents = [...new Set(data.campaigns.flatMap(c => c.agentUids))];
  if (chosenAgents.length > 30) throw new HttpsError('invalid-argument','Choose no more than 30 agents per client.');
  const authAgents = chosenAgents.length ? await getAuth().getUsers(chosenAgents.map(uid => ({uid}))) : {users:[],notFound:[]};
  if (authAgents.notFound.length || authAgents.users.some(u => u.disabled)) throw new HttpsError('failed-precondition','Selected agents must have active Firebase identities.');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new HttpsError('invalid-argument', 'Revision required.');
  const root = db.doc(`tenants/${tenantId}`);
  const config = root.collection('config').doc('onboarding');
  const now = FieldValue.serverTimestamp();
  // Existing identity only. Never silently create a Firebase user with a guessed
  // password or bind an existing platform administrator as a client account.
  let clientUser = null;
  if (data.adminEmail) {
    try { clientUser = await getAuth().getUserByEmail(data.adminEmail); }
    catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    if (clientUser && (clientUser.disabled || clientUser.customClaims?.lmsSuperAdmin || clientUser.customClaims?.platformAdmin)) {
      throw new HttpsError('failed-precondition', 'Use a separate customer administrator email, not a GMS staff administrator.');
    }
  }
  await db.runTransaction(async tx => {
    const [tenant, prior] = await Promise.all([tx.get(root), tx.get(config)]);
    if (tenant.exists && tenant.data().demo === true) throw new HttpsError('failed-precondition', 'Demo clients are managed separately.');
    if (!tenant.exists && request.data?.create !== true) throw new HttpsError('not-found', 'Client not found.');
    if (tenant.exists && request.data?.create === true) throw new HttpsError('already-exists', 'This client identifier already exists.');
    if ((prior.data()?.revision || 0) !== expectedRevision) throw new HttpsError('aborted', 'Another administrator saved this client. Reload before editing.');
    // A unique location registry makes cross-customer location reuse impossible.
    const mapping = data.locationId ? db.doc(`ghlLocationTenants/${data.locationId}`) : null;
    const previousLocation = prior.data()?.data?.locationId;
    const oldMapping = previousLocation && previousLocation !== data.locationId ? db.doc(`ghlLocationTenants/${previousLocation}`) : null;
    const mapped = mapping ? await tx.get(mapping) : null;
    const oldMapped = oldMapping ? await tx.get(oldMapping) : null;
    if (mapped?.exists && mapped.data().tenantId !== tenantId) throw new HttpsError('already-exists', 'This GoHighLevel location belongs to another GMS client.');
    const agentSnapshots = await Promise.all(chosenAgents.map(uid => tx.get(db.collection('agentAssignments').where('agentUid','==',uid).limit(100))));
    if (agentSnapshots.some(query => !query.docs.some(doc => doc.data().status === 'active' && doc.data().role === 'agent'))) throw new HttpsError('failed-precondition', 'Select an existing active GMS agent.');
    const existingAssignments = await Promise.all(chosenAgents.map(uid => tx.get(db.doc(`agentUsers/${uid}/assignments/${tenantId}`))));
    if (existingAssignments.some(doc => doc.exists && doc.data().role !== 'agent')) throw new HttpsError('failed-precondition', 'An existing privileged assignment cannot be replaced with an agent assignment.');
    const docIds = [...new Set(data.campaigns.flatMap(c => c.documentIds))];
    const docSnapshots = await Promise.all(docIds.map(id => tx.get(root.collection('documents').doc(id))));
    if (docSnapshots.some(doc => !doc.exists || doc.data().archived === true || doc.data().managedBy !== 'onboarding')) throw new HttpsError('failed-precondition', 'Creative files must be uploaded through this client cabinet.');
    const brandId = prior.data()?.brandId || `brand-${tenantId}`;
    // Refuse collisions with existing operational records. Existing clients
    // retain their current campaigns; only centrally-owned records are updated.
    const previousCampaigns = prior.data()?.data?.campaigns || [];
    const allCampaignIds = [...new Set([...previousCampaigns, ...data.campaigns].map(c => c.id))];
    const campaignSnapshots = await Promise.all(allCampaignIds.map(id => tx.get(root.collection('campaigns').doc(id))));
    if (campaignSnapshots.some(doc => doc.exists && doc.data().managedBy !== 'onboarding')) throw new HttpsError('already-exists', 'A campaign identifier is already in use. Choose a different identifier.');
    const memberRef = clientUser ? root.collection('members').doc(clientUser.uid) : null;
    const member = memberRef ? await tx.get(memberRef) : null;
    if (member?.exists && (member.data().role !== 'client_admin' || member.data().brandIds?.length)) throw new HttpsError('failed-precondition', 'Existing membership scope must be reviewed before assigning client administrator access.');
    tx.set(root, { name: data.name, legalName: data.legalName || data.name, industry: data.industry, updatedAt: now,
      ...(!tenant.exists ? { tenantId, demo: false, environment: 'production', status: 'onboarding', createdBy: caller.user.uid, createdAt: now } : {}),
    }, { merge: true });
    tx.set(config, { data, brandId, revision: expectedRevision + 1, lifecycle: 'draft', updatedBy: caller.user.uid, updatedAt: now });
    for (const [index, agentUid] of chosenAgents.entries()) {
      const previous = existingAssignments[index].data() || {};
      const assignment = { tenantId,agentUid,industry:data.industry,role:'agent',status:'active',scope:'assigned',
        brandId:previous.brandId || brandId,brandIds:[...new Set([...(previous.brandIds || []),previous.brandId,brandId].filter(Boolean))],
        campaignIds:[...new Set([...(previous.campaignIds || []),...data.campaigns.filter(c => c.agentUids.includes(agentUid)).map(c => c.id)])],
        permissions:['lead.read','lead.update','appointment.manage'],assignedBy:caller.user.uid,updatedAt:now };
      tx.set(db.doc(`agentUsers/${agentUid}/assignments/${tenantId}`),assignment,{merge:true});
      tx.set(db.doc(`agentAssignments/${tenantId}--${agentUid}`),assignment,{merge:true});
    }
    tx.set(root.collection('organizations').doc('default'), { tenantId, name: data.name, legalName: data.legalName, settings: { timezone: data.timezone, domain: data.domain }, status: 'onboarding', updatedAt: now }, { merge: true });
    tx.set(root.collection('brands').doc(brandId), { tenantId, brandId, name: data.brandName || data.name, domain: data.domain, industryId: data.industry, status: 'onboarding', managedBy: 'onboarding', updatedAt: now }, { merge: true });
    if (mapping) tx.set(mapping, { tenantId, updatedAt: now });
    if (oldMapped?.data()?.tenantId === tenantId) tx.delete(oldMapping);
    // Any edit pauses managed routes and invalidates approvals through version
    // hashes. Old approval evidence remains immutable in the audit history.
    for (const campaignId of allCampaignIds) {
      tx.set(root.collection('campaigns').doc(campaignId), { status: 'paused', updatedAt: now }, { merge: true });
      tx.set(db.doc(`ingestionRoutes/${tenantId}--${campaignId}`), { tenantId, status: 'paused', updatedAt: now }, { merge: true });
    }
    for (const c of data.campaigns) {
      const routeKey = `${tenantId}--${c.id}`;
      tx.set(root.collection('campaigns').doc(c.id), { ...c, tenantId, brandId, managedBy: 'onboarding', status: 'paused', startDate: null, endDate: null, updatedAt: now }, { merge: true });
      tx.set(root.collection('leadSources').doc(c.id), { tenantId, brandId, name: c.source, type: c.type, campaignId: c.id, status: 'paused', managedBy: 'onboarding', updatedAt: now }, { merge: true });
      tx.set(root.collection('scripts').doc(c.id), { tenantId, brandId, name: c.name, body: c.script, status: 'draft', version: expectedRevision + 1, managedBy: 'onboarding', updatedAt: now }, { merge: true });
      tx.set(root.collection('qualificationForms').doc(c.id), { tenantId, brandId, name: c.name, fields: c.qualification.split('\n').filter(Boolean).map((label, i) => ({ id: `question-${i + 1}`, label, type: 'text', required: true })), status: 'draft', version: expectedRevision + 1, managedBy: 'onboarding', updatedAt: now }, { merge: true });
      tx.set(root.collection('routingRules').doc(c.id), { tenantId, brandId, name: c.name, priority: 1, conditions: [{ field: 'campaignId', operator: 'equals', value: c.id }], destination: { type: 'agent_rotation', agentUids: c.agentUids }, status: 'paused', managedBy: 'onboarding', updatedAt: now }, { merge: true });
      tx.set(db.doc(`ingestionRoutes/${routeKey}`), { tenantId, brandId, industryId: data.industry || 'general', campaignId: c.id, sourceId: c.id, routingProfileId: c.id, scriptSetId: c.id, qualificationFormId: c.id, consentPolicyId: `${tenantId}-consent`, retentionPolicyId: `${tenantId}-retention`, workflowVersion: 'gms-onboarding-v1', assignedAgentUids: c.agentUids, locationId: data.locationId, consentPolicy: { text: c.consent, requireConsent: true }, retentionPolicy: { retentionDays: 2555 }, notificationProfile: { channels: ['in_app'] }, status: 'paused', managedBy: 'onboarding', updatedAt: now }, { merge: true });
    }
    if (data.phoneNumber) tx.set(root.collection('phoneNumbers').doc('onboarding'), { tenantId, brandId, phoneNumber: data.phoneNumber, phoneSid: data.phoneSid, provider: 'twilio', status: 'unverified', assignedTo: null, managedBy: 'onboarding', updatedAt: now }, { merge: true });
    if (memberRef) {
      tx.set(memberRef, { tenantId, uid: clientUser.uid, email: data.adminEmail, role: 'client_admin', active: true, updatedAt: now }, { merge: true });
      tx.set(root.collection('businessOwners').doc(`onboarding-${clientUser.uid}`), { tenantId, brandId, uid:clientUser.uid, memberUid:clientUser.uid, name:clientUser.displayName || `${data.name} administrator`, email:data.adminEmail, phone:data.phone, roleType:'client_contact', routingEligible:Boolean(data.phone), status:'active', managedBy:'onboarding', updatedAt:now }, { merge:true });
    }
    tx.set(root.collection('config').doc('clientAccess'), { adminEmail: data.adminEmail, status: clientUser ? 'active' : 'identity_required', updatedAt: now });
    const adminAssignment = { tenantId, agentUid: caller.user.uid, role: 'admin', status: 'active', scope: 'all', industry: data.industry, tenantName: data.name, updatedAt: now };
    tx.set(db.doc(`agentUsers/${caller.user.uid}/assignments/${tenantId}`), adminAssignment, { merge: true });
    tx.set(db.doc(`agentAssignments/${tenantId}--${caller.user.uid}`), adminAssignment, { merge: true });
    tx.set(root.collection('auditLogs').doc(), { tenantId, action: 'client.onboarding_saved', actorUid: caller.user.uid, revision: expectedRevision + 1, createdAt: now });
  });
  return workspace(tenantId, caller);
});
exports.recordGmsCampaignApproval = onCall(options, async request => {
  const tenantId = identifier(request.data?.clientId);
  const caller = await access(request, tenantId, false);
  if (caller.admin) throw new HttpsError('permission-denied', 'Approval must come from the client administrator, not GMS staff.');
  const campaignId = identifier(request.data?.campaignId);
  const decision = request.data?.decision;
  if (!['approved', 'changes_requested'].includes(decision)) throw new HttpsError('invalid-argument', 'Choose approve or request changes.');
  const root = db.doc(`tenants/${tenantId}`);
  await db.runTransaction(async tx => {
    const config = await tx.get(root.collection('config').doc('onboarding'));
    const c = config.data()?.data?.campaigns?.find(c => c.id === campaignId);
    if (!c) throw new HttpsError('not-found', 'Campaign not found.');
    const version = policy.campaignVersion(c);
    if (request.data?.version !== version) throw new HttpsError('aborted', 'Campaign changed. Reload and review the latest version.');
    const evidence = { tenantId, campaignId, status: decision, version, actorUid: caller.user.uid, actorEmail: caller.user.email || '', note: String(request.data?.note || '').trim().slice(0, 2000), createdAt: FieldValue.serverTimestamp() };
    tx.set(root.collection('campaignApprovals').doc(campaignId), evidence);
    tx.set(root.collection('auditLogs').doc(), { ...evidence, action: 'campaign.client_approval' });
    // A request for changes immediately stops managed intake for this campaign.
    if (decision !== 'approved') {
      tx.set(db.doc(`ingestionRoutes/${tenantId}--${campaignId}`), { status: 'paused' }, { merge: true });
      tx.set(root.collection('campaigns').doc(campaignId), { status: 'paused' }, { merge: true });
      tx.update(config.ref, { lifecycle: 'changes_requested' });
    }
  });
  return { recorded: true };
});
exports.addGmsClientDocument = onCall(options, async request => {
  const caller = await identity(request);
  const tenantId = identifier(request.data?.clientId);
  const documentId = identifier(request.data?.documentId);
  const root = db.doc(`tenants/${tenantId}`);
  if (!(await root.get()).exists) throw new HttpsError('not-found', 'Save the client before uploading files.');
  const storagePath = String(request.data?.storagePath || '');
  if (!storagePath.startsWith(`tenants/${tenantId}/documents/${documentId}/`) || storagePath.includes('..')) throw new HttpsError('invalid-argument', 'Invalid client file path.');
  const [metadata] = await getStorage().bucket().file(storagePath).getMetadata();
  const record = { tenantId, name: String(request.data?.name || '').slice(0, 300), storagePath, category: 'Campaign creative & onboarding', contentType: metadata.contentType, sizeBytes: Number(metadata.size), createdBy: caller.user.uid, createdAt: FieldValue.serverTimestamp(), status: 'active', managedBy: 'onboarding' };
  await db.runTransaction(async tx => {
    const ref = root.collection('documents').doc(documentId);
    if ((await tx.get(ref)).exists) throw new HttpsError('already-exists', 'File record already exists.');
    tx.create(ref, record);
    tx.set(root.collection('auditLogs').doc(), { tenantId, action: 'client.document_added', documentId, actorUid: caller.user.uid, createdAt: FieldValue.serverTimestamp() });
  });
  return { documentId };
});

exports.prepareGmsClientLogin = onCall(options, async request => {
  const caller = await identity(request);
  const tenantId = identifier(request.data?.clientId);
  const root = db.doc(`tenants/${tenantId}`);
  const configRef = root.collection('config').doc('onboarding');
  const saved = await configRef.get();
  const email = saved.data()?.data?.adminEmail;
  if (!email) throw new HttpsError('failed-precondition', 'Save a customer administrator email first.');
  let user;
  try { user = await getAuth().getUserByEmail(email); }
  catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    try { user = await getAuth().createUser({ email, password: require('node:crypto').randomBytes(32).toString('base64url') }); }
    catch (e) { if (e.code !== 'auth/email-already-exists') throw e; user = await getAuth().getUserByEmail(email); }
  }
  if (user.disabled || user.customClaims?.lmsSuperAdmin || user.customClaims?.platformAdmin) throw new HttpsError('failed-precondition', 'This email cannot be used as a customer administrator.');
  await db.runTransaction(async tx => {
    const current = await tx.get(configRef);
    const memberRef = root.collection('members').doc(user.uid);
    const member = await tx.get(memberRef);
    if (current.data()?.data?.adminEmail !== email) throw new HttpsError('aborted', 'Customer email changed. Reload the client.');
    if (member.exists && (member.data().role !== 'client_admin' || member.data().brandIds?.length)) throw new HttpsError('failed-precondition', 'Existing membership scope requires review.');
    tx.set(memberRef, { tenantId, uid:user.uid, email, role:'client_admin', active:true, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    const data = current.data().data;
    tx.set(root.collection('businessOwners').doc(`onboarding-${user.uid}`), { tenantId, brandId:current.data().brandId, uid:user.uid, memberUid:user.uid, name:user.displayName || `${data.name} administrator`, email, phone:data.phone, roleType:'client_contact', routingEligible:Boolean(data.phone), status:'active', managedBy:'onboarding', updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    tx.set(root.collection('config').doc('clientAccess'), { adminEmail:email, status:'active', updatedAt:FieldValue.serverTimestamp() });
    tx.set(root.collection('auditLogs').doc(), { tenantId, action:'client.identity_prepared', actorUid:caller.user.uid, target:user.uid, createdAt:FieldValue.serverTimestamp() });
  });
  const setupLink = await getAuth().generatePasswordResetLink(email, { url:'https://customer.goldenmarketingservices.com/login', handleCodeInApp:false });
  // Only returned to the GMS admin; never persist this credential/link or send email implicitly.
  return { setupLink, email, delivery:'not_sent' };
});

exports.enableGmsClientRouting = onCall(options, async request => {
  const caller = await identity(request);
  const tenantId = identifier(request.data?.clientId);
  const root = db.doc(`tenants/${tenantId}`);
  await db.runTransaction(async tx => {
    const configRef = root.collection('config').doc('onboarding');
    const [config, connections, approvals, members, documents, assignments] = await Promise.all([
      tx.get(configRef), tx.get(root.collection('integrations').doc('readiness')),
      tx.get(root.collection('campaignApprovals')), tx.get(root.collection('members')),
      tx.get(root.collection('documents')), tx.get(db.collection('agentAssignments').where('tenantId','==',tenantId)),
    ]);
    if (!config.exists || config.data().revision !== request.data?.revision) throw new HttpsError('aborted','Save and reload the current client version first.');
    const data = config.data().data;
    const activeAgents = assignments.docs.filter(d => d.data().status === 'active' && d.data().role === 'agent').map(d => d.data().agentUid);
    const proof = policy.readiness(data, {
      connections:connections.data() || {}, approvals:Object.fromEntries(approvals.docs.map(d => [d.id,d.data()])),
      membershipReady:members.docs.some(d => d.data().active === true && d.data().email === data.adminEmail && d.data().role === 'client_admin'),
      agentsReady:data.campaigns.every(c => c.agentUids.every(uid => activeAgents.includes(uid))),
      documentsReady:data.campaigns.every(c => c.documentIds.every(id => documents.docs.some(d => d.id === id && d.data().archived !== true))),
    });
    if (!proof.ready) throw new HttpsError('failed-precondition',`Launch blocked: ${proof.checks.filter(c => !c.ready).map(c => c.label).join('; ')}.`);
    tx.update(configRef,{ lifecycle:'routing_enabled', updatedAt:FieldValue.serverTimestamp(), updatedBy:caller.user.uid });
    for (const c of data.campaigns) {
      for (const collection of ['campaigns','leadSources','scripts','qualificationForms','routingRules']) tx.update(root.collection(collection).doc(c.id),{status:'active'});
      tx.update(db.doc(`ingestionRoutes/${tenantId}--${c.id}`),{status:'active',onboardingRevision:config.data().revision});
    }
    tx.set(root.collection('auditLogs').doc(),{tenantId,action:'client.routing_enabled',actorUid:caller.user.uid,revision:config.data().revision,createdAt:FieldValue.serverTimestamp()});
  });
  return workspace(tenantId,caller);
});
