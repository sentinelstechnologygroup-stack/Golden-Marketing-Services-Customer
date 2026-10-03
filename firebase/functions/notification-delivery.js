const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { buildNotificationEmail, emailDeliveryAllowed, emailProviderConfigured } = require('./notification-delivery-contract');

if (!getApps().length) initializeApp();
const db = getFirestore();
const resendApiKey = defineSecret('RESEND_API_KEY');
const emailFrom = process.env.GMS_EMAIL_FROM || 'Golden Marketing Services <notifications@goldenmarketingservices.com>';
const customerPortalUrl = process.env.GMS_CUSTOMER_PORTAL_URL || 'https://customer.goldenmarketingservices.com';

async function updateDelivery(ref, status, detail = {}) {
  await ref.set({
    delivery: {
      email: {
        status,
        ...detail,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function auditDelivery({ tenantId, brandId, notificationId, recipientUid, action }) {
  await db.collection(`tenants/${tenantId}/auditLogs`).add({
    tenantId,
    brandId: brandId || null,
    actorUid: 'notification-delivery',
    action,
    target: notificationId,
    recipientUid,
    createdAt: FieldValue.serverTimestamp(),
  });
}

exports.deliverNotificationEmail = onDocumentCreated({
  document: 'tenants/{tenantId}/notifications/{notificationId}',
  secrets: [resendApiKey],
  retry: true,
}, async (event) => {
  const notification = event.data?.data();
  if (!notification) return;
  const { tenantId, notificationId } = event.params;
  const ref = event.data.ref;
  const recipientUid = String(notification.recipientUid || '');

  if (notification.tenantId !== tenantId || !recipientUid || recipientUid === 'all') {
    await updateDelivery(ref, 'skipped', { reason: 'invalid_recipient_contract' });
    return;
  }

  const [workflowSnapshot, preferenceSnapshot] = await Promise.all([
    db.doc(`tenants/${tenantId}/config/workflow`).get(),
    db.doc(`tenants/${tenantId}/notificationPreferences/${recipientUid}`).get(),
  ]);
  const workflow = workflowSnapshot.exists ? workflowSnapshot.data() : {};
  const preferences = preferenceSnapshot.exists ? preferenceSnapshot.data().preferences || {} : {};
  if (!emailDeliveryAllowed(workflow, preferences)) {
    await updateDelivery(ref, 'skipped', { reason: 'email_disabled' });
    return;
  }

  const apiKey = resendApiKey.value();
  if (!emailProviderConfigured(apiKey)) {
    await updateDelivery(ref, 'skipped', { reason: 'provider_not_configured' });
    return;
  }

  const user = await getAuth().getUser(recipientUid).catch(() => null);
  if (!user?.email || user.disabled) {
    await updateDelivery(ref, 'skipped', { reason: 'recipient_email_unavailable' });
    return;
  }

  const content = buildNotificationEmail({
    title: notification.title,
    body: notification.body,
    portalUrl: customerPortalUrl,
  });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `gms-${tenantId}-${notificationId}`,
    },
    body: JSON.stringify({ from: emailFrom, to: [user.email], ...content }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    await updateDelivery(ref, 'failed', { provider: 'resend', code: String(response.status) });
    await auditDelivery({ tenantId, brandId: notification.brandId, notificationId, recipientUid, action: 'notification.email.failed' });
    throw new Error(`Transactional email provider returned ${response.status}.`);
  }

  await updateDelivery(ref, 'delivered', { provider: 'resend', providerMessageId: result.id || null, deliveredAt: FieldValue.serverTimestamp() });
  await auditDelivery({ tenantId, brandId: notification.brandId, notificationId, recipientUid, action: 'notification.email.delivered' });
});
