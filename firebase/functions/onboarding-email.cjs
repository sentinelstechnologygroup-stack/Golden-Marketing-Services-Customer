'use strict';
const PORTALS = Object.freeze({ staff: 'https://agentcrm.goldenmarketingservices.com', client: 'https://customer.goldenmarketingservices.com' });
const FROM = 'Golden Marketing Services <notifications@goldenmarketingservices.com>';
const escape = value => String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function brandedActionLink(firebaseLink, kind) {
  const source = new URL(firebaseLink), portal = PORTALS[kind];
  if (!portal || source.protocol !== 'https:' || source.hostname !== 'gms-prod-1089114348316.firebaseapp.com' || source.searchParams.get('mode') !== 'resetPassword' || !source.searchParams.get('oobCode')) throw new Error('Invalid setup link.');
  // A fragment keeps the password action code out of portal access logs/referrers.
  return `${portal}/set-password#code=${encodeURIComponent(source.searchParams.get('oobCode'))}`;
}
function buildSetupEmail({ kind, name, setupLink }) {
  const portal = PORTALS[kind];
  if (!portal || !setupLink.startsWith(portal + '/set-password#code=')) throw new Error('Invalid portal destination.');
  const label = kind === 'staff' ? 'Agent Workspace' : 'Customer Portal';
  const title = kind === 'staff' ? 'Your workspace starts here.' : 'Welcome to your GMS portal.';
  const intro = kind === 'staff' ? 'Your Golden Marketing Services account is ready to set up. Create your password, then sign in to your assigned workspace.' : 'Your Golden Marketing Services account is ready to set up. Create your password to access your customer workspace and follow your program’s activity.';
  const greeting = name ? `Hello ${escape(name)},` : 'Welcome,';
  const subject = kind === 'staff' ? 'Set up your Golden Marketing Services workspace' : 'Welcome to Golden Marketing Services — set up your portal';
  const guide = portal + '/getting-started.html';
  const html = `<!doctype html><html lang="en"><head><link rel="icon" type="image/png" href="${portal}/brand/gms-icon-512x512.png?v=gms-20261008"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head><body style="margin:0;background:#f4f1e9;font-family:Arial,Helvetica,sans-serif;color:#183239"><div style="display:none;max-height:0;overflow:hidden">Create your password. Open your portal. Make it part of your desktop.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e4dfd4;border-radius:16px;overflow:hidden"><tr><td style="background:#001922;padding:28px 32px;border-top:4px solid #c9a24b"><img src="${portal}/brand/gms-logo-horizontal-transparent.png" width="238" alt="Golden Marketing Services" style="display:block;width:238px;max-width:100%;height:auto"><p style="margin:22px 0 0;color:#dec687;font-size:11px;letter-spacing:2px;text-transform:uppercase">${label} · Account setup</p></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 22px;color:#001922;font-size:30px;line-height:1.15">${title}</h1><p style="font-size:15px;line-height:1.7;margin:0 0 12px">${greeting}</p><p style="font-size:15px;line-height:1.7;margin:0 0 26px">${intro}</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#001922" style="border-radius:8px"><a href="${escape(setupLink)}" style="display:inline-block;padding:15px 24px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px">Create my password &nbsp; →</a></td></tr></table><p style="margin:28px 0 10px;font-size:12px;font-weight:bold;letter-spacing:1.4px;color:#14857f">YOUR NEXT THREE STEPS</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.65"><tr><td style="padding:6px 0;color:#9b7628;width:28px">01</td><td>Create your personal password.</td></tr><tr><td style="padding:6px 0;color:#9b7628">02</td><td><a href="${portal}/login" style="color:#001922;font-weight:bold">Sign in to your ${label.toLowerCase()}.</a></td></tr><tr><td style="padding:6px 0;color:#9b7628">03</td><td>Add your portal to your desktop for faster access.</td></tr></table><p style="margin:22px 0 0;padding:17px;background:#f7f4ed;border-radius:8px;font-size:14px;line-height:1.65"><a href="${guide}" style="font-weight:bold;color:#14857f">Open the quick-start guide →</a><br>Sign-in, desktop installation, updates, and access from our website—all in one short guide.</p><p style="font-size:12px;line-height:1.6;color:#66777b;margin:24px 0 0">This setup link is personal. Please don’t forward it. If the link expires, ask your GMS administrator for a new setup email. If you weren’t expecting this account, you can leave it unused and contact GMS.</p></td></tr><tr><td style="padding:22px 32px;border-top:1px solid #eee9df;font-size:12px;line-height:1.6;color:#66777b"><strong style="color:#001922">Golden Marketing Services</strong><br>Built for a better first connection.<br><a href="https://goldenmarketingservices.com" style="color:#66777b">Visit our website</a> &nbsp; · &nbsp; <a href="https://goldenmarketingservices.com/get-started" style="color:#66777b">Contact GMS</a></td></tr></table></td></tr></table></body></html>`;
  const text = `${title}\n\n${name ? 'Hello '+name+',' : 'Welcome,'}\n\n${intro}\n\nCreate your password: ${setupLink}\n\nSign in: ${portal}/login\nQuick-start guide (desktop installation and website access): ${guide}\n\nThis link is personal. Do not forward it. If it expires, ask your GMS administrator for a new setup email.\n\nGolden Marketing Services\nhttps://goldenmarketingservices.com`;
  return { subject, html, text };
}
async function sendSetupEmail({ apiKey, auth, email, name, kind, requestId }, transport = fetch) {
  if (!/^re_[A-Za-z0-9_-]+$/.test(String(apiKey || ''))) return { delivery:'blocked', reason:'email_service_not_configured' };
  const portal = PORTALS[kind];
  if (!portal) throw new Error('Invalid portal type.');
  const generated = await auth.generatePasswordResetLink(email, { url:portal+'/login', handleCodeInApp:false });
  const content = buildSetupEmail({ kind, name, setupLink:brandedActionLink(generated,kind) });
  const response = await transport('https://api.resend.com/emails', { method:'POST', redirect:'error', signal:AbortSignal.timeout(20000), headers:{ Authorization:'Bearer '+apiKey, 'Content-Type':'application/json', 'Idempotency-Key':requestId }, body:JSON.stringify({ from:FROM, to:[email], ...content }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) return { delivery:'failed', reason:'sender_or_delivery_not_confirmed' };
  return { delivery:'accepted', providerMessageId:result.id };
}
module.exports = { PORTALS, FROM, buildSetupEmail, brandedActionLink, sendSetupEmail };
