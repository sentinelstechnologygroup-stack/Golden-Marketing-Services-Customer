'use strict';
const crypto = require('node:crypto');
const { recordingAllowed } = require('./readiness.cjs');

function recordingIdentity(value) {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/i.test(value)) throw new Error('Invalid recording identity.');
  return value;
}

// Fetch media only from an explicitly configured provider host. No redirects,
// credentials or arbitrary webhook URLs may turn this worker into an HTTP proxy.
function mediaUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) {
    throw new Error('Unapproved recording media host.');
  }
  return url.href;
}

async function archiveRecording({call, recordingId, token, hosts, primary, backup, transport = fetch}) {
  recordingIdentity(recordingId);
  if (!recordingAllowed(call) || call.provider !== 'telnyx' || !call.providerCallId) throw new Error('Recording is not authorized.');
  const response = await transport(`https://api.telnyx.com/v2/recordings/${recordingId}`, {
    headers: {Authorization: `Bearer ${token}`}, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Recording lookup failed.');
  const {data} = await response.json();
  if (data?.id !== recordingId || data.call_control_id !== call.providerCallId) throw new Error('Recording belongs to another call.');
  const download = await transport(mediaUrl(data.download_urls?.wav, hosts), {
    redirect: 'error', signal: AbortSignal.timeout(120000),
  });
  if (!download.ok || !download.body) throw new Error('Recording download failed.');
  const parts = []; let length = 0;
  for await (const part of download.body) {
    length += part.length;
    if (length > 100 * 1024 * 1024) throw new Error('Recording exceeds archive limit.');
    parts.push(Buffer.from(part));
  }
  const audio = Buffer.concat(parts);
  if (audio.length < 44 || audio.subarray(0,4).toString() !== 'RIFF' || audio.subarray(8,12).toString() !== 'WAVE') throw new Error('Invalid WAV recording.');
  const sha256 = crypto.createHash('sha256').update(audio).digest('hex');
  for (const file of [primary, backup]) {
    // Deterministic object names make retries safe. Readback verifies actual bytes,
    // rather than assuming a successful upload is sufficient to delete evidence.
    await file.save(audio, {resumable:false, validation:'crc32c', metadata:{contentType:'audio/wav', metadata:{sha256}}});
    const [saved] = await file.download();
    if (crypto.createHash('sha256').update(saved).digest('hex') !== sha256) throw new Error('Archive verification failed.');
  }
  return {sha256, bytes:audio.length, recordingId, providerCallId:data.call_control_id, archiveVerified:true, backupVerified:true};
}

module.exports = {recordingIdentity, mediaUrl, archiveRecording};
