const test = require('node:test');
const assert = require('node:assert/strict');
const {archiveRecording, mediaUrl} = require('../telephony/recording-archive.cjs');
const id = '428c31b6-7af4-4bcb-b7f5-5013ef9657c1';
const audio = Buffer.alloc(48); audio.write('RIFF'); audio.write('WAVE',8);
const call = {provider:'telnyx', providerCallId:'leg', recordingRequested:true, recordingPolicy:'record_on_consent', recordingConsent:true};
function file(corrupt=false) { let saved; return {save:async value=>{saved=value;}, download:async()=>[corrupt?Buffer.from('corrupt'):saved]}; }
function transport(other=false) { return async url => url.includes('api.telnyx.com') ? {ok:true,json:async()=>({data:{id,call_control_id:other?'other':'leg',download_urls:{wav:'https://media.example/recording.wav'}}})} : {ok:true,body:(async function*(){yield audio;})()}; }
test('recording archive verifies primary and backup bytes',async()=>{
  const result=await archiveRecording({call,recordingId:id,token:'test-only',hosts:['media.example'],primary:file(),backup:file(),transport:transport()});
  assert.equal(result.archiveVerified,true); assert.equal(result.backupVerified,true); assert.equal(result.bytes,48);
});
test('archive rejects recordings belonging to another call and missing consent',async()=>{
  await assert.rejects(archiveRecording({call,recordingId:id,token:'test-only',hosts:['media.example'],primary:file(),backup:file(),transport:transport(true)}),/another call/);
  await assert.rejects(archiveRecording({call:{...call,recordingConsent:false},recordingId:id}),/not authorized/);
});
test('corrupt backup cannot produce verified evidence',async()=>{
  await assert.rejects(archiveRecording({call,recordingId:id,token:'test-only',hosts:['media.example'],primary:file(),backup:file(true),transport:transport()}),/verification failed/);
});
test('media URL rejects private destinations, redirects and credential-bearing URLs',()=>{
  for(const url of ['http://media.example/a','https://127.0.0.1/a','https://media.example.evil/a','https://user:pass@media.example/a','https://media.example:8443/a']) assert.throws(()=>mediaUrl(url,['media.example']));
});
