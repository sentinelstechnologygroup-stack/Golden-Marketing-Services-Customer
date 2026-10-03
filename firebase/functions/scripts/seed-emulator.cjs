const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ projectId: 'demo-gms-local' });
const db = getFirestore();

const COLLECTIONS = [
  'organizations', 'brands', 'campaigns', 'leadSources', 'leads',
  'followUpTasks', 'communicationAlerts', 'callRecords', 'callTranscripts',
  'callQualityReviews', 'appointments', 'businessOwners', 'scripts',
  'qualificationForms', 'routingRules', 'phoneNumbers', 'reports', 'billing',
  'invoices', 'documents', 'supportRequests', 'notifications', 'auditLogs',
];

async function main() {
  const tenantId = process.env.SEED_TENANT_ID || 'tenant-demo';
  const uid = process.env.SEED_UID || 'admin-demo';
  await db.doc(`tenants/${tenantId}`).set({ tenantId, name: 'Local Emulator Tenant', environment: 'emulator', vertical: 'real-estate', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`tenants/${tenantId}/members/${uid}`).set({ uid, tenantId, email: 'admin@local.test', role: 'admin', active: true, brandIds: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`tenants/${tenantId}/config/schema`).set({ tenantId, environment: 'emulator', collections: COLLECTIONS, updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`tenants/${tenantId}/dashboard/summary`).set({ tenantId, environment: 'emulator', metrics: {}, sevenDay: [], funnel: [], sources: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  console.log(`Seeded emulator-only ${tenantId} with ${COLLECTIONS.length} collection definitions`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
