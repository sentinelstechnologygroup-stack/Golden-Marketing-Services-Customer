const core = require('./platform-core');

module.exports = {
  getAgentCollection: core.getAgentCollection,
  createAgentRecord: core.createAgentRecord,
  updateAgentRecord: core.updateAgentRecord,
  transitionLead: core.transitionLead,
  appointmentWorkflow: core.appointmentWorkflow,
  createCommunicationCallback: core.createCommunicationCallback,
  getIncomingCallContext: core.getIncomingCallContext,
  communications: core.communications,
  getCommunicationsQueue: core.getCommunicationsQueue,
  getCommunicationRecord: core.getCommunicationRecord,
  updateCommunicationsQueue: core.updateCommunicationsQueue,
  getCommunicationMedia: core.getCommunicationMedia,
  telnyxWebhook: core.telnyxWebhook,
};
