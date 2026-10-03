function emailProviderConfigured(apiKey) {
  const value = String(apiKey || '').trim();
  return Boolean(value && value !== 'not-configured' && value !== 'placeholder');
}

function emailDeliveryAllowed(workflow = {}, preferences = {}) {
  const channels = Array.isArray(workflow.notificationChannels) ? workflow.notificationChannels : [];
  if (!channels.includes('email')) return false;
  if (preferences.email === false || preferences.emailNotifications === false) return false;
  if (preferences.channels && preferences.channels.email === false) return false;
  return true;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildNotificationEmail({ title, body, portalUrl }) {
  const cleanTitle = String(title || 'Golden Marketing Services notification').trim().slice(0, 180);
  const cleanBody = String(body || '').trim().slice(0, 5000);
  const destination = `${String(portalUrl || 'https://customer.goldenmarketingservices.com').replace(/\/$/, '')}/notifications`;
  return {
    subject: cleanTitle,
    text: `${cleanBody}\n\nOpen your protected customer portal: ${destination}`,
    html: `<div style="font-family:Arial,sans-serif;color:#082b34;line-height:1.6"><h2>${escapeHtml(cleanTitle)}</h2><p>${escapeHtml(cleanBody)}</p><p><a href="${escapeHtml(destination)}">Open your protected customer portal</a></p><p style="font-size:12px;color:#66777d">This message contains no lead or customer-sensitive details. Sign in to view the protected record.</p></div>`,
  };
}

module.exports = { buildNotificationEmail, emailDeliveryAllowed, emailProviderConfigured };
