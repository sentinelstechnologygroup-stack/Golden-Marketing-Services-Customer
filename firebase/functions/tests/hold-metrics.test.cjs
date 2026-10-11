const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('repeated hold/unhold commands do not reset or duplicate accumulated hold time',async()=>{
 let now=1000,call={holdSeconds:0};const tx={get:async()=>({data:()=>call}),update:(_,patch)=>{call={...call,...patch};}},db={runTransaction:f=>f(tx)};
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../telephony/hold-metrics.cjs'),'utf8'),{module,require:()=>({Timestamp:{fromMillis:v=>({toMillis:()=>v})}}),Date:{now:()=>now},console});
 const hold=module.exports.holdMetric;await hold(db,{},true);now=2000;await hold(db,{},true);now=6000;await hold(db,{},false);assert.equal(call.holdSeconds,5);await hold(db,{},false);assert.equal(call.holdSeconds,5);
});
