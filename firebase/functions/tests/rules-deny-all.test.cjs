const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');
const { getBytes, ref, uploadBytes } = require('firebase/storage');

const rulesDir = path.resolve(__dirname, '../..');
let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-linkmarketing-local',
    firestore: {
      rules: fs.readFileSync(path.join(rulesDir, 'firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(rulesDir, 'storage.rules'), 'utf8'),
    },
  });
  await env.clearStorage();
});

test.after(async () => {
  await env.cleanup();
});

test('Firestore denies unauthenticated access', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'tenants/tenant-a/leads/lead-a')));
});

test('Firestore denies authenticated and cross-tenant access until rules are approved', async () => {
  const db = env.authenticatedContext('agent-a', {
    tenantId: 'tenant-a',
    role: 'agent',
  }).firestore();

  await assertFails(getDoc(doc(db, 'tenants/tenant-a/leads/lead-a')));
  await assertFails(setDoc(doc(db, 'tenants/tenant-b/leads/lead-b'), {
    tenantId: 'tenant-b',
    ownerId: 'agent-a',
  }));
});

test('Firestore allows an active member to read its tenant and blocks customer writes', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'tenants/tenant-c', 'members/customer-c'), {
      uid: 'customer-c', tenantId: 'tenant-c', role: 'customer', active: true,
    });
    await setDoc(doc(context.firestore(), 'tenants/tenant-c', 'reports/report-c'), {
      tenantId: 'tenant-c', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  const db = env.authenticatedContext('customer-c').firestore();
  await getDoc(doc(db, 'tenants/tenant-c/reports/report-c'));
  await assertFails(setDoc(doc(db, 'tenants/tenant-c/reports/report-new'), {
    tenantId: 'tenant-c', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }));
  await assertFails(getDoc(doc(db, 'tenants/tenant-d/reports/report-d')));
});

test('Firestore keeps configuration writes above agent scope', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'tenants/tenant-e', 'members/agent-e'), {
      uid: 'agent-e', tenantId: 'tenant-e', role: 'agent', active: true,
    });
    await setDoc(doc(db, 'tenants/tenant-e', 'members/admin-e'), {
      uid: 'admin-e', tenantId: 'tenant-e', role: 'admin', active: true,
    });
  });

  const agentDb = env.authenticatedContext('agent-e').firestore();
  await assertFails(setDoc(doc(agentDb, 'tenants/tenant-e/brands/brand-e'), {
    tenantId: 'tenant-e', name: 'Unauthorized brand', status: 'draft', domain: 'example.test',
  }));

  const adminDb = env.authenticatedContext('admin-e').firestore();
  await setDoc(doc(adminDb, 'tenants/tenant-e/brands/brand-e'), {
    tenantId: 'tenant-e', name: 'Approved brand', status: 'active', domain: 'example.test',
  });
});

test('Firestore grants assigned agent reads only for assigned tenants', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'agentUsers/assigned-agent/assignments/tenant-assigned'), {
      agentUid: 'assigned-agent', tenantId: 'tenant-assigned', status: 'active', role: 'agent', industry: 'real-estate',
    });
    await setDoc(doc(db, 'tenants/tenant-assigned/leads/lead-1'), {
      tenantId: 'tenant-assigned', firstName: 'Assigned', lastName: 'Lead', status: 'new',
    });
    await setDoc(doc(db, 'tenants/tenant-other/leads/lead-2'), {
      tenantId: 'tenant-other', firstName: 'Other', lastName: 'Lead', status: 'new',
    });
  });

  const db = env.authenticatedContext('assigned-agent').firestore();
  await getDoc(doc(db, 'tenants/tenant-assigned/leads/lead-1'));
  await assertFails(getDoc(doc(db, 'tenants/tenant-other/leads/lead-2')));
  await assertFails(setDoc(doc(db, 'agentUsers/assigned-agent/assignments/tenant-other'), {
    agentUid: 'assigned-agent', tenantId: 'tenant-other', status: 'active', role: 'agent',
  }));
});

