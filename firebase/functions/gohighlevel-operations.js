const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { identifier, readRequest, publicRows, isExampleRow } = require('./gohighlevel-contract.cjs');
const { connectionVersion } = require('./client-onboarding-policy.cjs');
const { verifiedContact } = require('./gohighlevel-contact-policy.cjs');

// JSON lives in Secret Manager, NEVER tenant documents, Vite env vars or responses.
const integrationSecret = defineSecret('GMS_GOHIGHLEVEL_CONFIG');
const db = getFirestore();
// Match the existing invitation-only onboarding callable boundary. The current
// portal has no App Check client; fresh identity and explicit authorization apply.
const callable = { enforceAppCheck: false, maxInstances: 2, secrets: [integrationSecret], timeoutSeconds: 60 };
async function tokenFor(connection, settings) {
  if(connection.oauthSecretId) return require('./gohighlevel-oauth-store.cjs').locationToken(connection.locationId);
  return settings.locationTokens?.[connection.locationId] || null;
}

function config() {
  try {
    const value = JSON.parse(integrationSecret.value());
    if (!value.agencyToken && !Object.values(value.locationTokens || {}).some(token => typeof token === 'string' && token)) throw new Error();
    return value;
  } catch {
    throw new HttpsError('failed-precondition', 'GoHighLevel backend credentials are not configured.');
  }
}

async function authorize(request, tenantId, adminOnly = false) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  try { identifier(tenantId); } catch { throw new HttpsError('invalid-argument', 'Invalid tenant.'); }
  const user = await getAuth().getUser(request.auth.uid);
  if (user.disabled || user.customClaims?.mustChangePassword) throw new HttpsError('permission-denied', 'Account access is unavailable.');
  const claims = user.customClaims || {};
  if (claims.platformAdmin === true || claims.gmsSuperAdmin === true) return { fullTenant: true };
  if (adminOnly) throw new HttpsError('permission-denied', 'GMS Super Admin is required.');
  // Until record-level brand filtering is integrated, location-wide reads are
  // limited to full-tenant administrators. A scoped agent must not see all brands.
  const member = await db.doc(`tenants/${tenantId}/members/${user.uid}`).get();
  const data = member.data();
  if (data?.active && ['admin', 'client_admin', 'client_supervisor', 'supervisor'].includes(data.role)
      && !data.brandId && !(Array.isArray(data.brandIds) && data.brandIds.length)) return { fullTenant: true };
  const assignment = (await db.doc(`agentUsers/${user.uid}/assignments/${tenantId}`).get()).data();
  if (assignment?.status !== 'active' || !['agent', 'lead_response_agent', 'supervisor', 'client_supervisor'].includes(assignment.role)) {
    throw new HttpsError('permission-denied', 'An active client assignment is required.');
  }
  return { fullTenant: false, uid: user.uid, assignment };
}

async function mappedConnection(tenantId) {
  const [tenant, onboarding, saved] = await Promise.all([
    db.doc(`tenants/${tenantId}`).get(),
    db.doc(`tenants/${tenantId}/config/onboarding`).get(),
    db.doc(`gmsProviderConnections/${tenantId}`).get(),
  ]);
  const data = onboarding.data()?.data;
  const connection = saved.data();
  if (!tenant.exists || tenant.data().demo === true || tenant.data().environment !== 'production'
      || !data?.locationId || connection?.locationId !== data.locationId) {
    throw new HttpsError('failed-precondition', 'Save the production client location and connect it first.');
  }
  const owner = await db.doc(`ghlLocationTenants/${data.locationId}`).get();
  if (owner.data()?.tenantId !== tenantId) throw new HttpsError('permission-denied', 'Location ownership is not verified.');
  return { connection, data, revision: onboarding.data().revision };
}

