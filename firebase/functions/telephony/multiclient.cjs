'use strict';

const crypto = require('node:crypto');
const { browserSession } = require('./browser-session.cjs');
const { configurationIssues } = require('./readiness.cjs');
const CAPABILITIES = ['read_communications', 'call', 'can_answer_calls'];
const ROLES = ['agent', 'supervisor', 'admin', 'client_admin', 'client_supervisor', 'auditor'];
const PHONE_ACTIONS = new Set(['browser_session', 'set_availability', 'health_check']);
const QUEUE_COLLECTIONS = { calls: 'callRecords', voicemail: 'callRecords', callbacks: 'followUpTasks' };
function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function environmentOf(row) {
  if (row?.demo === true || row?.isDemo === true || row?.environment === 'demo') return 'demo';
  if (row?.environment === undefined || row?.environment === 'production') return 'production';
  return 'unknown';
}
function activeGrant(row, now = Date.now()) {
  const at = value => value?.toMillis?.() ?? (typeof value === 'number' ? value : Date.parse(value));
  return row?.status === 'active' && row.enabled !== false && !row.revokedAt && !row.revoked_at &&
    (!row.effectiveAt || at(row.effectiveAt) <= now) && (!row.expiresAt || at(row.expiresAt) > now);
}
function brandOf(row) { return row?.brandId || row?.brand_id || null; }
function grantAllows(grant, row, capability) {
  if (!grant || !activeGrant(grant) || !grant.capabilities?.includes(capability)) return false;
  const brands = [...(grant.brandIds || []), ...(grant.brandId ? [grant.brandId] : [])];
  if (brands.length && (!brandOf(row) || !brands.includes(brandOf(row)))) return false;
  return typeof row.lineId === 'string' && Array.isArray(grant.lineIds) && grant.lineIds.includes(row.lineId);
}
function queueRow(snapshot, tenant) {
  const row = snapshot.data();
  // Never expose provider media URLs, credential IDs or arbitrary stored fields.
  return { id: snapshot.id, tenantId: tenant.id, clientId: tenant.id, clientName: tenant.name || tenant.id,
    brandId: brandOf(row), lineId: row.lineId || null, campaignId: row.campaignId || row.campaign_id || null,
    leadId: row.leadId || row.lead_id || null, agentUid: row.agentUid || null,
    caller: row.caller || row.destination || row.phone || null, direction: row.direction || null,
    status: row.status || null, readState: row.readState || 'unheard', followUpState: row.followUpState || 'pending',
    startedAt: row.startedAt || row.createdAt || null, dueAt: row.dueAt || row.due_date || null,
    hasMedia: !!(row.recordingUrl || row.voicemailUrl), environment: environmentOf(tenant),
    routingStatus: row.routingStatus || null };
}
function createMulticlient({ db, auth, HttpsError, FieldValue, env = process.env, provider, transport = (...args) => fetch(...args) }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const id = (value, label) => { if (!validId(value)) fail('invalid-argument', `Invalid ${label}.`); return value; };
  function deploymentEnvironment(requested) {
    const current = env.TELEPHONY_ENVIRONMENT || 'production';
    if (!['production', 'demo'].includes(current) || (requested !== undefined && requested !== current)) fail('permission-denied', 'Environment mismatch.');
    return current;
  }
  async function identity(request) {
    if (!request.auth?.uid) fail('unauthenticated', 'Authentication required.');
    const uid = id(request.auth.uid, 'user');
    const user = await auth.getUser(uid).catch(() => null);
    if (!user || user.disabled || user.customClaims?.mustChangePassword) fail('permission-denied', 'Account is unavailable.');
    // Re-check current claims. A stale ID token must not preserve revoked privilege.
    if (user.tokensValidAfterTime && request.auth.token?.iat && request.auth.token.iat * 1000 < Date.parse(user.tokensValidAfterTime)) fail('permission-denied', 'Sign in again.');
    return { uid, superAdmin: user.customClaims?.gmsSuperAdmin === true };
  }
  async function tenant(tenantId, environment) {
    id(tenantId, 'client');
    const snapshot = await db.doc(`tenants/${tenantId}`).get();
    const row = snapshot.exists ? snapshot.data() : null;
    if (!row || ['disabled', 'inactive', 'archived'].includes(row.status) || environmentOf(row) !== environment) fail('permission-denied', 'Client is unavailable in this environment.');
    return { ...row, id: tenantId };
  }
  async function scope(request, capability = 'read_communications') {
    const actor = await identity(request);
    const environment = deploymentEnvironment(request.data?.environment);
    let grants;
    if (actor.superAdmin) {
      const snapshots = await db.collection('tenants').get();
      grants = snapshots.docs.filter(doc => environmentOf(doc.data()) === environment && !['disabled', 'inactive', 'archived'].includes(doc.data().status))
        .map(doc => ({ tenantId: doc.id, tenant: { ...doc.data(), id: doc.id }, assignment: null }));
    } else {
      const snapshots = await db.collection(`agentUsers/${actor.uid}/assignments`).get();
      grants = [];
      for (const snapshot of snapshots.docs) {
        const row = snapshot.data();
        if (!activeGrant(row) || !ROLES.includes(row.role || 'agent') || (capability && !row.capabilities?.includes(capability))) continue;
        if (row.tenantId && row.tenantId !== snapshot.id) continue;
        const t = await db.doc(`tenants/${snapshot.id}`).get();
        if (!t.exists || environmentOf(t.data()) !== environment || ['disabled', 'inactive', 'archived'].includes(t.data().status)) continue;
        if (row.environment && row.environment !== environment) continue;
        grants.push({ tenantId: snapshot.id, tenant: { ...t.data(), id: snapshot.id }, assignment: row });
      }
      if (!grants.length) fail('permission-denied', 'An active operational assignment is required.');
    }
    const filter = request.data?.tenantId || request.data?.params?.tenantId;
    if (filter) {
      id(filter, 'client');
      if (!grants.some(grant => grant.tenantId === filter)) fail('permission-denied', 'Client is outside your assignments.');
      grants = grants.filter(grant => grant.tenantId === filter);
    }
    return { ...actor, environment, grants };
  }
  function allowed(context, grant, row, capability) {
    return row.tenantId === grant.tenantId && environmentOf(row) === context.environment &&
      (context.superAdmin || grantAllows(grant.assignment, row, capability));
  }
  async function authorize(request, tenantId, row, capability) {
    const context = await scope({ ...request, data: { ...request.data, tenantId } }, capability);
    const grant = context.grants.find(item => item.tenantId === tenantId);
    if (!grant || !allowed(context, grant, row, capability)) fail('permission-denied', 'Record or line is outside your operational grants.');
    return { ...context, assignment: grant.assignment, tenant: grant.tenant };
  }
  async function authorizeLead(request, tenantId, row) {
    const context = await scope({ ...request, data: { ...request.data, tenantId } }, 'call');
    if (row.tenantId !== tenantId || environmentOf(row) !== context.environment) fail('permission-denied', 'Lead environment mismatch.');
    const numbers = await db.collection(`tenants/${tenantId}/phoneNumbers`).where('brandId', '==', brandOf(row)).get();
    let number;
    try { number = require('./readiness.cjs').selectOutboundNumber(numbers.docs.map(doc => ({ ...doc.data(), lineId: doc.id })).filter(line => line.verified === true && environmentOf(line) === context.environment), 'telnyx', row.campaignId || row.campaign_id); }
    catch { fail('failed-precondition', 'Configure one verified outbound line for this lead.'); }
    await authorize(request, tenantId, { ...row, lineId: number.lineId }, 'call');
    return number;
  }
  async function lines(context, capability) {
    const rows = [];
    for (const grant of context.grants) {
      const snapshot = await db.collection(`tenants/${grant.tenantId}/phoneNumbers`).get();
      for (const doc of snapshot.docs) {
        const row = { ...doc.data(), tenantId: grant.tenantId, lineId: doc.id };
        if (row.status === 'active' && row.provider === 'telnyx' && row.verified === true && allowed(context, grant, row, capability))
          rows.push({ lineId: doc.id, tenantId: grant.tenantId, clientName: grant.tenant.name || grant.tenantId, brandId: brandOf(row), campaignId: row.campaignId || null, phoneNumber: row.phoneNumber });
      }
    }
    return rows;
  }
  function activation(environment) {
    // Demo endpoints can read fixtures; they cannot obtain production credentials or dial.
    if (environment !== 'production' || env.TELEPHONY_ENABLED !== 'true') fail('failed-precondition', 'Calling has not been activated.');
    if (configurationIssues(env).length) fail('failed-precondition', 'Calling has not passed activation checks.');
  }
  async function phone(request, action, params = {}) {
    const capability = action === 'health_check' ? null : action === 'set_availability' && params.status === 'available' ? 'can_answer_calls' : 'call';
    // A selected sidebar tenant is irrelevant to one user-level registration.
    const context = await scope({ ...request, data: { ...request.data, tenantId: undefined, params: { ...params, tenantId: undefined } } }, capability);
    const authorizedLines = await lines(context, capability);
    if (action === 'health_check') return { ok: true, provider: 'telnyx', configured: configurationIssues(env).length === 0,
      healthy: context.environment === 'production' && env.TELEPHONY_ENABLED === 'true' && !configurationIssues(env).length,
      mode: context.environment === 'production' && env.TELEPHONY_ENABLED === 'true' && !configurationIssues(env).length ? 'production' : 'unavailable', recordingPolicy: env.DEFAULT_RECORDING_POLICY || 'record_on_consent', warmTransferEnabled: env.TELEPHONY_WARM_TRANSFER_ENABLED === 'true', environment: context.environment, actorUid: context.uid, lines: authorizedLines };
    const presenceRef = db.doc(`telephonyPresence/${context.uid}`);
    if (action === 'set_availability') {
      if (!['offline', 'available', 'away', 'after_call_work'].includes(params.status)) fail('invalid-argument', 'Invalid availability.');
      if (params.status === 'available') { activation(context.environment); if (!authorizedLines.length) fail('permission-denied', 'No authorized receiving lines.'); }
      await presenceRef.set({ uid: context.uid, environment: context.environment, status: params.status,
        updatedAt: FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 60000) }, { merge: true });
      return { ok: true, status: params.status, heartbeatSeconds: 30 };
    }
    activation(context.environment);
    if (!authorizedLines.length && !context.superAdmin) fail('permission-denied', 'No authorized calling lines.');
    const provisioning = await db.doc(`telephonyIdentities/${context.uid}`).get();
    const row = provisioning.data();
    if (!provisioning.exists || row.enabled !== true || row.environment !== context.environment || row.connectionId !== env.TELNYX_CONNECTION_ID) fail('failed-precondition', 'User calling identity is not provisioned for this environment.');
    const owners = await db.collection('telephonyIdentities').where('telnyxCredentialId', '==', row.telnyxCredentialId || '').get();
    if (owners.size !== 1 || owners.docs[0].id !== context.uid) fail('failed-precondition', 'Calling credential must belong to one agent.');
    // Credential identity is user-scoped, never copied from a selected assignment.
    const session = await browserSession('telnyx', { token: provider().token }, `gms_${context.uid}`, row, transport);
    await presenceRef.set({ uid: context.uid, environment: context.environment, status: 'offline', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ...session, environment: context.environment, lines: authorizedLines, heartbeatSeconds: 30 };
  }
  async function queue(request) {
    const kind = request.data?.kind || 'calls';
    const collection = QUEUE_COLLECTIONS[kind];
    if (!collection) fail('invalid-argument', 'Invalid queue kind.');
    const context = await scope(request);
    const pageSize = Math.min(100, Math.max(1, Number(request.data?.limit) || 50));
    const cursor = request.data?.cursor;
    if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 300)) fail('invalid-argument', 'Invalid cursor.');
    const items = [];
    // Stable path ordering supplies deterministic pagination without trusting an
    // opaque cursor to convey permissions. Re-scope every page after revocation.
    for (const grant of context.grants.sort((a, b) => a.tenantId.localeCompare(b.tenantId))) {
      let query = db.collection(`tenants/${grant.tenantId}/${collection}`).orderBy('__name__');
      let after;
      if (cursor) {
        const parts = cursor.split('/');
        if (parts.length !== 2 || !parts.every(validId)) fail('invalid-argument', 'Invalid cursor.');
        if (grant.tenantId < parts[0]) continue;
        if (grant.tenantId === parts[0]) after = parts[1];
      }
      // Scan chunks until a full authorized page is assembled, so filtered
      // brands cannot make a nonempty queue appear empty.
      while (items.length <= pageSize) {
        const snapshots = await (after ? query.startAfter(after) : query).limit(100).get();
        for (const snapshot of snapshots.docs) {
          const row = snapshot.data();
          if (!allowed(context, grant, row, 'read_communications') || row.archived === true) continue;
          if (kind === 'voicemail' && !(row.voicemail === true || row.status === 'voicemail' || row.voicemailUrl)) continue;
          if (kind === 'callbacks' && !['callback_reminder', 'callback'].includes(row.task_type || row.taskType)) continue;
          items.push(queueRow(snapshot, grant.tenant));
          if (items.length > pageSize) break;
        }
        if (snapshots.docs.length < 100 || items.length > pageSize) break;
        after = snapshots.docs.at(-1).id;
      }
      if (items.length > pageSize) break;
    }
    const hasMore = items.length > pageSize; items.length = Math.min(items.length, pageSize);
    const last = items.at(-1);
    return { items, count: items.length, cursor: hasMore && last ? `${last.tenantId}/${last.id}` : null, environment: context.environment };
  }
  async function record(request, capability = 'read_communications') {
    const { tenantId, recordId, kind = 'calls' } = request.data || {};
    id(tenantId, 'client'); id(recordId, 'record');
    const collection = QUEUE_COLLECTIONS[kind];
    if (!collection) fail('invalid-argument', 'Invalid queue kind.');
    // Authorize client before checking record existence to avoid enumeration.
    await scope(request, capability);
    const ref = db.doc(`tenants/${tenantId}/${collection}/${recordId}`);
    const snapshot = await ref.get();
    if (!snapshot.exists) fail('not-found', 'Record not found.');
    const row = snapshot.data();
    const context = await authorize(request, tenantId, row, capability);
    return { ref, snapshot, row, context };
  }
  async function createCallback(request) {
    const { tenantId, leadId, dueAt = null, note = '' } = request.data || {};
    id(tenantId, 'client'); id(leadId, 'lead');
    const context = await scope(request);
    const lead = await db.doc(`tenants/${tenantId}/leads/${leadId}`).get();
    if (!lead.exists) fail('not-found', 'Lead not found.');
    const row = lead.data();
    const authorized = (await lines(context, 'read_communications')).filter(line => line.tenantId === tenantId && line.brandId === brandOf(row) && (!line.campaignId || line.campaignId === (row.campaignId || row.campaign_id)));
    if (authorized.length !== 1) fail('failed-precondition', 'One authorized callback line is required.');
    await authorize(request, tenantId, { ...row, lineId: authorized[0].lineId }, 'read_communications');
    if (dueAt !== null && !Number.isFinite(Date.parse(dueAt))) fail('invalid-argument', 'Invalid callback date.');
    const ref = db.collection(`tenants/${tenantId}/followUpTasks`).doc();
    await db.runTransaction(async tx => {
      tx.create(ref, { tenantId, environment: context.environment, lineId: authorized[0].lineId, brandId: brandOf(row), leadId,
        assignedTo: context.uid, phone: row.phone || null, task_type: 'callback_reminder', status: 'pending', followUpState: 'pending',
        dueAt, note: String(note).slice(0, 2000), createdAt: FieldValue.serverTimestamp(), createdBy: context.uid });
      tx.create(db.collection(`tenants/${tenantId}/auditLogs`).doc(), { actorUid: context.uid, action: 'communications.callback.created', target: ref.id, occurredAt: FieldValue.serverTimestamp() });
    });
    return { id: ref.id, tenantId, lineId: authorized[0].lineId, status: 'pending' };
  }
  async function updateQueue(request) {
    const { state, operationId } = request.data || {};
    if (!['heard', 'callback_pending', 'closed'].includes(state)) fail('invalid-argument', 'Invalid queue transition.');
    id(operationId, 'operation');
    const { ref, context } = await record(request);
    await db.runTransaction(async tx => {
      const eventRef = ref.collection('queueEvents').doc(operationId);
      const [current, seen] = await Promise.all([tx.get(ref), tx.get(eventRef)]);
      if (seen.exists) {
        if (seen.data().actorUid !== context.uid || seen.data().state !== state) fail('already-exists', 'Operation identifier already used.');
        return;
      }
      const grant = context.grants.find(value => value.tenantId === request.data.tenantId);
      if (!current.exists || !allowed(context, grant, current.data(), 'read_communications')) fail('permission-denied', 'Record access changed.');
      tx.update(ref, { ...(state === 'heard' ? { readState: 'heard' } : { followUpState: state === 'closed' ? 'closed' : 'pending' }), updatedAt: FieldValue.serverTimestamp(), updatedBy: context.uid });
      if (state === 'callback_pending' && request.data.kind !== 'callbacks') {
        const row = current.data();
        tx.set(db.doc(`tenants/${row.tenantId}/followUpTasks/callback_${ref.id}`), { tenantId: row.tenantId, environment: context.environment, lineId: row.lineId || null, brandId: brandOf(row),
          callId: ref.id, leadId: row.leadId || null, task_type: 'callback_reminder', status: 'pending', followUpState: 'pending', phone: row.caller || row.destination || null, createdAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      tx.create(eventRef, { actorUid: context.uid, state, occurredAt: FieldValue.serverTimestamp() });
    });
    return { ok: true, state };
  }
  async function media(request) {
    const { row } = await record(request);
    const source = row.voicemailUrl || row.recordingUrl;
    let url; try { url = new URL(source); } catch { fail('not-found', 'Recording is unavailable.'); }
    // No arbitrary URL fetches, redirects, persistent public URLs or API-key
    // forwarding. Provider media is returned only after a fresh authorization.
    if (url.protocol !== 'https:' || !['media.telnyx.com', 'recordings.telnyx.com'].includes(url.hostname) || url.username || url.password) fail('failed-precondition', 'Recording origin has not been approved.');
    const result = await transport(url.href, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!result.ok) fail('unavailable', 'Recording service is unavailable.');
    const type = result.headers.get('content-type')?.split(';')[0];
    if (!['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/ogg'].includes(type)) fail('failed-precondition', 'Unsupported recording format.');
    const chunks = []; let size = 0;
    for await (const chunk of result.body) { size += chunk.length; if (size > 8 * 1024 * 1024) fail('resource-exhausted', 'Recording exceeds playback limit.'); chunks.push(Buffer.from(chunk)); }
    await record(request); // Re-check assignments after provider I/O.
    return { contentType: type, contentBase64: Buffer.concat(chunks).toString('base64') };
  }
  async function permission(request) {
    const actor = await identity(request);
    if (!actor.superAdmin) fail('permission-denied', 'Only GMS Super Admin can manage operational grants.');
    const { agentUid, tenantId, action = 'set', capabilities = [], lineIds = [], brandIds = [], role = 'agent', effectiveAt = null } = request.data || {};
    id(agentUid, 'agent'); id(tenantId, 'client');
    if (!['set', 'revoke'].includes(action) || !ROLES.includes(role) || !Array.isArray(capabilities) || capabilities.some(value => !CAPABILITIES.includes(value)) || !Array.isArray(lineIds) || !lineIds.every(validId) || !Array.isArray(brandIds) || !brandIds.every(validId)) fail('invalid-argument', 'Invalid permission grant.');
    if (effectiveAt !== null && !Number.isFinite(Date.parse(effectiveAt))) fail('invalid-argument', 'Invalid effective date.');
    const environment = deploymentEnvironment(request.data?.environment);
    await tenant(tenantId, environment);
    const user = await auth.getUser(agentUid).catch(() => null);
    if (!user || user.disabled) fail('not-found', 'Agent is unavailable.');
    for (const lineId of lineIds) {
      const line = await db.doc(`tenants/${tenantId}/phoneNumbers/${lineId}`).get();
      if (!line.exists || line.data().status !== 'active' || line.data().verified !== true || environmentOf(line.data()) !== environment || (brandIds.length && !brandIds.includes(brandOf(line.data())))) fail('failed-precondition', 'Grant includes an unavailable or incompatible line.');
    }
    const ref = db.doc(`agentUsers/${agentUid}/assignments/${tenantId}`);
    await db.runTransaction(async tx => {
      const previous = await tx.get(ref);
      const row = { agentUid, tenantId, environment, capabilities: [...new Set(capabilities)], lineIds: [...new Set(lineIds)], brandIds: [...new Set(brandIds)], brandId: null,
        role, enabled: action === 'set', status: action === 'set' ? 'active' : 'revoked', effectiveAt: effectiveAt ? new Date(effectiveAt) : null,
        revokedAt: action === 'revoke' ? FieldValue.serverTimestamp() : null,
        updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() };
      tx.set(ref, row, { merge: true });
      if (previous.data()?.assignmentId) tx.set(db.doc(`agentAssignments/${id(previous.data().assignmentId, 'assignment')}`), row, { merge: true });
      tx.set(db.doc(`telephonyPresence/${agentUid}`), { status: 'offline', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(db.doc(`agentUsers/${agentUid}`), { permissionsVersion: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.create(db.collection(`tenants/${tenantId}/auditLogs`).doc(), { actorUid: actor.uid, action: `agent.operational_grant.${action}`, target: agentUid,
        metadata: { role, capabilities, lineIds, brandIds }, occurredAt: FieldValue.serverTimestamp() });
    });
    return { ok: true, agentUid, tenantId, status: action === 'set' ? 'active' : 'revoked' };
  }
  async function permissionWorkspace(request) {
    const actor = await identity(request);
    if (!actor.superAdmin) fail('permission-denied', 'Only GMS Super Admin can view operational grants.');
    const environment = deploymentEnvironment(request.data?.environment);
    const users = await db.collection('agentUsers').get();
    const items = [];
    for (const user of users.docs) {
      const assignments = await db.collection(`agentUsers/${user.id}/assignments`).get();
      items.push({ uid: user.id, displayName: user.data().displayName || null, email: user.data().email || null,
        assignments: assignments.docs.filter(doc => !doc.data().environment || doc.data().environment === environment).map(doc => ({ tenantId: doc.id, role: doc.data().role || 'agent', status: doc.data().status, enabled: doc.data().enabled !== false,
          capabilities: doc.data().capabilities || [], lineIds: doc.data().lineIds || [], brandIds: doc.data().brandIds || [], effectiveAt: doc.data().effectiveAt || null })) });
    }
    const context = await scope(request);
    return { items, count: items.length, environment, clients: context.grants.map(grant => ({ tenantId: grant.tenantId, name: grant.tenant.name || grant.tenantId })), lines: await lines(context, 'call') };
  }
  async function resolveInbound(event) {
    const environment = deploymentEnvironment();
    const snapshots = await db.collectionGroup('phoneNumbers').where('phoneNumber', '==', event.to).get();
    const candidates = snapshots.docs.filter(doc => doc.ref.path.split('/').length === 4 && doc.ref.path.startsWith('tenants/') && doc.data().status === 'active' && doc.data().verified === true && doc.data().provider === 'telnyx' && environmentOf(doc.data()) === environment);
    if (candidates.length !== 1 || event.connectionId !== env.TELNYX_CONNECTION_ID) fail('permission-denied', 'Inbound line is not uniquely provisioned.');
    const doc = candidates[0], tenantId = doc.ref.path.split('/')[1];
    const t = await tenant(tenantId, environment);
    return { tenantId, tenant: t, lineId: doc.id, brandId: brandOf(doc.data()), campaignId: doc.data().campaignId || null, environment };
  }
  async function recipients(context) {
    const presence = await db.collection('telephonyPresence').where('status', '==', 'available').get();
    const recipients = [];
    for (const doc of presence.docs) {
      const row = doc.data();
      const expires = row.expiresAt?.toMillis?.() || new Date(row.expiresAt).getTime();
      if (row.environment !== context.environment || !Number.isFinite(expires) || expires <= Date.now()) continue;
      try {
        const request = { auth: { uid: doc.id }, data: { tenantId: context.tenantId, environment: context.environment } };
        await authorize(request, context.tenantId, context, 'can_answer_calls');
        const provision = await db.doc(`telephonyIdentities/${doc.id}`).get();
        if (provision.data()?.enabled === true && provision.data().environment === context.environment && provision.data().connectionId === env.TELNYX_CONNECTION_ID) recipients.push(doc.id);
      } catch (error) { if (error.code !== 'permission-denied') throw error; }
    }
    return recipients;
  }
  async function inboundEvent(event) {
    const context = await resolveInbound(event);
    const ref = db.doc(`tenants/${context.tenantId}/callRecords/${crypto.createHash('sha256').update(event.callId).digest('hex')}`);
    const eligible = await recipients(context);
    await db.runTransaction(async tx => {
      const seen = await tx.get(ref);
      if (seen.exists) return;
      tx.create(ref, { tenantId: context.tenantId, environment: context.environment, lineId: context.lineId, brandId: context.brandId,
        campaignId: context.campaignId, provider: 'telnyx', providerCallId: event.callId, direction: 'inbound', caller: event.from, from: event.to,
        status: 'ringing', eligibleAgentUids: eligible, routingStatus: eligible.length ? 'pending_dispatch' : 'no_available_agents',
        startedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
    });
    // Provider SIP fan-out is deliberately gated separately from outbound calling.
    // The dispatch worker must be approved with the provider dialing restrictions.
    return { ref, context, eligible };
  }
  async function dispatchInbound(ref) {
    const snapshot = await ref.get(); const call = snapshot.data();
    if (!call || call.direction !== 'inbound') fail('failed-precondition', 'Inbound call required.');
    if (env.TELEPHONY_INBOUND_ENABLED !== 'true') return;
    activation(call.environment);
    const context = await resolveInbound({ to: call.from, connectionId: env.TELNYX_CONNECTION_ID });
    const agents = await recipients(context);
    const dispatching = await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (current.data().routingStatus !== 'pending_dispatch' && current.data().routingStatus !== 'no_available_agents') return false;
      tx.update(ref, { routingStatus: agents.length ? 'dispatching' : 'no_available_agents' }); return agents.length > 0;
    });
    if (!dispatching) return;
    // The provider is only contacted after active grants, verified DID and
    // environment-specific activation checks. State is persisted before dialing.
    await provider().answer(call.providerCallId);
    for (const uid of agents) {
      const request = { auth: { uid }, data: { tenantId: call.tenantId } };
      await authorize(request, call.tenantId, call, 'can_answer_calls');
      const provision = (await db.doc(`telephonyIdentities/${uid}`).get()).data();
      if (!/^sip:[A-Za-z0-9_.-]+@sip\.telnyx\.com$/.test(provision?.sipUri || '')) continue;
      const dispatchId = crypto.randomUUID(), legRef = db.doc(`telephonyDispatchLegs/${dispatchId}`);
      await legRef.create({ uid, tenantId: call.tenantId, callId: ref.id, environment: call.environment, lineId: call.lineId,
        to: provision.sipUri, from: call.from, providerCallId: null, status: 'dial_pending', createdAt: FieldValue.serverTimestamp() });
      try {
        const leg = await provider().start({ to: provision.sipUri, from: call.from, callbackUrl: env.TELEPHONY_STATUS_URL,
          commandId: dispatchId, clientState: Buffer.from(JSON.stringify({ dispatchId })).toString('base64') });
        // Webhook may arrive before the HTTP response; require identical binding.
        await db.runTransaction(async tx => { const current = await tx.get(legRef);
          if (current.data().providerCallId && current.data().providerCallId !== leg.id) fail('data-loss', 'Conflicting inbound leg binding.');
          tx.update(legRef, { providerCallId: leg.id }); });
      } catch (error) { await legRef.set({ status: 'dial_uncertain' }, { merge: true }); throw error; }
    }
    await ref.update({ routingStatus: 'dispatched' });
  }
  async function dispatchEvent(event) {
    if (!validId(event.dispatchId)) return false;
    const legRef = db.doc(`telephonyDispatchLegs/${event.dispatchId}`), snapshot = await legRef.get();
    if (!snapshot.exists) return false;
    const leg = snapshot.data();
    if (event.connectionId !== env.TELNYX_CONNECTION_ID || event.to !== leg.to || event.from !== leg.from || leg.environment !== deploymentEnvironment() || (leg.providerCallId && leg.providerCallId !== event.callId)) fail('permission-denied', 'Inbound leg context mismatch.');
    const ref = db.doc(`tenants/${id(leg.tenantId, 'client')}/callRecords/${id(leg.callId, 'call')}`);
    const call = (await ref.get()).data();
    if (!call) fail('not-found', 'Inbound call not found.');
    const request = { auth: { uid: leg.uid }, data: { tenantId: leg.tenantId } };
    try { await authorize(request, leg.tenantId, call, 'can_answer_calls'); }
    catch (error) { if (error.code !== 'permission-denied') throw error; activation(leg.environment); await provider().end(event.callId); return true; }
    const commandId = crypto.createHash('sha256').update(event.dispatchId + ':bridge').digest('hex').slice(0, 32);
    const winner = await db.runTransaction(async tx => {
      const [current, seen] = await Promise.all([tx.get(ref), tx.get(legRef)]);
      const value = current.data();
      if (seen.data().providerCallId && seen.data().providerCallId !== event.callId) fail('permission-denied', 'Conflicting inbound call leg.');
      tx.update(legRef, { providerCallId: event.callId, status: event.status || seen.data().status });
      if (!event.answered || ['completed', 'failed'].includes(value.status)) return false;
      if (value.agentUid && value.agentUid !== leg.uid) return false;
      if (value.agentCallId && value.agentCallId !== event.callId) return false;
      tx.update(ref, { agentUid: leg.uid, agentCallId: event.callId, routingStatus: 'bridge_requested' });
      return true;
    });
    if (event.answered) {
      activation(leg.environment);
      if (!winner) await provider().end(event.callId);
      else {
        // Re-check permission immediately before bridging; provider idempotency
        // makes signed event retries safe after a network timeout.
        await authorize(request, leg.tenantId, call, 'can_answer_calls');
        await provider().bridge(call.providerCallId, event.callId, commandId);
        const others = await db.collection('telephonyDispatchLegs').where('callId', '==', leg.callId).get();
        for (const other of others.docs) if (other.id !== event.dispatchId && other.data().providerCallId) await provider().end(other.data().providerCallId);
      }
    }
    return true;
  }
  async function incomingContext(request) {
    const caller = await identity(request);
    const providerCallId = request.data?.providerCallId;
    if (typeof providerCallId !== 'string' || providerCallId.length > 512) fail('invalid-argument', 'Invalid provider call.');
    const matches = await db.collection('telephonyDispatchLegs').where('providerCallId', '==', providerCallId).get();
    if (matches.size !== 1 || matches.docs[0].data().uid !== caller.uid) fail('permission-denied', 'Incoming call is not assigned to this user.');
    const leg = matches.docs[0].data();
    const snapshot = await db.doc(`tenants/${leg.tenantId}/callRecords/${leg.callId}`).get();
    if (!snapshot.exists) fail('not-found', 'Incoming call unavailable.');
    const context = await authorize(request, leg.tenantId, snapshot.data(), 'can_answer_calls');
    return queueRow(snapshot, context.tenant);
  }
  return { identity, tenant, deploymentEnvironment, scope, authorize, authorizeLead, phone, queue, record, createCallback, updateQueue, media, permission, permissionWorkspace, resolveInbound, recipients, inboundEvent, dispatchInbound, dispatchEvent, incomingContext, lines, activation };
}
module.exports = { createMulticlient, activeGrant, grantAllows, validId, environmentOf, PHONE_ACTIONS, queueRow };
