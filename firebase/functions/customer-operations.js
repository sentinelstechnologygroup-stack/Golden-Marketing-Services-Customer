const core = require('./platform-core');
const initialPassword = require('./initial-password');

module.exports = {
  completeInitialPasswordChange: initialPassword.completeInitialPasswordChange,
  getCustomerCollection: core.getCustomerCollection,
  getMyProfile: core.getMyProfile,
  getAccountWorkspace: core.getAccountWorkspace,
  updateMyProfile: core.updateMyProfile,
  getSecurityWorkspace: core.getSecurityWorkspace,
  updateSecuritySettings: core.updateSecuritySettings,
  revokeAllSessions: core.revokeAllSessions,
  updateTenantProfile: core.updateTenantProfile,
  updateMemberRole: core.updateMemberRole,
  setMembershipStatus: core.setMembershipStatus,
  createInvitation: core.createInvitation,
  acceptInvitation: core.acceptInvitation,
  listMyMemberships: core.listMyMemberships,
  createSupportRequest: core.createSupportRequest,
  createBillingReview: core.createBillingReview,
  updateNotificationPreferences: core.updateNotificationPreferences,
  getNotificationWorkspace: core.getNotificationWorkspace,
  createDocumentMetadata: core.createDocumentMetadata,
  addSupportReply: core.addSupportReply,
  getDashboardWorkspace: core.getDashboardWorkspace,
  getLiveReport: core.getLiveReport,
};