async function api(path, token, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`https://services.leadconnectorhq.com${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, Version: 'v3', Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'GMS-CRM/1.0' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new HttpsError('unavailable', 'GoHighLevel could not be reached.');
  }
  if (!response.ok) {
    // Never reflect provider errors: they can include credentials or customer PII.
    const code = response.status === 429 ? 'resource-exhausted' : response.status === 401 || response.status === 403 ? 'failed-precondition' : 'unavailable';
    throw new HttpsError(code, `GoHighLevel request failed (${response.status}).`, { providerStatus: response.status });
  }
  try { return await response.json(); } catch { throw new HttpsError('data-loss', 'Invalid provider response.'); }
}

exports.getGoHighLevelConnection = onCall({ enforceAppCheck: false, maxInstances: 2 }, async (request) => {
  const tenantId = request.data?.tenantId;
  await authorize(request, tenantId, true);
  const { connection } = await mappedConnection(tenantId);
  return { provider: 'GoHighLevel', status: connection?.status || 'not_connected', locationId: connection?.locationId || null,
    snapshotId: connection?.snapshotId || null, messagingEnabled: false };
});

exports.performGoHighLevelAction = onCall(callable, async request=>{
  const {tenantId,leadId,action,commandId,input={}}=request.data || {};
  const access=await authorize(request,tenantId);
  try {identifier(leadId);identifier(commandId);} catch {throw new HttpsError('invalid-argument','Lead and unique operation identifiers are required.');}
  const lead=(await db.doc(`tenants/${tenantId}/leads/${leadId}`).get()).data();
  if(!lead || lead.tenantId!==tenantId) throw new HttpsError('not-found','Lead not found.');
  if(!access.fullTenant) {
    const brands=[access.assignment?.brandId,...(access.assignment?.brandIds || [])].filter(Boolean);
    if(!brands.includes(lead.brandId) || lead.assignedTo!==access.uid) throw new HttpsError('permission-denied','Lead is outside your assignment.');
    if(action==='update_contact') throw new HttpsError('permission-denied','Client administration is required to change contact identity.');
  }
  const {connection}=await mappedConnection(tenantId);
  if(connection.status!=='connected') throw new HttpsError('failed-precondition','Verify the client connection first.');
  const mapping=(await db.doc(`gmsProviderContacts/${tenantId}/leads/${leadId}`).get()).data();
  if(!mapping?.contactId || mapping.locationId!==connection.locationId) throw new HttpsError('failed-precondition','Link the authorized lead to its client contact first.');
  const token=await tokenFor(connection,config());
  if(!token) throw new HttpsError('failed-precondition','Location credential is required.');
  let operation;
  try {operation=require('./gohighlevel-workflow-policy.cjs').workflowRequest(action,input,{contactId:mapping.contactId,locationId:connection.locationId});}
  catch(error) {throw new HttpsError('invalid-argument',error.message);}
  const contact=(await api(`/contacts/${identifier(mapping.contactId)}`,token)).contact;
  if(contact?.id!==mapping.contactId || contact.locationId!==connection.locationId) throw new HttpsError('permission-denied','Contact ownership could not be verified.');
  if(operation.verify) {
    const {type,id}=operation.verify;
    const payload=await api(type==='calendar'?`/calendars/${id}`:`/opportunities/${id}`,token);
    const record=payload[type];
    if(record?.locationId!==connection.locationId || (type==='opportunity' && record.contactId!==mapping.contactId)) throw new HttpsError('permission-denied','Resource is outside this client or lead.');
  }
  const crypto=require('node:crypto');
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify({actor:request.auth.uid,leadId,operation})).digest('hex');
  const ref=db.doc(`gmsProviderOperations/${tenantId}/operations/${commandId}`);
  const prior=await db.runTransaction(async tx=>{
    const saved=await tx.get(ref);
    if(saved.exists) {
      if(saved.data().fingerprint!==fingerprint) throw new HttpsError('already-exists','Operation identifier was used for different changes.');
      return saved.data();
    }
    tx.create(ref,{tenantId,leadId,actorUid:request.auth.uid,action,fingerprint,status:'in_flight',createdAt:FieldValue.serverTimestamp()});
    return null;
  });
  if(prior?.status==='succeeded') return {ok:true,commandId,status:'succeeded',providerRecordId:prior.providerRecordId || null};
  if(prior) throw new HttpsError('failed-precondition','This operation needs reconciliation before retrying.');
  try {
    const result=await api(operation.path,token,operation);
    const providerRecordId=result.note?.id || result.task?.id || result.contact?.id || result.opportunity?.id || result.id || null;
    const batch=db.batch();
    batch.update(ref,{status:'succeeded',providerRecordId,completedAt:FieldValue.serverTimestamp()});
    batch.create(db.collection(`tenants/${tenantId}/auditLogs`).doc(),{tenantId,brandId:lead.brandId,actorUid:request.auth.uid,action:`gohighlevel.${action}`,target:leadId,commandId,createdAt:FieldValue.serverTimestamp()});
    await batch.commit();
    return {ok:true,commandId,status:'succeeded',providerRecordId};
  } catch(error) {
    await ref.update({status:'needs_reconciliation',updatedAt:FieldValue.serverTimestamp()});
    throw error;
  }
});

exports.readGoHighLevelResource = onCall(callable, async (request) => {
  const { tenantId, resource } = request.data || {};
  const access = await authorize(request, tenantId);
  let contactId;
  if (!access.fullTenant || request.data.leadId) {
    if (resource !== 'conversations' || !request.data.leadId) throw new HttpsError('permission-denied', 'Agents can read only an assigned lead conversation.');
    let leadId;
    try { leadId = identifier(request.data.leadId); } catch { throw new HttpsError('invalid-argument', 'Invalid lead.'); }
    const lead = (await db.doc(`tenants/${tenantId}/leads/${leadId}`).get()).data();
    const brands = [access.assignment?.brandId, ...(access.assignment?.brandIds || [])].filter(Boolean);
    const supervisor = ['supervisor', 'client_supervisor'].includes(access.assignment?.role);
    if (!lead || (!access.fullTenant && (!lead.brandId || !brands.length || !brands.includes(lead.brandId) || (!supervisor && lead.assignedTo !== access.uid)))) {
      throw new HttpsError('permission-denied', 'Lead is outside your assignment.');
    }
    // This mapping is backend-owned, never taken from a browser-writable lead field.
    const mapping = (await db.doc(`gmsProviderContacts/${tenantId}/leads/${leadId}`).get()).data();
    if (!mapping?.contactId) throw new HttpsError('failed-precondition', 'This lead has not been linked to its GoHighLevel contact.');
    const { connection } = await mappedConnection(tenantId);
    if (mapping.locationId !== connection.locationId) throw new HttpsError('permission-denied', 'Contact location does not match this client.');
    try { contactId = identifier(mapping.contactId); } catch { throw new HttpsError('failed-precondition', 'Invalid contact mapping.'); }
  }
  const { connection } = await mappedConnection(tenantId);
  if (connection?.status !== 'connected' || !connection.locationId) throw new HttpsError('failed-precondition', 'Tenant is not connected to GoHighLevel.');
  const settings = config();
  // Private location tokens are explicitly scoped per location. OAuth auto-install
  // and refresh are a separate connection mode, not assumed to work with an agency PIT.
  const token = await tokenFor(connection, settings);
  if (!token) throw new HttpsError('failed-precondition', 'A location-scoped GoHighLevel credential is required.');
  let operation;
  try { operation = readRequest(resource, connection.locationId, request.data); }
  catch (error) { throw new HttpsError('invalid-argument', error.message); }
  if (contactId) {
    const url = new URL(operation.path, 'https://services.leadconnectorhq.com');
    url.searchParams.delete('query');
    url.searchParams.set('contactId', contactId);
    operation.path = url.pathname + url.search;
  }
  const payload = await api(operation.path, token);
  if (contactId && (!Array.isArray(payload.conversations) || payload.conversations.some(row => row.contactId !== contactId))) {
    throw new HttpsError('data-loss', 'Provider response did not match the assigned contact.');
  }
  try {
    const rows = publicRows(operation.key, payload, connection.locationId);
    return { source: 'GoHighLevel', resource, items: rows.filter(row => !isExampleRow(row)),
      excludedExampleCount: rows.filter(isExampleRow).length, fetchedAt: new Date().toISOString() };
  }
  catch { throw new HttpsError('data-loss', 'Provider response did not match the authorized location.'); }
});


exports.linkGoHighLevelContact = onCall(callable, async (request) => {
  const { tenantId, leadId, contactId } = request.data || {};
  await authorize(request, tenantId, true);
  try { identifier(leadId); identifier(contactId); }
  catch { throw new HttpsError('invalid-argument', 'Invalid lead or contact.'); }
  const { connection, revision } = await mappedConnection(tenantId);
  if (connection.status !== 'connected') throw new HttpsError('failed-precondition', 'Verify the client connection first.');
  const token = await tokenFor(connection, config());
  if (!token) throw new HttpsError('failed-precondition', 'Location credential is required.');
  const payload = await api(`/contacts/${contactId}`, token);
  const leadRef = db.doc(`tenants/${tenantId}/leads/${leadId}`);
  const mappingRef = db.doc(`gmsProviderContacts/${tenantId}/leads/${leadId}`);
  const ownerRef = db.doc(`gmsProviderContactOwners/${connection.locationId}/contacts/${contactId}`);
  await db.runTransaction(async tx => {
    const [lead, mapping, owner, onboarding, current, locationOwner] = await Promise.all([
      tx.get(leadRef), tx.get(mappingRef), tx.get(ownerRef),
      tx.get(db.doc(`tenants/${tenantId}/config/onboarding`)),
      tx.get(db.doc(`gmsProviderConnections/${tenantId}`)),
      tx.get(db.doc(`ghlLocationTenants/${connection.locationId}`)),
    ]);
    if (!lead.exists) throw new HttpsError('not-found', 'Lead does not exist.');
    if (onboarding.data()?.revision !== revision || current.data()?.locationId !== connection.locationId
        || current.data()?.status !== 'connected' || locationOwner.data()?.tenantId !== tenantId) {
      throw new HttpsError('aborted', 'Client connection changed. Verify it again.');
    }
    let verified;
    try { verified = verifiedContact(payload.contact, lead.data(), connection.locationId, contactId); }
    catch { throw new HttpsError('failed-precondition', 'Provider contact location and identity must match the saved lead.'); }
    if ((mapping.exists && (mapping.data().contactId !== contactId || mapping.data().locationId !== connection.locationId))
        || (owner.exists && (owner.data().tenantId !== tenantId || owner.data().leadId !== leadId))) {
      throw new HttpsError('already-exists', 'Contact or lead already has a different mapping.');
    }
    const now = FieldValue.serverTimestamp();
    tx.set(mappingRef, { ...verified, tenantId, leadId, verifiedAt: now, actorUid: request.auth.uid });
    tx.set(ownerRef, { tenantId, leadId, locationId: connection.locationId, contactId, updatedAt: now });
    tx.set(db.collection(`tenants/${tenantId}/auditLogs`).doc(), {
      tenantId, actorUid: request.auth.uid, action: 'gohighlevel.contact.linked', target: leadId, occurredAt: now,
    });
  });
  return { status: 'linked', leadId };
});

exports.connectExistingGoHighLevelLocation = onCall(callable, async (request) => {
  const { tenantId, locationId } = request.data || {};
  await authorize(request, tenantId, true);
  try { identifier(locationId); } catch { throw new HttpsError('invalid-argument', 'Invalid location.'); }
  const settings = config();
  const savedConnection=(await db.doc(`gmsProviderConnections/${tenantId}`).get()).data();
  const token = savedConnection?.locationId===locationId && savedConnection.oauthSecretId
    ? await tokenFor(savedConnection, settings) : settings.locationTokens?.[locationId] || settings.agencyToken;
  if (!token) throw new HttpsError('failed-precondition', 'This location needs its own API authorization.');
  const payload = await api(`/locations/${locationId}`, token);
  const location = payload.location || payload;
  if (location.id !== locationId || (settings.companyId && location.companyId !== settings.companyId)) throw new HttpsError('permission-denied', 'Sub-account does not belong to the configured agency.');
  const tenantRef = db.doc(`tenants/${tenantId}`);
  const connectionRef = db.doc(`gmsProviderConnections/${tenantId}`);
  const ownerRef = db.doc(`ghlLocationTenants/${locationId}`);
  const onboardingRef = db.doc(`tenants/${tenantId}/config/onboarding`);
  await db.runTransaction(async (transaction) => {
    const [tenant, connection, owner, onboarding] = await Promise.all([transaction.get(tenantRef), transaction.get(connectionRef), transaction.get(ownerRef), transaction.get(onboardingRef)]);
    if (!tenant.exists || tenant.data().demo === true || tenant.data().environment !== 'production') throw new HttpsError('failed-precondition', 'A production GMS tenant is required.');
    if (onboarding.data()?.data?.locationId !== locationId || owner.data()?.tenantId !== tenantId) throw new HttpsError('failed-precondition', 'Save this location in the client onboarding form first.');
    if (owner.exists && owner.data().tenantId !== tenantId) throw new HttpsError('already-exists', 'Sub-account is already owned by another GMS tenant.');
    const now = FieldValue.serverTimestamp();
    transaction.set(connectionRef, { tenantId, provider: 'GoHighLevel', companyId: location.companyId, locationId,
      status: 'awaiting_location_credential', actorUid: request.auth.uid, updatedAt: now }, { merge: true });
    transaction.set(ownerRef, { tenantId, locationId, updatedAt: now });
    transaction.update(tenantRef, { ghlLocationId: locationId, updatedAt: now });
    transaction.set(db.collection(`tenants/${tenantId}/auditLogs`).doc(), { tenantId, actorUid: request.auth.uid,
      action: 'gohighlevel.location.linked', target: locationId, occurredAt: now });
  });
  return { locationId, status: 'awaiting_location_credential' };
});

exports.verifyGoHighLevelConnection = onCall(callable, async (request) => {
  const tenantId = request.data?.tenantId;
  await authorize(request, tenantId, true);
  const ref = db.doc(`gmsProviderConnections/${tenantId}`);
  const { connection, data, revision } = await mappedConnection(tenantId);
  if (!connection?.locationId) throw new HttpsError('failed-precondition', 'Provision the tenant location first.');
  const settings = config();
  const token = await tokenFor(connection, settings);
  if (!token) throw new HttpsError('failed-precondition', 'Location credential has not been configured.');
  const checks = await Promise.all(['conversations', 'calendars', 'opportunities'].map(async (resource) => {
    const operation = readRequest(resource, connection.locationId, { limit: 1 });
    publicRows(operation.key, await api(operation.path, token), connection.locationId);
    return resource;
  }));
  await db.runTransaction(async tx => {
    const [current, onboarding, owner] = await Promise.all([
      tx.get(ref), tx.get(db.doc(`tenants/${tenantId}/config/onboarding`)),
      tx.get(db.doc(`ghlLocationTenants/${connection.locationId}`)),
    ]);
    if (current.data()?.locationId !== connection.locationId || onboarding.data()?.revision !== revision
        || connectionVersion(onboarding.data()?.data || {}) !== connectionVersion(data)
        || owner.data()?.tenantId !== tenantId) throw new HttpsError('aborted', 'Client settings changed. Run the connection check again.');
    tx.update(ref, { status: 'connected', verifiedResources: checks, verifiedAt: FieldValue.serverTimestamp() });
    // CRM verification cannot verify Telnyx or make an old phone proof fresh.
    tx.set(db.doc(`tenants/${tenantId}/integrations/readiness`), {
      configHash: connectionVersion(data), ghlVerified: true, phoneVerified: false, verifiedAtMs: Date.now(),
    });
    tx.set(db.collection(`tenants/${tenantId}/auditLogs`).doc(), {
      tenantId, actorUid: request.auth.uid, action: 'gohighlevel.connection.verified',
      target: connection.locationId, occurredAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: 'connected', verifiedResources: checks, messagingEnabled: false };
});
