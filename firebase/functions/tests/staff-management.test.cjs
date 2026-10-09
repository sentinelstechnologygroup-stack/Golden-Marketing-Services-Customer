const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const policy = require('../staff-policy.cjs');
const sample = { name: 'Test staff', email: 'fixture@example.invalid', role: 'agent', tenantId: 'tenant-fixture', brandIds: ['brand-fixture'] };
test('four presets; invalid roles and missing client scope rejected', () => {
  assert.deepEqual(Object.keys(policy.PRESETS), ['agent','supervisor','ai_admin','gms_super_admin']);
  for (const role of Object.keys(policy.PRESETS)) assert.equal(policy.input({ ...sample, role }).role, role);
  assert.throws(() => policy.input({ ...sample, role: 'owner' }));
  assert.throws(() => policy.input({ ...sample, brandIds: [] }));
  assert.throws(() => policy.input({ ...sample, tenantId: '../other' }));
  assert.equal(policy.input({ ...sample, permissions: ['staff.manage'] }).permissions.includes('staff.manage'), false);
});
test('phone agent and AI admin cannot write administrative or billing records', () => {
  for (const role of ['agent','ai_admin','supervisor']) for (const collection of ['invoices','documents','auditLogs','organizations']) assert.equal(policy.collectionAllowed(role,collection), false);
  assert.equal(policy.collectionAllowed('agent','callRecords',true), true);
  assert.equal(policy.collectionAllowed('agent','reports',true), false);
  assert.equal(policy.collectionAllowed('agent','businessOwners',true), false);
  assert.equal(policy.collectionAllowed('ai_admin','campaigns',true), false);
  assert.equal(policy.collectionAllowed('ai_admin','campaigns'), true);
});
function fixture({ admin = true, existing = false } = {}) {
  const writes = [], created = [], claims = [];
  const auth = {
    getUser: async () => ({ uid: 'admin-fixture', customClaims: { gmsSuperAdmin: admin } }),
    getUserByEmail: async () => { if (existing) return { uid: 'existing' }; throw { code: 'auth/user-not-found' }; },
    createUser: async user => { created.push(user); return user; },
    setCustomUserClaims: async (uid, value) => claims.push(value),
    updateUser: async () => {},
    generatePasswordResetLink: async () => 'https://gms-prod-1089114348316.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=fixture-only',
  };
  const db = { doc: path => ({ path, get: async () => ({ exists: true, data: () => ({ name: 'Fixture client' }) }) }), batch: () => ({ set: (ref,value) => writes.push({ path: ref.path, value }), commit: async () => {} }), collection: () => ({ add: async () => {} }) };
  class HttpsError extends Error { constructor(code,message) { super(message); this.code=code; } }
  const exports = {};
  const dependencies = {
    'firebase-admin/auth': { getAuth: () => auth },
    'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'fixture-time' } },
    'firebase-functions/v2/https': { onCall: (_,handler) => handler, HttpsError },
    'firebase-functions/params': { defineSecret: () => ({ value: () => 'fixture-only' }) },
    './staff-policy.cjs': policy,
    './onboarding-email.cjs': require('../onboarding-email.cjs'),
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../staff-management'),'utf8'), { exports, require: name => dependencies[name] || require(name), AbortSignal, process: { env: {} } });
  return { exports, created, claims, writes };
}
test('unauthorized caller cannot create or elevate staff', async () => {
  const f=fixture({admin:false});
  await assert.rejects(f.exports.createGmsStaff({auth:{uid:'agent'},data:{...sample,role:'gms_super_admin'}}), error => error.code==='permission-denied');
  assert.equal(f.created.length,0);
});
test('existing email is never silently elevated or modified', async () => {
  const f=fixture({existing:true});
  await assert.rejects(f.exports.createGmsStaff({auth:{uid:'admin'},data:sample}), error => error.code==='already-exists');
  assert.equal(f.claims.length,0); assert.equal(f.writes.length,0);
});
test('account creation derives every role and permission server-side; no real identities created', async () => {
  for (const role of Object.keys(policy.PRESETS)) {
    const f=fixture();
    const result=await f.exports.createGmsStaff({auth:{uid:'admin'},data:{...sample,role,permissions:['injected']}});
    assert.equal(result.delivery,'not_sent'); assert.equal(result.phoneReady,false);
    assert.equal(f.created.length,1); assert.equal(f.created[0].disabled,true);
    assert.equal(f.claims[0].gmsSuperAdmin,role==='gms_super_admin');
    assert.equal(f.writes.find(write=>write.path.includes('/assignments/')).value.permissions.includes('injected'),false);
    assert.equal(f.writes.some(write=>JSON.stringify(write.value).includes(result.setupLink)),false);
  }
});
