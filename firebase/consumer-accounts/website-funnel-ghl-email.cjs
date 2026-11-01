const oauth = require('./gohighlevel-oauth-store.cjs');

async function send({db, tenantId, draftRef, draft, config, content}) {
  const connection = (await db.doc(`gmsProviderConnections/${tenantId}`).get()).data();
  const locationId = connection?.locationId;
  if (!locationId || config.emailProvider !== 'gohighlevel' || config.locationId !== locationId) throw new Error('Client email account is not configured.');
  const owner = (await db.doc(`ghlLocationTenants/${locationId}`).get()).data();
  if (owner?.tenantId !== tenantId || draft.lead.tenantId !== tenantId) throw new Error('Client email account ownership mismatch.');
  let fallback = {};
  try { fallback = JSON.parse(process.env.GMS_GOHIGHLEVEL_CONFIG || '{}'); } catch { throw new Error('Invalid CRM authorization configuration.'); }
  const token = await oauth.locationToken(locationId, fallback);
  if (!token) throw new Error('Client email authorization is unavailable.');
  const api = async (path, method = 'GET', body) => {
    const response = await fetch(`https://services.leadconnectorhq.com${path}`, {
      method, redirect:'error', signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${token}`,Version:'v3','Content-Type':'application/json'},
      ...(body ? {body:JSON.stringify(body)} : {}),
    });
    if (!response.ok) throw new Error(`Client email request was not accepted (${response.status}).`);
    return response.json();
  };
  let contactId = draft.emailContact?.locationId === locationId ? draft.emailContact.contactId : null;
  if (!contactId) {
    const result = await api('/contacts/upsert','POST',{
      locationId, firstName:draft.lead.firstName || draft.lead.name,
      lastName:draft.lead.lastName || '', email:draft.lead.email,
      source:config.siteName, createNewIfDuplicateAllowed:false,
    });
    const contact = result.contact;
    if (!contact?.id || contact.locationId !== locationId || String(contact.email || '').toLowerCase() !== draft.lead.email.toLowerCase()) throw new Error('Client email contact identity mismatch.');
    contactId = contact.id;
    await draftRef.update({emailContact:{locationId,contactId}});
  }
  const contact = (await api(`/contacts/${encodeURIComponent(contactId)}`)).contact;
  if (contact?.locationId !== locationId || String(contact.email || '').toLowerCase() !== draft.lead.email.toLowerCase() || contact.dnd || contact.dndSettings?.Email?.status === 'active' || contact.dndSettings?.email?.status === 'active') throw new Error('Client email recipient is suppressed or mismatched.');
  const result = await api('/conversations/messages','POST',{
    type:'Email', contactId, emailFrom:config.from, emailTo:draft.lead.email,
    subject:content.subject, html:content.html, message:content.text, status:'pending',
  });
  if (!result.messageId) throw new Error('Client email receipt missing.');
  return {id:result.messageId,locationId,contactId};
}
module.exports = {send};
