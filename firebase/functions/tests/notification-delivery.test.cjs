const assert = require('node:assert/strict');
const test = require('node:test');
const { buildNotificationEmail, emailDeliveryAllowed, emailProviderConfigured } = require('../notification-delivery-contract');

test('email provider readiness rejects placeholders', () => {
  assert.equal(emailProviderConfigured(''), false);
  assert.equal(emailProviderConfigured('not-configured'), false);
  assert.equal(emailProviderConfigured('placeholder'), false);
  assert.equal(emailProviderConfigured('re_live_configured'), true);
});

test('tenant channels and user preferences control email delivery', () => {
  assert.equal(emailDeliveryAllowed({ notificationChannels: ['in_app', 'email'] }, {}), true);
  assert.equal(emailDeliveryAllowed({ notificationChannels: ['in_app'] }, {}), false);
  assert.equal(emailDeliveryAllowed({ notificationChannels: ['email'] }, { email: false }), false);
  assert.equal(emailDeliveryAllowed({ notificationChannels: ['email'] }, { channels: { email: false } }), false);
});

test('notification email excludes protected records and escapes content', () => {
  const email = buildNotificationEmail({ title: '<Lead ready>', body: '<script>private</script>', portalUrl: 'https://customer.goldenmarketingservices.com/' });
  assert.equal(email.subject, '<Lead ready>');
  assert.match(email.html, /&lt;Lead ready&gt;/);
  assert.match(email.html, /&lt;script&gt;private&lt;\/script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /customer\.goldenmarketingservices\.com\/notifications/);
});
