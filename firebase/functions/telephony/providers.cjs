'use strict';
const crypto = require('node:crypto');
const PROVIDERS = ['twilio', 'telnyx', 'signalwire'];
function selectedProvider(value) {
  if (!PROVIDERS.includes(value)) throw new Error('Select exactly one supported TELEPHONY_PROVIDER.');
  return value;
}
function required(config, keys) {
  for (const key of keys) if (!config[key] || config[key] === 'not-configured') throw new Error(`Missing telephony configuration: ${key}`);
}
function xml(value) { return String(value).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])); }
function createProvider(name, config, transport = fetch) {
  selectedProvider(name);
  const compat = name !== 'telnyx';
  required(config, compat ? ['accountId', 'token'] : ['token', 'connectionId']);
  let base;
  if (name === 'signalwire') {
    const space = new URL(config.spaceUrl);
    if (space.protocol !== 'https:' || !space.hostname.endsWith('.signalwire.com') || space.username || space.password || space.pathname !== '/') throw new Error('Invalid SignalWire space URL.');
    base = `${space.origin}/api/laml/2010-04-01/Accounts/${encodeURIComponent(config.accountId)}`;
  } else base = compat ? `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountId)}` : 'https://api.telnyx.com/v2';
  async function request(path, values = {}, method = 'POST') {
    const response = await transport(base + path, {
      method, signal: AbortSignal.timeout(15000),
      headers: { Authorization: compat ? `Basic ${Buffer.from(`${config.accountId}:${config.token}`).toString('base64')}` : `Bearer ${config.token}`, 'Content-Type': compat ? 'application/x-www-form-urlencoded' : 'application/json' },
      ...(method === 'GET' ? {} : {body: compat ? new URLSearchParams(Object.entries(values).filter(([,v])=>v !== undefined).map(([k,v])=>[k,String(v)])) : JSON.stringify(values)}),
    });
    const body = await response.json();
    if (!response.ok) { const error = new Error('Phone service rejected the request.'); error.providerStatus = response.status; throw error; }
    return compat ? body : body.data;
  }
  const callPath = id => compat ? `/Calls/${encodeURIComponent(id)}.json` : `/calls/${encodeURIComponent(id)}/actions`;
  const conferencePath = id => compat ? `/Conferences/${encodeURIComponent(id)}` : `/conferences/${encodeURIComponent(id)}/actions`;
  return {
    name,
    async start({to, from, callbackUrl, voiceUrl, commandId}) {
      required({from,callbackUrl,...(compat?{voiceUrl}:{})}, compat?['from','callbackUrl','voiceUrl']:['from','callbackUrl']);
      const result = await request(compat ? '/Calls.json' : '/calls', compat ? {To:to,From:from,Url:voiceUrl,StatusCallback:callbackUrl,StatusCallbackEvent:'initiated ringing answered completed'} : {to,from,connection_id:config.connectionId,webhook_url:callbackUrl,command_id:commandId});
      return {id:result.sid || result.call_control_id, status:result.status || 'queued'};
    },
    end(id) { return request(compat ? callPath(id) : `${callPath(id)}/hangup`, compat ? {Status:'completed'} : {}); },
    holdCall(id, hold) { return compat ? request(callPath(id), {Twiml:hold?'<Response><Pause length="3600"/></Response>':'<Response/>'}) : request(`${callPath(id)}/${hold?'hold':'unhold'}`,{}); },
    answer(id) { if (compat) throw new Error('Compatibility calls are answered through the configured voice webhook.'); return request(`${callPath(id)}/answer`); },
    async conference(id, name) {
      if (compat) return request(callPath(id), {Twiml:`<Response><Dial><Conference endConferenceOnExit="false">${xml(name)}</Conference></Dial></Response>`});
      return request('/conferences', {call_control_id:id,name});
    },
    join(conferenceId, callId) { return compat ? request(callPath(callId), {Twiml:`<Response><Dial><Conference endConferenceOnExit="false">${xml(conferenceId)}</Conference></Dial></Response>`}) : request(`${conferencePath(conferenceId)}/join`, {call_control_id:callId}); },
    hold(conferenceId, callId, hold) { return compat ? request(`${conferencePath(conferenceId)}/Participants/${encodeURIComponent(callId)}.json`,{Hold:hold}) : request(`${conferencePath(conferenceId)}/${hold?'hold':'unhold'}`,{call_control_ids:[callId]}); },
    mute(conferenceId, callId, muted) { return compat ? request(`${conferencePath(conferenceId)}/Participants/${encodeURIComponent(callId)}.json`,{Muted:muted}) : request(`${conferencePath(conferenceId)}/${muted?'mute':'unmute'}`,{call_control_ids:[callId]}); },
    remove(conferenceId,callId) { return compat ? request(`${conferencePath(conferenceId)}/Participants/${encodeURIComponent(callId)}.json`,{},'DELETE') : request(`${conferencePath(conferenceId)}/leave`,{call_control_id:callId}); },
    record(callId,start) { return compat ? (start ? request(`/Calls/${encodeURIComponent(callId)}/Recordings.json`,{RecordingChannels:'dual'}) : Promise.reject(new Error('A recording identifier is required to stop compatibility recording.'))) : request(`${callPath(callId)}/${start?'record_start':'record_stop'}`,start?{format:'wav',channels:'dual'}:{}); },
    sendSms({to,from,text}) { return request(compat?'/Messages.json':'/messages',compat?{To:to,From:from,Body:text}:{to,from,text}); },
  };
}
function verifySignature(name,{url,body,rawBody,signature,timestamp},config,now=Date.now()) {
  try {
    if (name === 'telnyx') {
      if (!timestamp || Math.abs(now/1000-Number(timestamp))>300 || !config.publicKey) return false;
      const key = crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(config.publicKey,'base64')]),format:'der',type:'spki'});
      return crypto.verify(null,Buffer.concat([Buffer.from(`${timestamp}|`),Buffer.from(rawBody)]),key,Buffer.from(signature,'base64'));
    }
    if (!config.token || !signature || !url) return false;
    const data = url + Object.keys(body).sort().map(k=>`${k}${body[k]}`).join('');
    const expected = crypto.createHmac('sha1',config.token).update(data).digest('base64');
    return expected.length===signature.length && crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
  } catch { return false; }
}
module.exports = {PROVIDERS,selectedProvider,createProvider,verifySignature};
