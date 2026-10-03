const core = require('./platform-core');

module.exports = {
  getAgentCollection: core.getAgentCollection,
  createAgentRecord: core.createAgentRecord,
  updateAgentRecord: core.updateAgentRecord,
  transitionLead: core.transitionLead,
  appointmentWorkflow: core.appointmentWorkflow,
  communications: core.communications,
  telnyxWebhook: core.telnyxWebhook,
};
