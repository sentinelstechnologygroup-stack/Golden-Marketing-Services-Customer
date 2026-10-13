'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Local emulators required.');
const core = require('../platform-core');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { createMulticlient } = require('../telephony/multiclient.cjs');
const db = getFirestore(), auth = getAuth();
const prefix = `multi-${Date.now()}`;
const ids = Object.fromEntries(['super', 'agent', 'outsider', 'disabled', 'customer'].map(key => [key, `${prefix}-${key}`]));
const tenantA = `${prefix}-a`, tenantB = `${prefix}-b`, demoTenant = `${prefix}-demo`;
const env = { TELEPHONY_ENVIRONMENT: 'production', TELEPHONY_PROVIDER: 'telnyx', TELEPHONY_ENABLED: 'true',
  TELNYX_CONNECTION_ID: 'test-connection', TELNYX_PUBLIC_KEY: Buffer.alloc(32).toString('base64'),
  TELNYX_STATUS_WEBHOOK_URL: 'https://example.test/webhook', TELEPHONY_STATUS_URL: 'https://example.test/webhook', TELNYX_DIALING_RESTRICTIONS_VERIFIED: 'true' };
let requests = [];
const operations = createMulticlient({ db, auth, HttpsError, FieldValue, env, provider: () => ({ token: 'emulator-only-secret' }), transport: async (url, options) => {
  requests.push({ url, options });
  return { ok: true, text: async () => 'emulator-session-token', headers: new Headers({ 'content-type': 'audio/wav' }), body: [Buffer.from('emulator audio')] };
} });
const request = (uid, data = {}, token = {}) => ({ auth: { uid, token }, data });
const grant = { status: 'active', enabled: true, role: 'agent', environment: 'production', brandIds: ['brand'], lineIds: ['line'], capabilities: ['call', 'can_answer_calls', 'read_communications'] };

test.before(async () => {
  for (const [key, uid] of Object.entries(ids)) await auth.createUser({ uid, disabled: key === 'disabled' });
  await auth.setCustomUserClaims(ids.super, { gmsSuperAdmin: true });
  for (const tenantId of [tenantA, tenantB, demoTenant]) {
    const environment = tenantId === demoTenant ? 'demo' : 'production';
    await db.doc(`tenants/${tenantId}`).set({ name: tenantId, environment, status: 'active' });
    await db.doc(`tenants/${tenantId}/phoneNumbers/line`).set({ tenantId, environment, brandId: 'brand', phoneNumber: tenantId === tenantA ? '+15550000001' : tenantId === tenantB ? '+15550000002' : '+15550000003', status: 'active', provider: 'telnyx', verified: true });
    await db.doc(`tenants/${tenantId}/callRecords/voicemail`).set({ tenantId, environment, lineId: 'line', brandId: 'brand', status: 'voicemail', voicemail: true, recordingUrl: 'https://media.telnyx.com/emulator.wav' });
  }
  for (const tenantId of [tenantA, tenantB]) await db.doc(`agentUsers/${ids.agent}/assignments/${tenantId}`).set({ ...grant, tenantId });
  await db.doc(`agentUsers/${ids.agent}`).set({ uid: ids.agent });
  for (const uid of [ids.super, ids.agent]) await db.doc(`telephonyIdentities/${uid}`).set({ enabled: true, environment: 'production', connectionId: env.TELNYX_CONNECTION_ID, telnyxCredentialId: `credential-${uid}` });
  await db.doc(`tenants/${tenantA}/members/${ids.customer}`).set({ active: true, role: 'client_admin' });
});

