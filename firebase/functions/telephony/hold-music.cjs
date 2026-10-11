// Original synthesized hold music; no external media or licensing dependency.
let cached;
function holdMusic(){
 if(cached)return cached;
 const rate=8000,seconds=12,frames=rate*seconds,wav=Buffer.alloc(44+frames*2);
 wav.write('RIFF');wav.writeUInt32LE(36+frames*2,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
 const chords=[[261.63,329.63,392],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66]];
 for(let i=0;i<frames;i++){const t=i/rate,local=t%3,chord=chords[Math.floor(t/3)],envelope=Math.sin(Math.PI*local/3)**2;let v=0;for(const f of chord)v+=Math.sin(2*Math.PI*f*t)/chord.length;wav.writeInt16LE(Math.round(v*envelope*2600),44+i*2);}
 cached=wav.toString('base64');return cached;
}
module.exports={holdMusic};