test('Firestore limits Brand-assigned agents inside an assigned tenant', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'agentUsers/brand-agent/assignments/tenant-brand'), {
      agentUid: 'brand-agent', tenantId: 'tenant-brand', status: 'active', role: 'agent', brandId: 'brand-a', brandIds: ['brand-a'],
    });
    await setDoc(doc(db, 'tenants/tenant-brand/leads/lead-a'), { tenantId: 'tenant-brand', brandId: 'brand-a', status: 'new' });
    await setDoc(doc(db, 'tenants/tenant-brand/leads/lead-b'), { tenantId: 'tenant-brand', brandId: 'brand-b', status: 'new' });
  });
  const db = env.authenticatedContext('brand-agent').firestore();
  await assertSucceeds(getDoc(doc(db, 'tenants/tenant-brand/leads/lead-a')));
  await assertFails(getDoc(doc(db, 'tenants/tenant-brand/leads/lead-b')));
});

test('Agent supervisors remain limited to their assigned tenant and Brands', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'agentUsers/assigned-supervisor/assignments/tenant-supervised'), {
      agentUid: 'assigned-supervisor', tenantId: 'tenant-supervised', status: 'active', role: 'supervisor', brandId: 'brand-a', brandIds: ['brand-a'],
    });
    await setDoc(doc(db, 'tenants/tenant-supervised/leads/lead-a'), { tenantId: 'tenant-supervised', brandId: 'brand-a', status: 'new' });
    await setDoc(doc(db, 'tenants/tenant-supervised/leads/lead-b'), { tenantId: 'tenant-supervised', brandId: 'brand-b', status: 'new' });
    await setDoc(doc(db, 'tenants/tenant-other/leads/lead-other'), { tenantId: 'tenant-other', brandId: 'brand-a', status: 'new' });
  });

  const db = env.authenticatedContext('assigned-supervisor').firestore();
  await assertSucceeds(getDoc(doc(db, 'tenants/tenant-supervised/leads/lead-a')));
  await assertFails(getDoc(doc(db, 'tenants/tenant-supervised/leads/lead-b')));
  await assertFails(getDoc(doc(db, 'tenants/tenant-other/leads/lead-other')));

  const storage = env.authenticatedContext('assigned-supervisor').storage();
  const bytes = new Uint8Array([76, 77, 83]);
  await assertSucceeds(uploadBytes(ref(storage, 'tenants/tenant-supervised/brands/brand-a/recordings/supervisor.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, 'tenants/tenant-supervised/brands/brand-b/recordings/supervisor.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, 'tenants/tenant-other/brands/brand-a/recordings/supervisor.txt'), bytes, { contentType: 'text/plain' }));
});

test('browser-supplied tenant ownership cannot grant direct lead writes', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'agentUsers/browser-agent/assignments/tenant-owned'), {
      agentUid: 'browser-agent', tenantId: 'tenant-owned', status: 'active', role: 'agent', brandId: 'brand-owned',
    });
  });
  const db = env.authenticatedContext('browser-agent').firestore();
  await assertFails(setDoc(doc(db, 'tenants/tenant-other/leads/forged'), { tenantId: 'tenant-other', brandId: 'brand-other', status: 'new' }));
  await assertFails(setDoc(doc(db, 'tenants/tenant-owned/leads/forged'), { tenantId: 'tenant-owned', brandId: 'brand-owned', status: 'new' }));
});

test('client, client supervisor, and client admin stay inside their tenant', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, role] of [['client-user', 'client'], ['client-supervisor', 'client_supervisor'], ['client-admin', 'client_admin']]) {
      await setDoc(doc(db, `tenants/tenant-role/members/${uid}`), { uid, tenantId: 'tenant-role', role, active: true });
    }
    await setDoc(doc(db, 'tenants/tenant-role/leads/lead-role'), { tenantId: 'tenant-role', status: 'new' });
    await setDoc(doc(db, 'tenants/tenant-private/leads/lead-private'), { tenantId: 'tenant-private', status: 'new' });
  });

  for (const uid of ['client-user', 'client-supervisor', 'client-admin']) {
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'tenants/tenant-role/leads/lead-role')));
    await assertFails(getDoc(doc(db, 'tenants/tenant-private/leads/lead-private')));
  }
});

test('LMS super admin claim can audit tenants but cannot be granted from tenant data', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'tenants/tenant-super/reports/report-super'), { tenantId: 'tenant-super', createdAt: '2026-01-01', updatedAt: '2026-01-01' });
  });
  const privileged = env.authenticatedContext('lms-admin', { lmsSuperAdmin: true }).firestore();
  await assertSucceeds(getDoc(doc(privileged, 'tenants/tenant-super/reports/report-super')));
  const unprivileged = env.authenticatedContext('fake-lms-admin', { role: 'lms_super_admin' }).firestore();
  await assertFails(getDoc(doc(unprivileged, 'tenants/tenant-super/reports/report-super')));
});

