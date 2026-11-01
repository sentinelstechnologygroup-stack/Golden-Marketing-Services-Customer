const crypto = require('node:crypto');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const HOLD_MS = 300000;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = code => Object.assign(new Error(code), { code });
function cleanTelemetry(input = {}) {
  const duration = value => Number.isFinite(value) ? Math.max(0, Math.min(value, 86400000)) : 0;
  return { source: 'browser_reported', visibleContactMs: duration(input?.visibleContactMs), visiblePreferencesMs: duration(input?.visiblePreferencesMs),
    events: (Array.isArray(input?.events) ? input.events : []).slice(0,100).map(event => ({ button: text(event?.button,80), clientAt: text(event?.clientAt,40) })) };
}
function profile(input = {}) {
  const result = Object.fromEntries(['area','city','zip','neighborhood','location','minPrice','maxPrice','beds','baths','propertyType','newConstruction','priceReduced','newListings','availability','minSqft','waterfront','bounds','polygon','boardId','mlsNumber','propertyAddress','inquiryContext','budgetRange','timeline','workingWithAgent'].map(key => [key, text(input[key])]));
  result.interested_in = ['buying','selling','investing','buying_and_selling'].includes(input.interested_in) ? input.interested_in : '';
  result.message = text(input.message, 2000);
  result.weeklyListingPreferencePresented = input.weeklyListingPreferencePresented === true;
  result.weeklyListingEmailsRequested = result.weeklyListingPreferencePresented && input.weeklyListingEmailsRequested === true;
  if (result.minPrice || result.maxPrice) result.budgetRange = `${result.minPrice ? '$' + result.minPrice : 'No minimum'} - ${result.maxPrice ? '$' + result.maxPrice : 'No maximum'}`;
  return result;
}
function publish(tx, db, ref, draft, now, reason) {
  const stamp = Timestamp.fromMillis(now);
  const leadRef = ref.parent.parent.collection('leads').doc(draft.leadId);
  tx.set(leadRef, { ...draft.lead, funnelProfile: draft.profile, capturedAt: draft.capturedAt,
    receivedAt: stamp, inboxDeliveredAt: stamp, createdAt: stamp, updatedAt: stamp,
    contactVerification: Object.fromEntries(['email','sms'].map(channel => [channel, {status: draft.verification?.[channel]?.status || 'pending', ...(draft.verification?.[channel]?.verifiedAt ? {verifiedAt: draft.verification[channel].verifiedAt} : {})}])),
    createdBy: 'server:website-funnel', queueReleaseReason: reason, communicationsSuppressed: true, funnelTelemetry: draft.telemetry || cleanTelemetry() });
  if (reason === 'preferences_completed') tx.update(leadRef, { preferencesSubmittedAt: stamp });
  tx.create(ref.parent.parent.collection('auditLogs').doc(), { tenantId: draft.lead.tenantId,
    actorUid: 'server:website-funnel', action: 'lead.inbox_delivered', target: draft.leadId, occurredAt: stamp, createdAt: stamp });
  if (draft.lead.assignedTo) tx.create(ref.parent.parent.collection('notifications').doc(), {
    tenantId: draft.lead.tenantId, brandId: draft.lead.brandId, recipientUid: draft.lead.assignedTo,
    audiences: ['agent'], type: 'lead_received', title: 'New lead received', body: `${draft.lead.name} entered the phone-agent queue.`,
    relatedId: draft.leadId, isTest: draft.lead.isTest, communicationsSuppressed: true, readAt: null, createdAt: stamp, updatedAt: stamp });
  require('./listing-email-policy.cjs').recordPreferenceAndTask({tx,root:ref.parent.parent,leadId:draft.leadId,lead:draft.lead,input:draft.profile,stamp});
  tx.update(ref, { state: 'released', inboxDeliveredAt: stamp, releaseDueAt: FieldValue.delete(), updatedAt: stamp });
}
function message(tx, ref, draft, kind, now, extra = {}) {
  tx.create(ref.collection('messages').doc(kind), {
    tenantId: draft.lead.tenantId, brandId: draft.lead.brandId, leadId: draft.leadId,
    kind, status: 'pending', isTest: draft.lead.isTest === true,
    createdAt: Timestamp.fromMillis(now), ...extra,
  });
}
async function capture({ db, routeKey, route, lead, submissionId, secret, telemetry, now = Date.now() }) {
  if (!/^[a-f0-9-]{36}$/i.test(submissionId || '')) throw fail('invalid-submission');
  const token = crypto.createHmac('sha256', secret).update(`${routeKey}:${submissionId}`).digest('hex');
  const ref = db.doc(`tenants/${route.tenantId}/websiteFunnelDrafts/${digest(`${routeKey}:${submissionId}`)}`);
  const fingerprint = digest(JSON.stringify([lead.name, lead.email, lead.phone, lead.consent?.version]));
  const result = await db.runTransaction(async tx => {
    const prior = await tx.get(ref);
    if (prior.exists) { if (prior.data().fingerprint !== fingerprint) throw fail('intake-conflict'); return prior.data(); }
    const rateRef = ref.parent.parent.collection('websiteIntakeLimits').doc(digest(`${routeKey}:${lead.phone}:${Math.floor(now / 600000)}`));
    const rate = await tx.get(rateRef);
    if ((rate.data()?.count || 0) >= 5) throw fail('intake-throttled');
    const stamp = Timestamp.fromMillis(now);
    const verification = Object.fromEntries(['email','sms'].map(channel => {
      const value = crypto.createHmac('sha256', secret).update(`verify:${channel}:${routeKey}:${submissionId}`).digest('hex');
      return [channel, {tokenHash: digest(value), expiresAt: Timestamp.fromMillis(now + 172800000), status: 'pending'}];
    }));
    const draft = { routeKey, tokenHash: digest(token), fingerprint, leadId: ref.parent.parent.collection('leads').doc().id,
      verification,
      lead, telemetry: cleanTelemetry(telemetry), profile: { ...profile(lead.funnelProfile), completionStatus: 'contact_captured' }, state: 'held',
      capturedAt: stamp, lastActiveAt: stamp, releaseDueAt: Timestamp.fromMillis(now + HOLD_MS), updatedAt: stamp };
    tx.create(ref, draft);
    for (const channel of ['email','sms']) {
      if (channel === 'sms' && lead.consent?.smsAccepted !== true) continue;
      const verificationToken = crypto.createHmac('sha256', secret).update(`verify:${channel}:${routeKey}:${submissionId}`).digest('hex');
      message(tx, ref, draft, `verify_${channel}`, now, {verificationToken});
    }
    tx.set(rateRef, { count: (rate.data()?.count || 0) + 1, expiresAt: new Date(now + 86400000) });
    return draft;
  });
  return { accepted: true, leadId: result.leadId, sessionId: ref.id, sessionToken: token, state: result.state };
}
async function update({ db, route, routeKey, sessionId, sessionToken, action, input, telemetry, now = Date.now() }) {
  if (!/^[a-f0-9]{64}$/.test(sessionId || '') || !/^[a-f0-9]{64}$/.test(sessionToken || '')) throw fail('invalid-session');
  const ref = db.doc(`tenants/${route.tenantId}/websiteFunnelDrafts/${sessionId}`);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref); const draft = snapshot.data();
    if (!draft || draft.routeKey !== routeKey) throw fail('invalid-session');
    if (['verify_email','verify_sms'].includes(action)) {
      const channel = action.slice(7), verification = draft.verification?.[channel];
      if (!verification || verification.tokenHash !== digest(sessionToken) || verification.expiresAt.toMillis() < now) throw fail('invalid-session');
      tx.update(ref, { [`verification.${channel}.status`]: 'verified', [`verification.${channel}.verifiedAt`]: Timestamp.fromMillis(now) });
      if (draft.state === 'released') tx.update(ref.parent.parent.collection('leads').doc(draft.leadId), { [`contactVerification.${channel}.status`]: 'verified', [`contactVerification.${channel}.verifiedAt`]: Timestamp.fromMillis(now) });
      return {accepted: true, leadId: draft.leadId, state: draft.state};
    }
    if (draft.tokenHash !== digest(sessionToken)) throw fail('invalid-session');
    const stamp = Timestamp.fromMillis(now);
    if (action === 'complete') {
      const enriched = { ...draft, telemetry: telemetry ? cleanTelemetry(telemetry) : draft.telemetry, profile: { ...profile(input), completionStatus: 'completed' } };
      const market = enriched.profile.area || enriched.profile.city || enriched.profile.zip || enriched.profile.neighborhood || draft.lead.market || '';
      const interest = {buying:'Buying',selling:'Selling',investing:'Investment Properties',buying_and_selling:'Buying & Selling'}[enriched.profile.interested_in];
      enriched.lead = { ...draft.lead, ...(interest ? {services:[interest]} : {}), market, location: market,
        notes: [draft.lead.notes, enriched.profile.message].filter(Boolean).join('\n') };
      if (draft.state === 'held') {
        tx.update(ref, { profile: enriched.profile, telemetry: enriched.telemetry, preferencesSubmittedAt: stamp });
        publish(tx, db, ref, enriched, now, 'preferences_completed');
      } else {
        const leadRef = ref.parent.parent.collection('leads').doc(draft.leadId);
        const current = (await tx.get(leadRef)).data();
        const notes = enriched.profile.message && enriched.profile.message !== current.funnelProfile?.message
          ? [current.notes, `Website inquiry update: ${enriched.profile.message}`].filter(Boolean).join('\n') : current.notes || '';
        require('./listing-email-policy.cjs').recordPreferenceAndTask({tx,root:ref.parent.parent,leadId:draft.leadId,lead:current,input:enriched.profile,stamp});
        tx.update(leadRef, { ...(interest ? {services:[interest]} : {}), funnelProfile: enriched.profile, funnelTelemetry: enriched.telemetry, market, location: market, notes, preferencesSubmittedAt: stamp, updatedAt: stamp });
        tx.update(ref, { profile: enriched.profile, telemetry: enriched.telemetry, preferencesSubmittedAt: stamp, updatedAt: stamp });
      }
      if (!draft.confirmationQueuedAt) {
        message(tx, ref, draft, 'search_confirmation', now);
        tx.update(ref, {confirmationQueuedAt: stamp});
      }
    } else if (draft.state === 'held') {
      // Hidden signals are estimates; only the form's own close action is explicit.
      const patch = { updatedAt: stamp, ...(telemetry ? { telemetry: cleanTelemetry(telemetry) } : {}) };
      if (action === 'active') Object.assign(patch, { lastActiveAt: stamp, releaseDueAt: Timestamp.fromMillis(now + HOLD_MS) });
      else if (['exit','hidden'].includes(action)) Object.assign(patch, { exitSignalAt: stamp, exitSignal: action, releaseDueAt: Timestamp.fromMillis(now + HOLD_MS) });
      else throw fail('invalid-action');
      tx.update(ref, patch);
    }
    return { accepted: true, leadId: draft.leadId, state: action === 'complete' ? 'released' : draft.state };
  });
}
async function releaseDue({ db, now = Date.now(), tenantId = null }) {
  const collection = tenantId ? db.collection(`tenants/${tenantId}/websiteFunnelDrafts`) : db.collectionGroup('websiteFunnelDrafts');
  const rows = await collection.where('releaseDueAt', '<=', Timestamp.fromMillis(now)).limit(200).get();
  let released = 0;
  for (const row of rows.docs) await db.runTransaction(async tx => {
    const fresh = await tx.get(row.ref); const draft = fresh.data();
    if (!draft || draft.state !== 'held' || draft.releaseDueAt.toMillis() > now) return;
    const route = await tx.get(db.doc(`ingestionRoutes/${draft.routeKey}`));
    // A pause or revoked ownership must also stop scheduled release.
    if (route.data()?.status !== 'active' || route.data().tenantId !== draft.lead.tenantId || route.data().brandId !== draft.lead.brandId) return;
    if (!await require('./website-route-readiness.cjs').ready(db, route.data())) return;
    publish(tx, db, row.ref, draft, now, 'five_minute_hold_expired'); released++;
  });
  return released;
}
module.exports = { capture, update, releaseDue, publish, HOLD_MS };
