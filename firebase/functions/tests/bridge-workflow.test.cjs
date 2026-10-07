const assert = require('node:assert/strict');
const test = require('node:test');

process.env.GMS_INGESTION_KEY = 'emulator-ingestion-key';

const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const functions = require('../index.js');

const db = getFirestore();
const auth = getAuth();
const lmsAdminUid = 'workflow-lms-admin';
const agentUid = 'workflow-brand-agent';
const clientUid = 'workflow-client-admin';

const callableRequest = (uid, data, token = {}) => ({ auth: { uid, token }, data });

async function invokeHttp(handler, { method = 'POST', headers = {}, body = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const state = { status: 200, body: null };
  const listeners = new Map();
  const finish = () => listeners.get('finish')?.forEach((listener) => listener());
  const request = {
    method,
    headers: normalizedHeaders,
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
    protocol: 'http',
    originalUrl: '/demo-gms-local/us-central1/ingestWebsiteLead',
    url: '/demo-gms-local/us-central1/ingestWebsiteLead',
    get(name) { return normalizedHeaders[String(name).toLowerCase()] || ''; },
  };
  const response = {
    locals: {},
    on(event, listener) {
      const eventListeners = listeners.get(event) || [];
      eventListeners.push(listener);
      listeners.set(event, eventListeners);
      return this;
    },
    status(code) { state.status = code; return this; },
    json(value) { state.body = value; finish(); return this; },
    send(value) { state.body = value; finish(); return this; },
    type() { return this; },
    setHeader() {},
    getHeader() { return undefined; },
    end(value) { if (value !== undefined) state.body = value; finish(); return this; },
  };
  await handler(request, response);
  return state;
}

test.before(async () => {
  await Promise.all([
    auth.createUser({ uid: lmsAdminUid, email: 'workflow-admin@example.test', displayName: 'Workflow LMS Admin' }),
    auth.createUser({ uid: agentUid, email: 'workflow-agent@example.test', displayName: 'Workflow Agent' }),
    auth.createUser({ uid: clientUid, email: 'workflow-client@example.test', displayName: 'Workflow Client Admin' }),
  ]);
  await auth.setCustomUserClaims(lmsAdminUid, { gmsSuperAdmin: true, platformAdmin: true });
});

test.after(async () => {
  await Promise.all([lmsAdminUid, agentUid, clientUid].map((uid) => auth.deleteUser(uid).catch(() => null)));
});

test('existing-route ingestion, Agent workflow, Customer projection, and Brand isolation stay aligned', async () => {
  // Regression coverage for already-existing client routes. New onboarding is
  // covered separately and must not use the retired activate-on-create API.
  await assert.rejects(functions.provisionClient.run(callableRequest(lmsAdminUid, {})), {code:'failed-precondition'});
  const tenantId = `tenant-workflow-bridge-${Date.now()}`;
  const brandId = 'brand-workflow-primary-brand';
  const route = {tenantId,brandId,industryId:'general-services',sourceId:'source-website',campaignId:'campaign-initial',
    routingProfileId:'routing-default',workflowVersion:'v1',scriptSetId:'script-default',qualificationFormId:'qualification-default',
    consentPolicyId:'consent-default',retentionPolicyId:'retention-default',assignedAgentUids:[agentUid],status:'active'};
  await Promise.all([
    db.doc(`tenants/${tenantId}`).set({tenantId,name:'Workflow client',demo:false,status:'active'}),
    db.doc(`tenants/${tenantId}/brands/${brandId}`).set({tenantId,brandId,name:'Workflow brand',status:'active'}),
    db.doc(`tenants/${tenantId}/members/${clientUid}`).set({tenantId,uid:clientUid,email:'workflow-client@example.test',role:'client_admin',active:true}),
    db.doc(`tenants/${tenantId}/businessOwners/${clientUid}`).set({tenantId,brandId,uid:clientUid,memberUid:clientUid,name:'Client contact',email:'workflow-client@example.test',phone:'+15555550200',routingEligible:true,status:'active'}),
    db.doc(`agentUsers/${agentUid}/assignments/${tenantId}`).set({tenantId,agentUid,brandId,brandIds:[brandId],role:'agent',status:'active',scope:'assigned'}),
    db.doc('ingestionRoutes/workflow-bridge-route').set(route),
    db.doc(`tenants/${tenantId}/config/workflow`).set({notificationProfile:{channels:['in_app']}}),
  ]);
  const agentRequest = (data) => callableRequest(agentUid, { tenantId, ...data }, { role: 'agent' });
  const clientRequest = (data) => callableRequest(clientUid, { tenantId, ...data }, { role: 'client_admin' });

  const ingestion = await invokeHttp(functions.ingestWebsiteLead, {
    headers: {
      authorization: 'Bearer emulator-ingestion-key',
      'x-gms-route-key': 'workflow-bridge-route',
    },
    body: {
      name: 'Workflow Pilot Lead',
      email: 'workflow-lead@example.test',
      phone: '+15555550100',
      tenantId: 'tenant-attacker',
      brandId: 'brand-attacker',
      industryId: 'attacker-industry',
      isTest: true,
    },
  });

  assert.equal(ingestion.status, 202);
  assert.equal(ingestion.body.accepted, true);
  const leadId = ingestion.body.leadId;
  const leadRef = db.doc(`tenants/${tenantId}/leads/${leadId}`);
  const ingested = (await leadRef.get()).data();
  assert.equal(ingested.tenantId, tenantId);
  assert.equal(ingested.brandId, brandId);
  assert.equal(ingested.industryId, 'general-services');
  assert.equal(ingested.assignedTo, agentUid);
  assert.equal(ingested.routedClientContactId, clientUid);

  const forbiddenLeadRef = db.doc(`tenants/${tenantId}/leads/brand-b-lead`);
  await forbiddenLeadRef.set({ ...ingested, brandId: 'brand-forbidden', brand_id: 'brand-forbidden', name: 'Forbidden Brand Lead' });

  const collection = await functions.getAgentCollection.run(agentRequest({ collectionName: 'leads', limit: 50 }));
  assert.deepEqual(collection.rows.map((row) => row.id), [leadId]);

  await assert.rejects(
    functions.transitionLead.run(agentRequest({ leadId: 'brand-b-lead', status: 'contacted' })),
    (error) => error.code === 'permission-denied',
  );
  await assert.rejects(
    functions.createAgentRecord.run(agentRequest({
      collectionName: 'followUpTasks',
      data: { leadId, assignedTo: agentUid, status: 'pending', dueAt: new Date().toISOString(), brandId: 'brand-forbidden' },
    })),
    (error) => error.code === 'permission-denied',
  );
  const communicationsHealth = await functions.communications.run(agentRequest({ action: 'health_check' }));
  assert.equal(communicationsHealth.ok, true);
  assert.equal(communicationsHealth.configured, false);
  assert.equal(communicationsHealth.healthy, false);
  await assert.rejects(
    functions.communications.run(agentRequest({ action: 'start_call', params: { leadId, to: '+15555550100' } })),
    (error) => error.code === 'failed-precondition' && error.message === 'Calling has not been activated.',
  );
  // Emulator-only configuration reaches ownership checks without contacting Telnyx.
  Object.assign(process.env, {
    TELEPHONY_PROVIDER: 'telnyx', TELEPHONY_ENABLED: 'true',
    TELNYX_API_KEY: 'emulator-only-token', TELNYX_CONNECTION_ID: 'emulator-connection',
    TELNYX_BROWSER_CONNECTION_ID: 'emulator-receive-only-browser',
    TELNYX_PUBLIC_KEY: Buffer.alloc(32).toString('base64'),
    TELNYX_STATUS_WEBHOOK_URL: 'https://example.test/webhook',
    TELEPHONY_STATUS_URL: 'https://example.test/webhook',
    TELNYX_DIALING_RESTRICTIONS_VERIFIED: 'true', TELEPHONY_WARM_TRANSFER_ENABLED: 'false',GMS_RECORDING_PIPELINE_READY:'true',
  });
  await assert.rejects(
    functions.communications.run(agentRequest({
      action: 'start_call',
      params: { leadId: 'brand-b-lead', to: '+15555550100' },
    })),
    (error) => error.code === 'permission-denied',
  );
  await functions.communications.run(agentRequest({ action: 'claim_lead', params: { leadId } }));
  await assert.rejects(
    functions.communications.run(agentRequest({
      action: 'start_call',
      params: { leadId, to: '+15555550999' },
    })),
    (error) => error.code === 'permission-denied',
  );
  await assert.rejects(
    functions.communications.run(agentRequest({
      action: 'start_call',
      params: { leadId, to: '+15555550100' },
    })),
    (error) => error.code === 'failed-precondition',
  );
  await db.doc(`tenants/${tenantId}/callRecords/workflow-call`).set({
    tenantId, brandId, leadId, clientContactId: clientUid, agentUid, status: 'in_progress',
  });
  await assert.rejects(
    functions.communications.run(agentRequest({
      action: 'warm_transfer',
      params: { callId: 'workflow-call', transferTo: '+15555550999' },
    })),
    (error) => error.code === 'failed-precondition' && /Warm transfer/.test(error.message),
  );
  await assert.rejects(
    functions.communications.run(agentRequest({
      action: 'warm_transfer',
      params: { callId: 'workflow-call', transferTo: '+15555550200' },
    })),
    (error) => error.code === 'failed-precondition',
  );
  process.env.TELEPHONY_ENABLED = 'false';

  const beforeTransition = await leadRef.get();
  await functions.transitionLead.run(agentRequest({ leadId, status: 'qualified', disposition: 'qualified', note: 'Qualified in emulator workflow.' }));
  const afterTransition = await leadRef.get();
  assert.equal(afterTransition.data().status, 'qualified');
  assert.equal(afterTransition.data().brandId, brandId);

  await functions.projectLeadActivity.run({
    params: { tenantId, leadId },
    data: { before: beforeTransition, after: afterTransition },
  });

  const appointment = await functions.appointmentWorkflow.run(agentRequest({
    action: 'create',
    data: {
      leadId,
      title: 'Workflow consultation',
      scheduledStart: '2026-09-22T15:00:00.000Z',
      scheduledEnd: '2026-09-22T15:30:00.000Z',
      calendarProvider: 'internal',
      brandId: 'brand-forbidden',
    },
  }));
  const appointmentSnapshot = await db.doc(`tenants/${tenantId}/appointments/${appointment.id}`).get();
  assert.equal(appointmentSnapshot.data().brandId, brandId);
  assert.equal(appointmentSnapshot.data().tenantId, tenantId);

  await functions.projectAppointmentActivity.run({
    params: { tenantId, appointmentId: appointment.id },
    data: { data: () => appointmentSnapshot.data() },
  });

  const dashboard = await functions.getDashboardWorkspace.run(clientRequest({}));
  const report = await functions.getLiveReport.run(clientRequest({ range: 'Workflow test' }));
  assert.equal(dashboard.metrics.leadsReceived.value, 2);
  assert.equal(dashboard.metrics.appointmentsAndTransfers.value, 1);
  assert.equal(report.metrics.leadVolume.value, 2);
  assert.equal(report.metrics.appointmentRate.value, 50);

  const [activities, audits, notifications] = await Promise.all([
    db.collection(`tenants/${tenantId}/customerActivity`).get(),
    db.collection(`tenants/${tenantId}/auditLogs`).get(),
    db.collection(`tenants/${tenantId}/notifications`).get(),
  ]);
  assert.equal(activities.size, 2);
  for (const action of ['lead.ingested', 'lead.transitioned', 'appointment.create']) {
    assert.ok(audits.docs.some(doc => doc.data().action === action), `Missing audit event: ${action}`);
  }
  assert.ok(notifications.size >= 3);

  await assert.rejects(
    functions.transitionLead.run(callableRequest(agentUid, { tenantId: 'tenant-unassigned', leadId, status: 'contacted' }, { role: 'agent' })),
    (error) => error.code === 'permission-denied',
  );
});
