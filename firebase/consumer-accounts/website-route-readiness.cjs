async function ready(db, route) {
  if (route.status !== 'active') return false;
  if (route.managedBy !== 'onboarding') return true;
  const policy = require('./client-onboarding-policy.cjs');
  const [config, connection, approval] = await Promise.all([
    db.doc(`tenants/${route.tenantId}/config/onboarding`).get(),
    db.doc(`tenants/${route.tenantId}/integrations/readiness`).get(),
    db.doc(`tenants/${route.tenantId}/campaignApprovals/${route.campaignId}`).get(),
  ]);
  const data = config.data()?.data;
  const campaign = data?.campaigns?.find(c => c.id === route.campaignId);
  const verified = connection.data() || {};
  return Boolean(campaign && config.data()?.lifecycle === 'routing_enabled' && config.data()?.revision === route.onboardingRevision
    && verified.configHash === policy.connectionVersion(data) && verified.ghlVerified === true && verified.phoneVerified === true
    // Fresh verification is required when enabling routing. Once enabled, the
    // approved route stays open until its configuration or evidence changes.
    && Number.isFinite(verified.verifiedAtMs) && verified.verifiedAtMs > 0 && verified.verifiedAtMs <= Date.now()
    && approval.data()?.status === 'approved' && approval.data()?.version === policy.campaignVersion(campaign));
}
module.exports = { ready };

// Operational capture is separate from broker qualification/billing approval.
async function operationalReady(db,route){if(!route||route.status!=='active')return false;if(route.managedBy!=='onboarding')return true;const [c,v]=await Promise.all([db.doc('tenants/'+route.tenantId+'/config/onboarding').get(),db.doc('tenants/'+route.tenantId+'/integrations/readiness').get()]);const x=c.data(),e=v.data();return Boolean(x?.lifecycle==='routing_enabled'&&x.data?.campaigns?.some(a=>a.id===route.campaignId)&&e?.ghlVerified===true&&e.phoneVerified===true&&e.configHash===require('./client-onboarding-policy.cjs').connectionVersion(x.data));}
module.exports.operationalReady=operationalReady;
