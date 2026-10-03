const crypto = require('node:crypto');
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
function id(value) {
  const result = text(value, 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(result)) throw new Error('Identifiers must contain only letters, numbers, underscores and hyphens.');
  return result;
}
function normalize(input = {}) {
  const data = {
    name: text(input.name, 200), legalName: text(input.legalName, 200),
    adminEmail: text(input.adminEmail, 254).toLowerCase(), phone: text(input.phone, 30),
    domain: text(input.domain, 300), address: text(input.address, 500), industry: text(input.industry, 100),
    timezone: text(input.timezone, 80) || 'America/Chicago', brandName: text(input.brandName, 200),
    locationId: text(input.locationId, 100), phoneNumber: text(input.phoneNumber, 30),
    telnyxPhoneNumberId: text(input.telnyxPhoneNumberId, 100), billingNotes: text(input.billingNotes, 2000), notes: text(input.notes, 4000),
    campaigns: (Array.isArray(input.campaigns) ? input.campaigns : []).slice(0, 12).map(c => ({
      id: id(c.id).toLowerCase(), name: text(c.name, 200), type: text(c.type, 100), source: text(c.source, 200),
      calendarId: text(c.calendarId, 100), pipelineId: text(c.pipelineId, 100),
      agentUids: [...new Set((Array.isArray(c.agentUids) ? c.agentUids : []).map(uid => id(uid)))].slice(0, 30),
      script: text(c.script, 20000), qualification: text(c.qualification, 12000),
      consent: text(c.consent, 4000), adCopy: text(c.adCopy, 12000),
      documentIds: [...new Set((Array.isArray(c.documentIds) ? c.documentIds : []).map(d => id(d)))].slice(0, 20),
    })),
  };
  if (!data.name) throw new Error('Client name is required to save a draft.');
  if (data.campaigns.some(c => c.id.length > 40)) throw new Error('Campaign identifiers must be 40 characters or fewer.');
  if (data.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail)) throw new Error('Enter a valid client administrator email.');
  if (data.phoneNumber && !/^\+[1-9]\d{7,14}$/.test(data.phoneNumber)) throw new Error('Use international phone format, for example +13125551234.');
  if (data.locationId && !/^[a-zA-Z0-9_-]+$/.test(data.locationId)) throw new Error('Invalid GoHighLevel location ID.');
  if (data.telnyxPhoneNumberId && !/^[0-9]{1,30}$/.test(data.telnyxPhoneNumberId)) throw new Error('Invalid Telnyx phone number ID.');
  try { new Intl.DateTimeFormat('en', { timeZone: data.timezone }); } catch { throw new Error('Enter a valid time zone.'); }
  if (new Set(data.campaigns.map(c => c.id)).size !== data.campaigns.length) throw new Error('Campaign identifiers must be unique.');
  return data;
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const campaignVersion = campaign => digest(campaign);
const connectionVersion = data => digest({ locationId: data.locationId, phoneNumber: data.phoneNumber, telnyxPhoneNumberId: data.telnyxPhoneNumberId });
function readiness(data, { connections = {}, membershipReady = false, approvals = {}, agentsReady = false, documentsReady = false, now = Date.now() } = {}) {
  const verified = connections.configHash === connectionVersion(data) && connections.verifiedAtMs > now - 86400000 && connections.verifiedAtMs <= now;
  const checks = [
    { key: 'profile', label: 'Client profile', ready: Boolean(data.name && data.brandName && data.industry && data.adminEmail) },
    { key: 'ghl', label: 'GoHighLevel connection verified by backend', ready: Boolean(data.locationId && verified && connections.ghlVerified) },
    { key: 'phone', label: 'Phone connection verified by backend', ready: Boolean(data.phoneNumber && data.telnyxPhoneNumberId && verified && connections.phoneVerified) },
    { key: 'membership', label: 'Customer portal membership', ready: membershipReady },
    { key: 'campaigns', label: 'Campaigns, scripts, qualification and consent', ready: data.campaigns.length > 0 && data.campaigns.every(c => c.name && c.type && c.source && c.script && c.qualification && c.consent && c.adCopy) },
    { key: 'agents', label: 'Active campaign-specific agents', ready: data.campaigns.length > 0 && agentsReady && data.campaigns.every(c => c.agentUids.length > 0) },
    { key: 'documents', label: 'Creative files available in client cabinet', ready: documentsReady && data.campaigns.length > 0 && data.campaigns.every(c => c.documentIds.length > 0) },
    { key: 'approvals', label: 'Customer approval of current campaign versions', ready: data.campaigns.length > 0 && data.campaigns.every(c => approvals[c.id]?.status === 'approved' && approvals[c.id]?.version === campaignVersion(c)) },
  ];
  const completed = checks.filter(c => c.ready).length;
  return { checks, percent: Math.floor(completed / checks.length * 100), ready: completed === checks.length };
}
module.exports = { id, normalize, campaignVersion, connectionVersion, readiness };
