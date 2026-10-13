const core = require('./platform-core');
const bridge = require('./bridge');

module.exports = {
  ...require('./client-onboarding'),
  health: core.health,
  setOperationalGrant: core.setOperationalGrant,
  getOperationalPermissions: core.getOperationalPermissions,
  createAgentAssignment: core.createAgentAssignment,
  revokeAgentAssignment: core.revokeAgentAssignment,
  setIndustryConfig: core.setIndustryConfig,
  provisionClient: bridge.provisionClient,
  registerTenantAsset: bridge.registerTenantAsset,
  projectLeadActivity: bridge.projectLeadActivity,
  projectAppointmentActivity: bridge.projectAppointmentActivity,
};
