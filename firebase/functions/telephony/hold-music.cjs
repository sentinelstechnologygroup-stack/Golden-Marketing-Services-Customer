// Original upbeat instrumental: piano melody, chords, bass and brushed percussion.
// Inline mono WAV remains under Telnyx's playback-content size limit; no external media.
let cached;
function holdMusic(){
 if(cached)return cached;
 const rate=8000,seconds=32,frames=rate*seconds,wav=Buffer.alloc(44+frames*2);
 wav.write('RIFF');wav.writeUInt32LE(36+frames*2,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
 const chords=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65]];
 const melodies=[[76,79,81,79,76,74,72,74],[76,72,69,72,76,79,76,74],[77,76,72,69,72,74,76,77],[74,71,67,71,74,76,74,71]];
 const hz=m=>440*Math.pow(2,(m-69)/12);
 const piano=(m,t,decay=5)=>Math.min(1,t/0.008)*Math.exp(-t*decay)*(Math.sin(2*Math.PI*hz(m)*t)+0.28*Math.sin(4*Math.PI*hz(m)*t)+0.08*Math.sin(6*Math.PI*hz(m)*t));
 let seed=123456789;
 for(let i=0;i<frames;i++){
  const t=i/rate,bar=Math.floor(t/2),chord=chords[bar%4],eighth=Math.floor(t/0.25),local=t%0.25,beat=t%0.5;
  // Alternating melody phrases keep the 16-bar loop musical rather than a repeated tone.
  const melody=melodies[bar%4][eighth%8]-(bar>=8 && bar<12?12:0);
  let value=0.17*piano(melody,local,7);
  for(const m of chord)value+=0.025*piano(m,(t+0.08)%0.5,5);
  value+=0.13*piano(chord[Math.floor(t/0.5)%2===0?0:2]-24,beat,4);
  value+=0.10*Math.sin(2*Math.PI*(65*beat+18*(1-Math.exp(-beat*18))))*Math.exp(-beat*22);
  seed=(1664525*seed+1013904223)>>>0;const noise=(seed/4294967296)*2-1;
  value+=noise*(0.025*Math.exp(-local*75)+(Math.floor(t/0.5)%2===1?0.055*Math.exp(-beat*35):0));
  const edge=Math.min(1,t/0.02,(seconds-t)/0.04);
  wav.writeInt16LE(Math.round(Math.max(-0.85,Math.min(0.85,value))*edge*26000),44+i*2);
 }
 cached=wav.toString('base64');return cached;
}
module.exports={holdMusic};
