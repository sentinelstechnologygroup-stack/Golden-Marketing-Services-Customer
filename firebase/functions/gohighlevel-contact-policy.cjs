const { identifier } = require('./gohighlevel-contract.cjs');

function verifiedContact(contact, lead, locationId, contactId) {
  identifier(contactId);
  if (!contact || contact.id !== contactId || contact.locationId !== locationId) {
    throw new Error('Contact does not belong to the client location.');
  }
  const email = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const phone = value => typeof value === 'string' ? value.replace(/\D/g, '') : '';
  const matchingEmail = email(lead.email) && email(lead.email) === email(contact.email);
  const matchingPhone = phone(lead.phone).length >= 10 && phone(lead.phone) === phone(contact.phone);
  if (!matchingEmail && !matchingPhone) throw new Error('Contact identity does not match this lead.');
  const digits=phone(lead.phone);
  return { contactId, locationId, ...(matchingPhone ? {phone:digits.length===10?`+1${digits}`:`+${digits}`} : {}) };
}

module.exports = { verifiedContact };
