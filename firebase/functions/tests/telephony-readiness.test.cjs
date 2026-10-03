const test = require('node:test');
const assert = require('node:assert/strict');
const {configurationIssues, recordingAllowed, selectOutboundNumber} = require('../telephony/readiness.cjs');
const {createProvider} = require('../telephony/providers.cjs');
const valid = {TELEPHONY_PROVIDER:'telnyx', TELNYX_CONNECTION_ID:'connection', TELNYX_PUBLIC_KEY:Buffer.alloc(32).toString('base64'), TELNYX_STATUS_WEBHOOK_URL:'https://example.com/webhook', TELEPHONY_STATUS_URL:'https://example.com/webhook', TELNYX_DIALING_RESTRICTIONS_VERIFIED:'true'};
test('activation rejects incomplete configuration even with the enable flag set', () => {
  assert.ok(configurationIssues({TELEPHONY_PROVIDER:'telnyx', TELEPHONY_ENABLED:'true'}).length);
  for (const key of Object.keys(valid).filter(key=>key!=='TELEPHONY_PROVIDER')) {
    const env = {...valid}; delete env[key]; assert.ok(configurationIssues(env).length, key);
  }
  assert.deepEqual(configurationIssues(valid), []);
});
test('activation rejects insecure or mismatched webhook URLs and malformed signing keys', () => {
  for (const patch of [{TELNYX_PUBLIC_KEY:'invalid'}, {TELNYX_STATUS_WEBHOOK_URL:'http://example.com'}, {TELEPHONY_STATUS_URL:'https://other.example/webhook'}]) assert.ok(configurationIssues({...valid,...patch}).length);
});
test('recording requires an explicit valid policy and recorded consent', () => {
  assert.equal(recordingAllowed({recordingRequested:true,recordingPolicy:'record_on_consent',recordingConsent:true}),true);
  assert.equal(recordingAllowed({recordingRequested:true,recordingPolicy:'record_on_consent'}),false);
  assert.equal(recordingAllowed({recordingRequested:true,recordingPolicy:'do_not_record',recordingConsent:true}),false);
  assert.equal(recordingAllowed({recordingRequested:true,recordingPolicy:'unknown',recordingConsent:true}),false);
  assert.equal(recordingAllowed({recordingRequested:true,recordingPolicy:'record_all'}),true);
});
test('Secret Manager placeholder line endings cannot count as credentials', () => {
  assert.throws(()=>createProvider('telnyx', {token:'not-configured\r\n',connectionId:'connection'}));
  assert.throws(()=>createProvider('telnyx', {token:'  ',connectionId:'connection'}));
});
test('campaign numbers take precedence and ambiguity fails closed', () => {
  const brand = {provider:'telnyx',status:'active',phoneNumber:'+15551234567'};
  const campaign = {...brand,campaignId:'campaign-a',phoneNumber:'+15551234568'};
  assert.equal(selectOutboundNumber([brand,campaign],'telnyx','campaign-a'),campaign);
  assert.equal(selectOutboundNumber([brand,campaign],'telnyx','campaign-b'),brand);
  assert.throws(()=>selectOutboundNumber([brand,{...brand}],'telnyx'));
  assert.throws(()=>selectOutboundNumber([campaign],'telnyx','campaign-b'));
  assert.throws(()=>selectOutboundNumber([brand],'legacy'));
});
