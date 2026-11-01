'use strict';
const crypto = require('node:crypto');
const p = require('./policy.cjs');
// All authoritative state lives at top-level server-only paths. Lead fields are projections.
function createMessagingService({db, transport = fetch, token, enabled = false, now = Date.now}) {
  const doc = path => db.doc(path);
  const leadRef = x => doc(`tenants/${x.tenantId}/leads/${x.leadId}`);
  function receipt(tx, ref, lead, entry, extra = {}) {
    const history = [...(lead.smsMessages || []), {...entry, at: new Date(now()).toISOString()}].slice(-50);
    tx.update(ref, {smsMessages: history, ...extra});
  }
  async function send(intakeId) {
    const intakeRef = doc(`smsIntakes/${intakeId}`);
    const intake = (await intakeRef.get()).data();
    if (!intake) return;
    const route = (await doc(`smsRoutes/${intake.routeId}`).get()).data();
    if (!route) return;
    const recipient = p.recipientKey(route, intake.to);
    const suppressionRef = doc(`smsSuppressions/${recipient}`);
    const bindingRef = doc(`smsBindings/${p.hash(route.from, intake.to)}`);
    const outboundRef = doc(`smsOutbound/${intakeId}`);
    const ref = leadRef(intake);
    const code = String(crypto.randomInt(100000, 1000000));
    const nonce = crypto.randomBytes(32).toString('hex');
    // Reserve once before contacting Telnyx. Unknown outcomes require reconciliation, never blind retry.
    const reserved = await db.runTransaction(async tx => {
      const [leadSnap, suppressSnap, bindingSnap, outboundSnap, routeSnap] = await Promise.all([
        tx.get(ref), tx.get(suppressionRef), tx.get(bindingRef), tx.get(outboundRef), tx.get(doc(`smsRoutes/${intake.routeId}`)),
      ]);
      if (outboundSnap.exists) return false;
      const lead = leadSnap.data();
      try {
        p.assertAllowed({route: routeSnap.data(), intake, lead: lead || {}, suppression: suppressSnap.data(), enabled, now: now()});
        if (JSON.stringify(routeSnap.data()) !== JSON.stringify(route)) throw new Error('route_changed');
        if (bindingSnap.exists) throw new Error('existing_conversation_requires_review');
      } catch (error) {
        if (leadSnap.exists) receipt(tx, ref, lead, {direction:'system', text:'SMS verification withheld', status:error.message}, {smsVerification:{status:'blocked', reason:error.message}});
        tx.set(outboundRef, {status:'blocked', reason:error.message, tenantId:intake.tenantId, leadId:intake.leadId});
        return false;
      }
      const state = {...intake, from:route.from, profileId:route.profileId, nonce, codeHash:p.hash(nonce, code),
        status:'reserved', attempts:0, createdAtMs:now(), expiresAtMs:now()+600000, outboundId:intakeId};
      tx.set(bindingRef, state);
      tx.set(outboundRef, {...state, codeHash: null, nonce: null});
      receipt(tx, ref, lead, {direction:'outbound', text:p.verificationText('[redacted]'), status:'reserved'}, {smsVerification:{status:'pending'}});
      return true;
    });
    if (!reserved) return;
    async function recordDispatchProblem(status) {
      await db.runTransaction(async tx => {
        const lead = await tx.get(ref);
        tx.update(outboundRef, {status});
        if (lead.exists) receipt(tx, ref, lead.data(), {direction:'system', status, text:'Verification dispatch requires operator review.'});
      });
    }
    // Check suppression and kill switch again immediately before dispatch.
    const [s, r] = await Promise.all([suppressionRef.get(), doc(`smsRoutes/${intake.routeId}`).get()]);
    if (s.data()?.blocked || r.data()?.enabled !== true || JSON.stringify(r.data()) !== JSON.stringify(route)) {
      await recordDispatchProblem('canceled'); return;
    }
    let result;
    try {
      const response = await transport('https://api.telnyx.com/v2/messages', {
        method:'POST', signal:AbortSignal.timeout(15000), headers:{Authorization:`Bearer ${token()}`, 'Content-Type':'application/json'},
        body:JSON.stringify({from:route.from, to:intake.to, messaging_profile_id:route.profileId, text:p.verificationText(code), type:'SMS'}),
      });
      result = await response.json();
      if (!response.ok || !result.data?.id) throw new Error('provider_result_requires_review');
    } catch {
      await recordDispatchProblem('reconciliation_required');
      return;
    }
    await db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      const current = await tx.get(outboundRef);
      tx.set(doc(`smsProviderMessages/${p.hash(result.data.id)}`), {outboundId:intakeId, providerMessageId:result.data.id});
      tx.update(outboundRef, {providerMessageId:result.data.id, status:current.data()?.finalized ? current.data().status : 'accepted'});
      if (snapshot.exists) receipt(tx, ref, snapshot.data(), {direction:'system', status:'accepted', text:'Telnyx accepted verification message; delivery not yet confirmed.'});
    });
  }
  async function webhook(event) {
    const payload = event.payload || {};
    if (!event.id || !payload.id || !['message.received','message.sent','message.finalized'].includes(event.event_type)) return;
    const seen = doc(`smsEvents/${p.hash(event.id)}`);
    if (event.event_type !== 'message.received') {
      const mapping = (await doc(`smsProviderMessages/${p.hash(payload.id)}`).get()).data();
      // Provider can deliver a callback before POST response is persisted: request a retry.
      if (!mapping) throw new Error('unmapped_provider_message');
      const outboundRef = doc(`smsOutbound/${mapping.outboundId}`);
      await db.runTransaction(async tx => {
        const [seenSnap, outSnap] = await Promise.all([tx.get(seen), tx.get(outboundRef)]);
        if (seenSnap.exists) return;
        const out = outSnap.data();
        if (!out || payload.from?.phone_number !== out.from || payload.to?.length !== 1
          || payload.to[0].phone_number !== out.to || payload.messaging_profile_id !== out.profileId) throw new Error('callback_scope_mismatch');
        const ref = leadRef(out), lead = await tx.get(ref);
        const status = p.deliveryStatus(event.event_type, payload);
        tx.set(seen, {processedAtMs:now(), type:event.event_type});
        if (!out.finalized && status) {
          tx.update(outboundRef, {status, finalized:event.event_type === 'message.finalized'});
          if (lead.exists) receipt(tx, ref, lead.data(), {direction:'system', text:'Verification message delivery update', status});
        }
      });
      return;
    }
    const from = payload.from?.phone_number, to = payload.to?.[0]?.phone_number;
    if (!p.phone(from) || !p.phone(to) || payload.to.length !== 1) return;
    const route = (await doc(`smsNumberRoutes/${p.hash(to)}`).get()).data();
    if (!route || route.from !== to || route.profileId !== payload.messaging_profile_id) throw new Error('unknown_inbound_route');
    const suppress = doc(`smsSuppressions/${p.recipientKey(route, from)}`);
    const bindingRef = doc(`smsBindings/${p.hash(to, from)}`);
    await db.runTransaction(async tx => {
      const [seenSnap, bindingSnap, suppression] = await Promise.all([tx.get(seen), tx.get(bindingRef), tx.get(suppress)]);
      if (seenSnap.exists) return;
      const binding = bindingSnap.data();
      const validBinding = binding && binding.tenantId === route.tenantId && binding.brandId === route.brandId && binding.profileId === route.profileId;
      const ref = validBinding ? leadRef(binding) : null;
      const lead = ref ? await tx.get(ref) : null;
      const kind = p.classify(payload.text, payload.autoresponse_type);
      tx.set(seen, {processedAtMs:now(), type:event.event_type});
      if (kind === 'stop') tx.set(suppress, {blocked:true, tenantId:route.tenantId, brandId:route.brandId, to:from, sourceEventId:event.id, atMs:now()});
      // START records intent but never overrides a suppression or establishes new campaign consent.
      if (!validBinding || !lead?.exists || lead.data().tenantId !== binding.tenantId
        || lead.data().brandId !== binding.brandId || lead.data().phone !== from) return;
      const extra = {};
      let status = kind;
      if (kind === 'stop') {
        tx.update(bindingRef, {status:'opted_out'});
        extra.smsVerification = {status:'opted_out'};
      } else if (kind === 'code' && !suppression.data()?.blocked && binding.status !== 'opted_out') {
        const verified = p.validateReply(binding, payload.text, now(), Date.parse(event.occurred_at));
        if (verified) {
          tx.update(bindingRef, {status:'verified', verifiedAtMs:now()});
          extra.smsVerification = {status:'verified', method:'sms_reply_code', verifiedAt:new Date(now()).toISOString(), phone:from};
          status = 'verified';
        } else if (binding.status !== 'verified') {
          tx.update(bindingRef, {attempts:(binding.attempts || 0)+1});
          status = 'invalid_or_expired_code';
        }
      }
      receipt(tx, ref, lead.data(), {direction:'inbound', text:kind === 'code' ? '[verification code redacted]' : String(payload.text || '').slice(0,2000), status}, extra);
    });
  }
  return {send, webhook};
}
module.exports = {createMessagingService};
