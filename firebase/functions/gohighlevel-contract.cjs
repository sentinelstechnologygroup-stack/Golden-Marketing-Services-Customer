// A deliberately finite API surface, not a general-purpose CRM proxy.
const RESOURCES = Object.freeze({
  conversations: { path: '/conversations/search', key: 'conversations', scope: 'conversations.readonly' },
  calendars: { path: '/calendars/', key: 'calendars', scope: 'calendars.readonly' },
  opportunities: { path: '/opportunities/search', key: 'opportunities', scope: 'opportunities.readonly' },
  pipelines: { path: '/opportunities/pipelines', key: 'pipelines', scope: 'opportunities.readonly' },
  workflows: { path: '/workflows/', key: 'workflows', scope: 'workflows.readonly' },
  forms: { path: '/forms/', key: 'forms', scope: 'forms.readonly' },
  campaigns: { path: '/campaigns/', key: 'campaigns', scope: 'campaigns.readonly' },
});

function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) throw new Error('Invalid identifier.');
  return value;
}

function readRequest(resource, locationId, input = {}) {
  const definition = Object.hasOwn(RESOURCES, resource) ? RESOURCES[resource] : null;
  if (!definition) throw new Error('Unsupported GoHighLevel resource.');
  const query = new URLSearchParams({ locationId: identifier(locationId) });
  if (['conversations', 'opportunities', 'forms'].includes(resource)) {
    const limit = Number(input.limit ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Limit must be between 1 and 100.');
    query.set('limit', String(limit));
  }
  if (input.query && ['conversations', 'opportunities'].includes(resource)) query.set(resource === 'opportunities' ? 'q' : 'query', String(input.query).slice(0, 75));
  // locationId, paths, tokens and arbitrary query options are never client-controlled.
  return { path: `${definition.path}?${query}`, key: definition.key };
}

function publicRows(key, payload, locationId) {
  if (!Array.isArray(payload[key])) throw new Error('Invalid GoHighLevel response.');
  const fields = {
    conversations: ['id', 'contactId', 'contactName', 'fullName', 'lastMessageBody', 'lastMessageType', 'unreadCount', 'lastMessageDate'],
    calendars: ['id', 'name', 'description', 'isActive', 'calendarType'],
    opportunities: ['id', 'name', 'contactId', 'pipelineId', 'pipelineStageId', 'status', 'monetaryValue', 'updatedAt'],
    pipelines: ['id', 'name'],
    workflows: ['id', 'name', 'status', 'version', 'updatedAt'],
    forms: ['id', 'name'],
    campaigns: ['id', 'name', 'status'],
  }[key];
  if (!fields) throw new Error('Unsupported response.');
  return payload[key].slice(0, 100).map((row) => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string') throw new Error('Invalid provider row.');
    if (row.locationId && row.locationId !== locationId) throw new Error('GoHighLevel location mismatch.');
    const result = Object.fromEntries(fields.filter((field) => row[field] !== undefined && (row[field] === null || ['string', 'number', 'boolean'].includes(typeof row[field]))).map((field) => [field, row[field]]));
    if (key === 'pipelines' && Array.isArray(row.stages)) result.stages = row.stages.slice(0, 100).map(stage => ({ id: identifier(stage.id), name: String(stage.name || '').slice(0, 200) }));
    return result;
  });
}

function isExampleRow(row) {
  return [row.name, row.contactName, row.fullName].some(value => typeof value === 'string' && /^\(example\)\s/i.test(value));
}

function locationPayload(tenant, organization, config) {
  if (!config.companyId || !config.snapshotId) throw new Error('Agency and approved GMS snapshot must be configured.');
  return {
    name: tenant.name, companyId: identifier(config.companyId), snapshotId: identifier(config.snapshotId),
    timezone: organization.settings?.timezone || 'America/Chicago',
    country: 'US', settings: { allowDuplicateContact: false, allowDuplicateOpportunity: false },
  };
}

module.exports = { RESOURCES, identifier, readRequest, publicRows, locationPayload, isExampleRow };