test('Super Admin registers without selected client and sees both labeled voicemails', async () => {
  const session = await operations.phone(request(ids.super), 'browser_session');
  assert.equal(session.identity, `gms_${ids.super}`); assert.equal(session.lines.filter(row => [tenantA, tenantB].includes(row.tenantId)).length, 2);
  assert.equal((await db.doc(`telephonyPresence/${ids.super}`).get()).data().status, 'offline');
  const queue = await operations.queue(request(ids.super, { kind: 'voicemail' }));
  assert.deepEqual(queue.items.map(row => row.tenantId).sort(), [tenantA, tenantB]);
  assert.ok(queue.items.every(row => row.clientName && row.lineId === 'line'));
  assert.doesNotMatch(JSON.stringify(queue), /media.telnyx|recordingUrl|emulator-only-secret|credential-/);
});
test('one calling identity covers two authorized clients; sidebar changes do not choose credentials', async () => {
  const sessions = [];
  for (const tenantId of [tenantA, tenantB, undefined]) sessions.push(await operations.phone(request(ids.agent, { tenantId }), 'browser_session'));
  assert.equal(new Set(sessions.map(row => row.identity)).size, 1);
  assert.ok(sessions.every(row => row.lines.length === 2));
  const urls = requests.filter(row => row.url.includes('/telephony_credentials/')).map(row => row.url);
  assert.ok(urls.slice(-3).every(url => url.includes(`credential-${ids.agent}`)));
  for (const tenantId of [tenantA, tenantB]) {
    const event = { to: tenantId === tenantA ? '+15550000001' : '+15550000002', from: '+15559999999', connectionId: env.TELNYX_CONNECTION_ID, callId: `v3:${tenantId}` };
    await operations.phone(request(ids.agent), 'set_availability', { status: 'available' });
    const context = await operations.resolveInbound(event);
    assert.equal(context.tenantId, tenantId);
    assert.deepEqual(await operations.recipients(context), [ids.agent]);
    const incoming = await operations.inboundEvent(event);
    assert.equal((await incoming.ref.get()).data().lineId, 'line');
  }
});
test('outsider, client membership, disabled user and forged stale Super Admin claims cannot read/call/manage', async () => {
  for (const uid of [ids.outsider, ids.disabled, ids.customer]) {
    const input = request(uid, { tenantId: tenantA, recordId: 'voicemail' }, { gmsSuperAdmin: true });
    await assert.rejects(operations.queue(input), { code: 'permission-denied' });
    await assert.rejects(operations.media(input), { code: 'permission-denied' });
    await assert.rejects(operations.phone(input, 'browser_session'), { code: 'permission-denied' });
    await assert.rejects(operations.permission({ ...input, data: { agentUid: ids.agent, tenantId: tenantA } }), { code: 'permission-denied' });
  }
  await assert.rejects(operations.queue({ data: {} }), { code: 'unauthenticated' });
  await assert.rejects(operations.queue(request(ids.agent, { tenantId: 'unassigned-client' })), { code: 'permission-denied' });
  await assert.rejects(core.createAgentAssignment.run(request(ids.customer, { tenantId: tenantA, agentUid: ids.outsider, industry: 'real-estate' })), { code: 'permission-denied' });
});
test('empty authorized queue is successful and pagination does not collapse filtered results', async () => {
  const empty = await operations.queue(request(ids.agent, { kind: 'callbacks' }));
  assert.equal(empty.count, 0); assert.deepEqual(empty.items, []);
  const first = await operations.queue(request(ids.agent, { kind: 'voicemail', limit: 1 }));
  assert.equal(first.count, 1); assert.ok(first.cursor);
  const next = await operations.queue(request(ids.agent, { kind: 'voicemail', limit: 1, cursor: first.cursor }));
  assert.equal(next.count, 1); assert.notEqual(first.items[0].tenantId, next.items[0].tenantId);
});
test('line/brand restrictions, future grants and revocations apply to queues, media and inbound recipients', async () => {
  const ref = db.doc(`agentUsers/${ids.agent}/assignments/${tenantA}`);
  for (const patch of [{ lineIds: ['wrong'] }, { brandIds: ['wrong'] }, { effectiveAt: new Date(Date.now() + 60000).toISOString() }, { enabled: false }, { revokedAt: new Date() }]) {
    await ref.set({ ...grant, ...patch });
    await assert.rejects(operations.record(request(ids.agent, { tenantId: tenantA, recordId: 'voicemail' })), { code: 'permission-denied' });
  }
  await ref.set(grant);
  await operations.media(request(ids.agent, { tenantId: tenantA, recordId: 'voicemail' }));
  await operations.permission(request(ids.super, { tenantId: tenantA, agentUid: ids.agent, action: 'revoke' }));
  await assert.rejects(operations.media(request(ids.agent, { tenantId: tenantA, recordId: 'voicemail' })), { code: 'permission-denied' });
  const recipients = await operations.recipients(await operations.resolveInbound({ to: '+15550000001', connectionId: env.TELNYX_CONNECTION_ID }));
  assert.deepEqual(recipients, []);
  await ref.set(grant);
});
test('callback transitions are audited, idempotent and preserve verified client and line', async () => {
  const input = request(ids.agent, { tenantId: tenantA, recordId: 'voicemail', state: 'callback_pending', operationId: 'same-operation' });
  await operations.updateQueue(input); await operations.updateQueue(input);
  const callbacks = await operations.queue(request(ids.agent, { kind: 'callbacks' }));
  assert.equal(callbacks.count, 1); assert.equal(callbacks.items[0].tenantId, tenantA); assert.equal(callbacks.items[0].lineId, 'line');
  assert.equal((await db.collection(`tenants/${tenantA}/callRecords/voicemail/queueEvents`).get()).size, 1);
  await assert.rejects(operations.updateQueue({ ...input, data: { ...input.data, state: 'closed' } }), { code: 'already-exists' });
});
test('demo is excluded from production queues, tokens, DID lookup and provider side effects', async () => {
  const count = requests.length;
  await assert.rejects(operations.queue(request(ids.super, { tenantId: demoTenant })), { code: 'permission-denied' });
  await assert.rejects(operations.phone(request(ids.super, { environment: 'demo' }), 'browser_session'), { code: 'permission-denied' });
  await assert.rejects(operations.resolveInbound({ to: '+15550000003', connectionId: env.TELNYX_CONNECTION_ID }), { code: 'permission-denied' });
  const demo = createMulticlient({ db, auth, HttpsError, FieldValue, env: { ...env, TELEPHONY_ENVIRONMENT: 'demo' }, provider: () => { throw new Error('Must never access production provider'); } });
  assert.equal((await demo.queue(request(ids.super, { kind: 'voicemail' }))).count, 1);
  await assert.rejects(demo.phone(request(ids.super), 'browser_session'), { code: 'failed-precondition' });
  assert.equal(requests.length, count);
});
test('account claim revocation defeats stale Super Admin browser token', async () => {
  await auth.setCustomUserClaims(ids.super, {});
  await assert.rejects(operations.queue(request(ids.super, {}, { gmsSuperAdmin: true })), { code: 'permission-denied' });
  await auth.setCustomUserClaims(ids.super, { gmsSuperAdmin: true });
});

