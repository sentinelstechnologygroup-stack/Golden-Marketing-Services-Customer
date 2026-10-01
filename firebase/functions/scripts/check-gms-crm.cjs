// Read-only production probe. Credentials are injected in memory, never printed.
if (process.env.GCLOUD_PROJECT !== 'linkmarketing-agent-portal-crm' || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Explicit production project required.');
if (!process.env.GMS_GOHIGHLEVEL_CONFIG) throw new Error('Backend credentials required.');
const functions = require('../index');
const { getAuth } = require('firebase-admin/auth');
async function main() {
  const admin = await getAuth().getUserByEmail('admin@goldenmarketingservices.com');
  const checks = [];
  for (const resource of ['conversations', 'calendars', 'opportunities', 'pipelines', 'workflows', 'forms', 'campaigns']) {
    try {
      const response = await functions.readGoHighLevelResource.run({ auth: { uid: admin.uid, token: {} }, data: { tenantId: 'gms-internal', resource, limit: 20 } });
      checks.push({ resource, status: 'ok', returned: response.items.length, excludedExamples: response.excludedExampleCount });
    } catch (error) { checks.push({ resource, status: error.code || 'error', providerStatus: error.details?.providerStatus }); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ checks }));
}
main().catch(error => { console.error(error.code || 'probe-failed'); process.exitCode = 1; });
