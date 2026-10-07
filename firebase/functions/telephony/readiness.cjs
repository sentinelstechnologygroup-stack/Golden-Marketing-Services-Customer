'use strict';

function configurationIssues(env) {
  const issues = [];
  if (env.TELEPHONY_PROVIDER === 'telnyx') {
    for (const key of ['TELNYX_CONNECTION_ID', 'TELNYX_BROWSER_CONNECTION_ID', 'TELNYX_PUBLIC_KEY', 'TELNYX_STATUS_WEBHOOK_URL', 'TELEPHONY_STATUS_URL']) {
      if (!env[key] || env[key] === 'not-configured') issues.push(key);
    }
    if(env.TELNYX_CONNECTION_ID===env.TELNYX_BROWSER_CONNECTION_ID) issues.push('TELNYX_CONNECTION_SEPARATION');
    try {
      if (Buffer.from(env.TELNYX_PUBLIC_KEY || '', 'base64').length !== 32) issues.push('TELNYX_PUBLIC_KEY_FORMAT');
      for (const key of ['TELNYX_STATUS_WEBHOOK_URL', 'TELEPHONY_STATUS_URL']) {
        const url = new URL(env[key]);
        if (url.protocol !== 'https:' || url.username || url.password) issues.push(key + '_FORMAT');
      }
    } catch { issues.push('TELNYX_CONFIGURATION_FORMAT'); }
    if (env.TELNYX_STATUS_WEBHOOK_URL !== env.TELEPHONY_STATUS_URL) issues.push('TELNYX_WEBHOOK_URL_MISMATCH');
    // Set only after provider-side dialing restrictions have been verified.
    // A server-selected dial instruction cannot restrict a browser SDK token.
    if (env.TELNYX_DIALING_RESTRICTIONS_VERIFIED !== 'true') issues.push('TELNYX_DIALING_RESTRICTIONS_VERIFIED');
    if((env.DEFAULT_RECORDING_POLICY || 'record_on_consent')!=='do_not_record' && env.GMS_RECORDING_PIPELINE_READY!=='true') issues.push('GMS_RECORDING_PIPELINE_READY');
  }
  if (!['do_not_record', 'record_on_consent', 'record_all'].includes(env.DEFAULT_RECORDING_POLICY || 'record_on_consent')) issues.push('DEFAULT_RECORDING_POLICY');
  return [...new Set(issues)];
}

function recordingAllowed(call) {
  return call.recordingRequested === true && (call.recordingPolicy === 'record_all' ||
    (call.recordingPolicy === 'record_on_consent' && call.recordingConsent === true));
}

function selectOutboundNumber(numbers, provider, campaignId) {
  const active = numbers.filter(row=>row.status==='active' && row.provider===provider);
  const campaign = campaignId ? active.filter(row=>row.campaignId===campaignId) : [];
  const candidates = campaign.length ? campaign : active.filter(row=>!row.campaignId);
  if(candidates.length!==1 || !/^\+[1-9]\d{7,14}$/.test(candidates[0].phoneNumber || '')) throw new Error('Configure one unambiguous outbound number for this Brand or campaign.');
  return candidates[0];
}

module.exports = { configurationIssues, recordingAllowed, selectOutboundNumber };