test('inbound dispatch uses one authorized SIP identity for both clients and denies forged leg context', async () => {
  const commands = [];
  const mockProvider = { answer: async id => commands.push(['answer', id]), start: async options => { commands.push(['start', options]); return { id: `provider-${options.commandId}` }; }, bridge: async (...args) => commands.push(['bridge', ...args]), end: async id => commands.push(['end', id]) };
  const routed = createMulticlient({ db, auth, HttpsError, FieldValue, env: { ...env, TELEPHONY_INBOUND_ENABLED: 'true' }, provider: () => mockProvider });
  await db.doc(`telephonyIdentities/${ids.agent}`).update({ sipUri: 'sip:multi_agent@sip.telnyx.com' });
  await routed.phone(request(ids.agent), 'set_availability', { status: 'available' });
  for (const tenantId of [tenantA, tenantB]) {
    const number = tenantId === tenantA ? '+15550000001' : '+15550000002';
    const incoming = await routed.inboundEvent({ callId: `v3:dispatch-${tenantId}`, to: number, from: '+15559999999', connectionId: env.TELNYX_CONNECTION_ID });
    await routed.dispatchInbound(incoming.ref);
    const leg = commands.filter(row => row[0] === 'start').at(-1)[1];
    assert.equal(leg.to, 'sip:multi_agent@sip.telnyx.com'); assert.equal(leg.from, number);
    const state = JSON.parse(Buffer.from(leg.clientState, 'base64').toString());
    const event = { dispatchId: state.dispatchId, callId: `provider-${leg.commandId}`, from: number, to: leg.to, connectionId: env.TELNYX_CONNECTION_ID, answered: true, status: 'in_progress' };
    await assert.rejects(routed.dispatchEvent({ ...event, to: 'sip:attacker@sip.telnyx.com' }), { code: 'permission-denied' });
    await routed.dispatchEvent(event);
    const verified = await routed.incomingContext(request(ids.agent, { providerCallId: event.callId }));
    assert.equal(verified.clientId, tenantId);
    assert.equal((await incoming.ref.get()).data().agentUid, ids.agent);
    await assert.rejects(routed.incomingContext(request(ids.outsider, { providerCallId: event.callId })), { code: 'permission-denied' });
  }
  assert.equal(commands.filter(row => row[0] === 'start').length, 2);
  assert.equal(commands.filter(row => row[0] === 'bridge').length, 2);
});

test('public Agent callable aggregates client assignments and prepares two caller identities without any provider dialing', async () => {
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const previousToken = process.env.TELNYX_API_KEY;
  Object.assign(process.env, env, { TELNYX_API_KEY: 'emulator-only-secret' });
  try {
    for (const tenantId of [tenantA, tenantB]) {
      await db.doc(`tenants/${tenantId}/leads/lead`).set({ tenantId, environment: 'production', brandId: 'brand', phone: '+15559999999', status: 'new' });
      await core.communications.run(request(ids.agent, { tenantId, action: 'claim_lead', params: { leadId: 'lead' } }));
      const prepared = await core.communications.run(request(ids.agent, { tenantId, action: 'start_call', params: { leadId: 'lead', to: '+15559999999', recordingConsent: true } }));
      assert.equal(prepared.dial.from, tenantId === tenantA ? '+15550000001' : '+15550000002');
      assert.equal((await db.doc(`tenants/${tenantId}/callRecords/${prepared.callId}`).get()).data().agentUid, ids.agent);
    }
    const rows = await core.getAgentCollection.run(request(ids.agent, { collectionName: 'leads' }));
    assert.deepEqual(rows.rows.map(row => row.tenantId).sort(), [tenantA, tenantB]);
    await assert.rejects(core.getAgentCollection.run(request(ids.agent, { tenantId: demoTenant, collectionName: 'leads' })), { code: 'permission-denied' });
    const callback = await core.createCommunicationCallback.run(request(ids.agent, { tenantId: tenantB, leadId: 'lead', dueAt: '2026-10-14T12:00:00Z' }));
    assert.equal(callback.tenantId, tenantB); assert.equal(callback.lineId, 'line');
    await assert.rejects(core.createCommunicationCallback.run(request(ids.outsider, { tenantId: tenantB, leadId: 'lead' })), { code: 'permission-denied' });
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    if (previousToken === undefined) delete process.env.TELNYX_API_KEY; else process.env.TELNYX_API_KEY = previousToken;
  }
});
