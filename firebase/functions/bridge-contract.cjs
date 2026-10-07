const REQUIRED_ROUTE_FIELDS = [
  'tenantId', 'brandId', 'industryId', 'sourceId', 'campaignId',
  'routingProfileId', 'workflowVersion', 'scriptSetId',
  'qualificationFormId', 'consentPolicyId', 'retentionPolicyId',
];

function text(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function assertRoute(route) {
  const missing = REQUIRED_ROUTE_FIELDS.filter((field) => !text(route?.[field], 200));
  if (missing.length) throw new Error(`Route is missing immutable fields: ${missing.join(', ')}`);
}

function canonicalLead(route, payload, assignedTo = null, clientContact = null) {
  assertRoute(route);
  const fullName = text(payload.name, 200);
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = text(payload.firstName, 100) || parts.shift() || 'Unknown';
  const lastName = text(payload.lastName, 100) || parts.join(' ') || 'Lead';
  return {
    tenantId: route.tenantId,
    organization_id: route.tenantId,
    brandId: route.brandId,
    brand_id: route.brandId,
    industry: route.industryId,
    industryId: route.industryId,
    sourceId: route.sourceId,
    source_id: route.sourceId,
    campaignId: route.campaignId,
    campaign_id: route.campaignId,
    routingProfileId: route.routingProfileId,
    workflowVersion: route.workflowVersion,
    scriptSetId: route.scriptSetId,
    qualificationFormId: route.qualificationFormId,
    consentPolicyId: route.consentPolicyId,
    retentionPolicyId: route.retentionPolicyId,
    notificationProfileId: route.notificationProfileId || 'default',
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: text(payload.email, 320).toLowerCase(),
    phone: text(payload.phone, 50),
    company: text(payload.company, 200),
    website: text(payload.website, 500),
    market: text(payload.market, 200),
    location: text(payload.market || payload.location, 200),
    volume: text(payload.volume, 100),
    services: Array.isArray(payload.services) ? payload.services.map((item) => text(item, 100)).filter(Boolean).slice(0, 25) : [],
    sources: Array.isArray(payload.sources) ? payload.sources.map((item) => text(item, 100)).filter(Boolean).slice(0, 25) : [],
    notes: text(payload.notes, 4000),
    pageUrl: text(payload.pageUrl, 1000),
    attribution: payload.attribution && typeof payload.attribution === 'object' ? payload.attribution : {},
    consent: payload.consent && typeof payload.consent === 'object' ? payload.consent : {},
    status: 'new',
    lead_status: 'new',
    qualificationStatus: 'pending',
    qualification_status: 'pending',
    assignedTo,
    assigned_to: assignedTo,
    routedClientContactId: clientContact?.id || null,
    routedClientContactName: clientContact?.name || null,
    contactAttempts: 0,
    contact_attempts: 0,
    priority: route.defaultPriority || 'normal',
    customerVisible: true,
    isTest: payload.isTest === true,
    contactVerification: {
      email: { status: 'pending', dispatchStatus: 'not_requested' },
      sms: { status: 'pending', dispatchStatus: 'not_requested' },
    },
    funnelProfile: {
      area: text(payload.funnelProfile?.area, 200),
      budgetRange: text(payload.funnelProfile?.budgetRange, 100),
      timeline: text(payload.funnelProfile?.timeline, 100),
      propertyType: text(payload.funnelProfile?.propertyType, 100),
      workingWithAgent: text(payload.funnelProfile?.workingWithAgent, 30),
      financingStatus: text(payload.funnelProfile?.financingStatus, 100),
      completionStatus: payload.funnelProfile?.completionStatus === 'completed' ? 'completed' : 'contact_captured',
    },
  };
}

module.exports = { REQUIRED_ROUTE_FIELDS, assertRoute, canonicalLead };
