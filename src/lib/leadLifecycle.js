export const LMS_LIFECYCLE = [
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'verified_prospect', label: 'Verified Prospect' },
  { key: 'qualified_lead', label: 'Qualified Lead' },
  { key: 'contacted_lead', label: 'Contacted Lead' },
  { key: 'qualified_handoff', label: 'Qualified Handoff' },
  { key: 'warm_transfer_appointment', label: 'Warm Transfer / Appointment' },
  { key: 'accepted_handoff', label: 'Accepted Handoff' },
  { key: 'client_outcome', label: 'Client Outcome' },
];

export const lifecycleLabel = (value) =>
  LMS_LIFECYCLE.find((stage) => stage.key === value)?.label || 'Inquiry';

export function verificationState(lead = {}) {
  const raw = String(lead.verificationStatus || lead.verification_status || '').toLowerCase();
  if (raw === 'verified' || lead.phoneVerified === true) return { key: 'verified', label: 'Mobile Verified' };
  if (raw === 'failed') return { key: 'failed', label: 'Verification Failed' };
  if (raw === 'sent') return { key: 'sent', label: 'Verification Sent' };
  if (raw === 'not_required') return { key: 'not_required', label: 'Not Required' };
  return { key: 'pending', label: 'Verification Pending' };
}

export function derivePortalLifecycle(lead = {}) {
  const explicit = lead.lifecycleStage || lead.lifecycle_stage;
  if (explicit) return explicit;

  const disposition = String(lead.disposition || '').toLowerCase();
  const stage = String(lead.stage || '').toLowerCase();
  const acceptance = String(lead.customerAcceptance || lead.owner_acceptance_status || '').toLowerCase();

  if (disposition.includes('closed') || stage.includes('client outcome')) return 'client_outcome';
  if (acceptance === 'accepted' || stage.includes('accepted handoff') || stage === 'handed off') return 'accepted_handoff';
  if (lead.appointment || lead.liveTransfer || stage.includes('appointment') || stage.includes('live transfer')) return 'warm_transfer_appointment';
  if (stage.includes('qualified handoff')) return 'qualified_handoff';
  if (stage.includes('conversation') || stage.includes('contacted')) return 'contacted_lead';
  if (String(lead.qualification || '').toLowerCase() === 'qualified' || stage === 'qualified') return 'qualified_lead';
  if (verificationState(lead).key === 'verified') return 'verified_prospect';
  return 'inquiry';
}