test('Storage denies unauthenticated and authenticated access', async () => {
  const unauthenticated = env.unauthenticatedContext().storage();
  const authenticated = env.authenticatedContext('customer-a', {
    tenantId: 'tenant-a',
    role: 'customer',
  }).storage();
  const bytes = new Uint8Array([76, 77, 83]);

  await assertFails(uploadBytes(ref(unauthenticated, 'tenants/tenant-a/evidence/a.txt'), bytes));
  await assertFails(uploadBytes(ref(authenticated, 'tenants/tenant-b/evidence/b.txt'), bytes));
  await assertFails(getBytes(ref(authenticated, 'tenants/tenant-a/evidence/a.txt')));
});

test('Storage permits validated files only within the active member tenant', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'tenants/tenant-storage/members/storage-client'), {
      uid: 'storage-client', tenantId: 'tenant-storage', role: 'client', active: true,
    });
  });
  const storage = env.authenticatedContext('storage-client').storage();
  const bytes = new Uint8Array([76, 77, 83]);
  await assertSucceeds(uploadBytes(ref(storage, 'tenants/tenant-storage/documents/doc-1/readme.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, 'tenants/other/documents/doc-2/readme.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, 'tenants/tenant-storage/documents/doc-3/file.exe'), bytes, { contentType: 'application/x-msdownload' }));
});

test('Storage limits assigned agents to their Brand path', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'agentUsers/storage-agent/assignments/tenant-storage-brand'), {
      agentUid: 'storage-agent', tenantId: 'tenant-storage-brand', status: 'active', role: 'agent', brandId: 'brand-a', brandIds: ['brand-a'],
    });
  });
  const storage = env.authenticatedContext('storage-agent').storage();
  const bytes = new Uint8Array([76, 77, 83]);
  await assertSucceeds(uploadBytes(ref(storage, 'tenants/tenant-storage-brand/brands/brand-a/recordings/call-a.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, 'tenants/tenant-storage-brand/brands/brand-b/recordings/call-b.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(storage, 'tenants/tenant-storage-brand/documents/legacy.txt'), bytes, { contentType: 'text/plain' }));
});

test('client administrators cannot forge onboarding, provider verification or approvals', async () => {
  const { deleteDoc, updateDoc } = require('firebase/firestore');
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db,'tenants/central/members/client-central'),{uid:'client-central',tenantId:'central',role:'client_admin',active:true});
    await setDoc(doc(db,'tenants/central/config/onboarding'),{tenantId:'central',revision:1});
    await setDoc(doc(db,'tenants/central/integrations/readiness'),{tenantId:'central',ghlVerified:false});
    await setDoc(doc(db,'tenants/central/campaignApprovals/program'),{tenantId:'central',status:'pending'});
    await setDoc(doc(db,'tenants/central/campaigns/program'),{tenantId:'central',managedBy:'onboarding',status:'paused'});
  });
  const db = env.authenticatedContext('client-central').firestore();
  for (const path of ['config/onboarding','integrations/readiness','campaignApprovals/program','campaigns/program']) {
    await assertFails(updateDoc(doc(db,`tenants/central/${path}`),{status:'active',ghlVerified:true}));
    await assertFails(deleteDoc(doc(db,`tenants/central/${path}`)));
  }
  await assertFails(getDoc(doc(db,'tenants/central/integrations/readiness')));
});

test('creative file paths are immutable: replacement requires a new document/version', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(),'tenants/cabinet/members/cabinet-user'),{uid:'cabinet-user',tenantId:'cabinet',role:'client_admin',active:true});
  });
  const storage = env.authenticatedContext('cabinet-user').storage();
  const file = ref(storage,'tenants/cabinet/documents/creative/readme.txt');
  await assertSucceeds(uploadBytes(file,new Uint8Array([1]),{contentType:'text/plain'}));
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(),'tenants/cabinet/documents/creative'),{tenantId:'cabinet',managedBy:'onboarding'});
  });
  await assertFails(uploadBytes(file,new Uint8Array([2]),{contentType:'text/plain'}));
});
