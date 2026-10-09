'use strict';
const PRESETS = Object.freeze({
  agent: { label: 'Phone agent', permissions: ['lead.work', 'call.place', 'qualification.save', 'callback.manage', 'appointment.manage'] },
  supervisor: { label: 'Supervisor', permissions: ['lead.work', 'call.place', 'queue.manage', 'lead.assign', 'quality.review', 'report.view'] },
  ai_admin: { label: 'AI admin', permissions: ['ai.workflow.configure', 'ai.results.review'] },
  gms_super_admin: { label: 'Super admin', permissions: ['staff.manage', 'client.manage', 'system.manage', 'ai.global.manage'] },
});
function input(value) {
  const role = value?.role;
  if (!Object.hasOwn(PRESETS, role)) throw new Error('Choose a predefined staff role.');
  const email = String(value.email || '').trim().toLowerCase();
  const name = String(value.name || '').trim();
  const tenantId = String(value.tenantId || '');
  const brandIds = [...new Set(value.brandIds || [])];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 100) throw new Error('Enter a name and valid email.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId) || !brandIds.length || brandIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id))) throw new Error('Choose a client and at least one permitted brand.');
  return { role, email, name, tenantId, brandIds, permissions: [...PRESETS[role].permissions] };
}
function collectionAllowed(role, collection, write = false) {
  if (role === 'gms_super_admin' || ['client_admin','client_supervisor','admin','supervisor'].includes(role)) {
    // Staff supervisors have assignment.role supervisor, rather than tenant membership.
    if (role !== 'supervisor') return true;
  }
  if (['invoices','documents','organizations','auditLogs'].includes(collection)) return false;
  if (role === 'ai_admin') return !write && ['brands','campaigns','scripts','qualificationForms','leadSources','routingRules','phoneNumbers','callRecords','callTranscripts','callQualityReviews','leads'].includes(collection);
  if (write && role === 'agent') return ['leads','followUpTasks','communicationAlerts','callRecords','appointments'].includes(collection);
  return true;
}
module.exports = { PRESETS, input, collectionAllowed };
