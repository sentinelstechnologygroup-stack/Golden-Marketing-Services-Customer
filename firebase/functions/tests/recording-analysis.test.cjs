const test=require('node:test'),assert=require('node:assert/strict');
const {waveConfiguration,startTranscription,pollTranscription,scoreTranscript}=require('../telephony/recording-analysis.cjs');
function wave(channels=2) {
 const value=Buffer.alloc(48);value.write('RIFF');value.writeUInt32LE(40,4);value.write('WAVEfmt ',8);value.writeUInt32LE(16,16);value.writeUInt16LE(1,20);value.writeUInt16LE(channels,22);value.writeUInt32LE(8000,24);value.writeUInt16LE(16,34);value.write('data',36);value.writeUInt32LE(4,40);return value;
}
test('transcription respects actual stereo PCM headers and rejects unsupported audio',()=>{
 assert.equal(waveConfiguration(wave()).enableSeparateRecognitionPerChannel,true);
 assert.equal(waveConfiguration(wave(1)).enableSeparateRecognitionPerChannel,false);
 assert.throws(()=>waveConfiguration(wave(3)));
 const invalid=wave();invalid.writeUInt16LE(7,20);assert.throws(()=>waveConfiguration(invalid));
});
test('transcription uses only the verified private GMS path and safe operation polling',async()=>{
 const operation=await startTranscription({audio:wave(),bucket:'gms-private.example',path:'private-call-evidence/tenant/call/recording.wav',token:'mock-google-token',transport:async(url,options)=>{
  assert.equal(url,'https://speech.googleapis.com/v1/speech:longrunningrecognize');assert.equal(options.redirect,'error');
  const body=JSON.parse(options.body);assert.equal(body.audio.uri,'gs://gms-private.example/private-call-evidence/tenant/call/recording.wav');assert.equal(body.config.audioChannelCount,2);
  return {ok:true,json:async()=>({name:'123456'})};
 }});
 assert.equal(operation,'123456');
 await assert.rejects(()=>pollTranscription({operation:'../../foreign',token:'mock'}));
 assert.equal(await pollTranscription({operation,token:'mock',transport:async()=>({ok:true,json:async()=>({done:false})})}),null);
});
test('AI scoring retains model and rubric provenance and rejects fabricated transcript evidence',async()=>{
 const criteria=[{id:'need',label:'Need confirmed',weight:30,required:true}];
 const result=await scoreTranscript({criteria,transcript:{text:'I need an appointment'},model:'gemini-3.5-flash',token:'mock-google-token',transport:async(url,options)=>{
  assert.match(url,/projects\/gms-prod-1089114348316\/locations\/global\/publishers\/google\/models\/gemini-3.5-flash:generateContent$/);
  assert.equal(JSON.parse(options.body).generationConfig.responseMimeType,'application/json');
  return {ok:true,json:async()=>({modelVersion:'mock-version',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({items:[{id:'need',outcome:'met',quote:'invented statement',explanation:'not supported'}]})}]}}]})};
 }});
 assert.equal(result.score,null);assert.equal(result.status,'needs_human_review');assert.equal(result.modelVersion,'mock-version');assert.match(result.rubricSha256,/^[a-f0-9]{64}$/);
});
