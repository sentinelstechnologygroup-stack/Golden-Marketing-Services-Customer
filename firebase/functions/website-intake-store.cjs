const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function fingerprint(lead) {
  // Server receipt times and assignment selection may change during a retry.
  return hash(JSON.stringify([lead.name,lead.email,lead.phone,lead.services,lead.market,lead.notes,lead.pageUrl,
    lead.attribution,lead.funnelProfile,lead.consent?.accepted,lead.consent?.version,lead.consent?.text,
    lead.consent?.channels,lead.consent?.smsAccepted,lead.isTest]));
}
function failure(code) { return Object.assign(new Error(code), {code}); }
async function persistWebsiteLead({db,routeKey,route,leadRef,lead,idempotencyKey,brandName,clientContactUid,notificationRecipients}) {
  const key = String(idempotencyKey || '');
  if (key && !/^[a-f0-9]{64}$/.test(key)) throw failure('intake-key');
  const root = db.doc(`tenants/${route.tenantId}`);
  const receipt = key ? root.collection('websiteIntakeReceipts').doc(hash(`${routeKey}:${key}`)) : null;
  const digest = fingerprint(lead);
  const rate = key ? root.collection('websiteIntakeLimits').doc(hash(`${routeKey}:${lead.phone || lead.email}:${Math.floor(Date.now()/600000)}`)) : null;
  // The lead, receipt, audit and notification commit together. A response lost
  // after commit can safely be retried without duplicate queue items or alerts.
  return db.runTransaction(async tx => {
    const prior = receipt ? await tx.get(receipt) : null;
    if (prior?.exists) {
      if (prior.data().fingerprint !== digest) throw failure('intake-conflict');
      return {leadId:prior.data().leadId,duplicate:true};
    }
    const limit = rate ? await tx.get(rate) : null;
    if ((limit?.data()?.count || 0) >= 5) throw failure('intake-throttled');
    const now = FieldValue.serverTimestamp();
    tx.create(leadRef,{...lead,receivedAt:now,createdAt:now,updatedAt:now,createdBy:'server:website-ingestion'});
    if (receipt) tx.create(receipt,{leadId:leadRef.id,fingerprint:digest,routeKey,createdAt:now});
    if (rate) tx.set(rate,{count:(limit?.data()?.count || 0)+1,expiresAt:new Date(Date.now()+86400000)});
    tx.create(root.collection('auditLogs').doc(),{tenantId:route.tenantId,actorUid:'server:website-ingestion',action:'lead.ingested',target:leadRef.id,metadata:{brandId:route.brandId,routeKey,assignedTo:lead.assignedTo},occurredAt:now,createdAt:now});
    // Dedicated GMS-first routes notify phone staff at intake. The customer can
    // receive the later qualification/handoff activity through existing flows.
    const recipients = lead.intakeStage === 'gms_qualification' || route.intakeStage === 'gms_qualification' ? [lead.assignedTo] : (notificationRecipients || [lead.assignedTo,clientContactUid]);
    for (const uid of [...new Set(recipients.filter(Boolean))]) tx.create(root.collection('notifications').doc(),{
      tenantId:route.tenantId,brandId:route.brandId,recipientUid:uid,audiences:lead.intakeStage === 'gms_qualification' || route.intakeStage === 'gms_qualification' ? ['agent'] : ['agent','customer'],
      type:'lead_received',title:'New lead received',body:`${lead.name} entered the ${brandName || 'client'} queue.`,relatedId:leadRef.id,readAt:null,createdAt:now,updatedAt:now});
    return {leadId:leadRef.id,duplicate:false};
  });
}
module.exports={persistWebsiteLead,fingerprint};
