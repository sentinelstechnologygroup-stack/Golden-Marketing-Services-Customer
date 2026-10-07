const { normalize } = require('./client-onboarding-policy.cjs');
function mergeProfile(current, location, locationId) {
  if (!location || location.id !== locationId) throw new Error('GoHighLevel location mismatch.');
  const patch = {};
  const copy = (field, value) => { if (typeof value === 'string' && value.trim()) patch[field] = value.trim(); };
  copy('name', location.name);
  copy('legalName', location.business?.name);
  copy('phone', location.phone);
  copy('domain', location.website);
  copy('timezone', location.timezone);
  const address = ['address', 'city', 'state', 'postalCode', 'country'].map(k => location[k]).filter(v => typeof v === 'string' && v.trim()).join(', ');
  copy('address', address);
  // Business email is contact information, never an invitation or authorization.
  const data = normalize({ ...current, ...patch });
  data.businessEmail = typeof location.email === 'string' ? location.email.trim().slice(0, 254) : (current.businessEmail || '');
  return data;
}
module.exports = { mergeProfile };
