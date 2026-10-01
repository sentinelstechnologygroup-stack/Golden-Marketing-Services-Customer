// Operator maintenance: uses existing Google application-default credentials.
// Never creates a login, changes customer ownership or prints provider secrets.
if (process.env.GCLOUD_PROJECT !== 'linkmarketing-agent-portal-crm' || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Explicit production project required.');
if (!process.env.GMS_GOHIGHLEVEL_CONFIG) throw new Error('Inject Secret Manager configuration in memory first.');
const functions = require('../index');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
async function main() {
  const tenantId = 'gms-internal'; const locationId = '5BAXXiLlxJSiM5tspPQy';
  const admin = await getAuth().getUserByEmail('admin@goldenmarketingservices.com');
  if (admin.disabled || admin.customClaims?.mustChangePassword || admin.customClaims?.lmsSuperAdmin !== true) throw new Error('Active GMS Super Admin required.');
  const db = getFirestore();
  const existing = await db.doc(`tenants/${tenantId}/config/onboarding`).get();
  const call = data => ({ auth: { uid: admin.uid, token: {} }, data });
  if (existing.exists && existing.data().data?.locationId !== locationId) throw new Error('Existing GMS workspace has a different location; refusing overwrite.');
  if (!existing.exists) {
    if ((await db.doc(`tenants/${tenantId}`).get()).exists) throw new Error('Workspace exists without onboarding; review before linking.');
    await functions.saveGmsClient.run(call({ clientId: tenantId, create: true, revision: 0, data: {
      name: 'Golden Marketing Services', legalName: 'Golden Marketing Services', brandName: 'Golden Marketing Services',
      industry: 'marketing-agency', phone: '+12532226335', domain: 'https://goldenmarketingservices.com',
      address: '26029 Dobbin Huffsmith Rd, Magnolia, TX 77354', timezone: 'America/Chicago',
      adminEmail: '', locationId, phoneNumber: '', phoneSid: '', campaigns: [],
      notes: 'GMS internal operations workspace. No customer login, fixture records or campaign intake provisioned.',
    } }));
  }
  await db.doc(`tenants/${tenantId}`).update({ workspaceKind: 'internal' });
  await functions.connectExistingGoHighLevelLocation.run(call({ tenantId, locationId }));
  const checked = await functions.verifyGoHighLevelConnection.run(call({ tenantId }));
  const reads = {};
  for (const resource of checked.verifiedResources) {
    const result = await functions.readGoHighLevelResource.run(call({ tenantId, resource, limit: 1 }));
    reads[resource] = { returned: result.items.length, source: result.source };
  }
  console.log(JSON.stringify({ tenantId, locationId, status: checked.status, reads, messagingEnabled: checked.messagingEnabled }));
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
