'use strict';
const crypto = require('node:crypto');
const CAMPAIGN = '4b3001a1-8004-8c4f-a3d2-e2660a814a3e';
const TCR = 'CGWEP9X';
const hash = (...parts) => crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const phone = value => /^\+1[2-9]\d{9}$/.test(String(value || '')) ? value : null;
const key = (tenantId, leadId) => hash(tenantId, leadId);
const recipientKey = (route, to) => hash(route.tenantId, route.brandId, to);
function captureConsent(route, payload, now = Date.now()) {
  const c = payload.consent?.sms;
  if (!phone(payload.phone) || c?.accepted !== true || !route.smsDisclosureVersion
    || c.disclosureVersion !== route.smsDisclosureVersion || !route.smsDisclosureText
    || !route.smsRouteId || !route.smsAllowedPageUrls?.includes(payload.pageUrl)) return null;
  return { tenantId: route.tenantId, brandId: route.brandId, campaignId: route.campaignId,
    routeId: route.smsRouteId, to: payload.phone, accepted: true, capturedAtMs: now,
    disclosureVersion: route.smsDisclosureVersion, disclosureText: route.smsDisclosureText,
    sourceUrl: payload.pageUrl, consentPolicyId: route.consentPolicyId };
}
function assertAllowed({route, intake, lead, suppression, enabled, now = Date.now()}) {
  if (!enabled) throw new Error('sms_disabled');
  if (!route || route.mode !== 'internal_test' || route.enabled !== true) throw new Error('route_disabled');
  if (route.telnyxCampaignId !== CAMPAIGN || route.tcrCampaignId !== TCR
    || route.brandName !== 'Golden Cross Realty') throw new Error('campaign_not_authorized');
  if (!intake || intake.accepted !== true || !intake.disclosureText || !intake.disclosureVersion
    || !intake.sourceUrl || !intake.consentPolicyId) throw new Error('consent_missing');
  if (route.tenantId !== intake.tenantId || route.brandId !== intake.brandId
    || lead.tenantId !== intake.tenantId || lead.brandId !== intake.brandId
    || lead.campaignId !== intake.campaignId || lead.phone !== intake.to
    || !route.campaignIds?.includes(intake.campaignId)) throw new Error('scope_mismatch');
  if (!phone(intake.to) || !phone(route.from) || !route.profileId || !route.numberId) throw new Error('number_unconfigured');
  if (!route.internalTestNumbers?.includes(intake.to)) throw new Error('internal_test_only');
  if (suppression?.blocked === true) throw new Error('recipient_opted_out');
  if (!(intake.capturedAtMs <= now && intake.capturedAtMs > now - 15 * 60000)) throw new Error('consent_capture_expired');
  const v = route.evidence;
  if (!v || v.campaignStatus !== 'MNO_PROVISIONED' || v.numberStatus !== 'ASSIGNED'
    || v.from !== route.from || v.numberId !== route.numberId || v.profileId !== route.profileId
    || v.tenantId !== route.tenantId || v.brandId !== route.brandId
    || v.telnyxCampaignId !== CAMPAIGN || v.tcrCampaignId !== TCR
    || v.optOutAutoResponseVerified !== true || v.webhookVerified !== true
    || !(v.checkedAtMs <= now && v.checkedAtMs > now - 3600000)) throw new Error('provider_evidence_required');
}
function verificationText(code) {
  return `Golden Cross Realty: Reply ${code} to verify the mobile number for your home inquiry. Expires in 10 minutes. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`;
}
function classify(text, autoResponse) {
  const keyword = String(text || '').trim().toUpperCase();
  if (autoResponse === 'STOP' || autoResponse === 'stop' || ['STOP','STOPALL','STOP ALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPT OUT'].includes(keyword)) return 'stop';
  if (['START','UNSTOP'].includes(keyword)) return 'start';
  if (keyword === 'HELP') return 'help';
  return /^\d{6}$/.test(keyword) ? 'code' : 'reply';
}
function validateReply(binding, text, now, occurredAtMs) {
  return binding && binding.status !== 'verified' && binding.attempts < 5
    && now < binding.expiresAtMs && occurredAtMs >= binding.createdAtMs
    && occurredAtMs <= now + 30000 && hash(binding.nonce, String(text).trim()) === binding.codeHash;
}
function deliveryStatus(type, payload) {
  const status = payload.to?.[0]?.status;
  if (type === 'message.finalized') return ['delivered','delivery_failed','sending_failed'].includes(status) ? status : 'delivery_unknown';
  return type === 'message.sent' ? 'sent' : null;
}
module.exports = { CAMPAIGN, TCR, hash, phone, key, recipientKey, captureConsent, assertAllowed, verificationText, classify, validateReply, deliveryStatus };
