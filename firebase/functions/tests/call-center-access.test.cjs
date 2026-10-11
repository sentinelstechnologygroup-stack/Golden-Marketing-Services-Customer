const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({global=false,role='agent'}={}){
 const auth={getUser:async()=>({uid:'fixture',customClaims:{gmsSuperAdmin:global}})};
 const assignment={id:'client',data:()=>({role,status:'active',brandIds:['brand'],tenantName:'Client'})};
 const query=path=>({get:async()=>({docs:path.includes('/assignments')?[assignment]:[],size:0}),where:()=>query(path),orderBy:()=>query(path),limit:()=>query(path)});
 const db={collection:query};class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const deps={'firebase-functions/v2/https':{onCall:(_,handler)=>handler,HttpsError},'firebase-admin/auth':{getAuth:()=>auth},'firebase-admin/firestore':{getFirestore:()=>db,Timestamp:{fromMillis:v=>v}},'./call-center-policy.cjs':require('../call-center-policy.cjs')};
 const exports={};vm.runInNewContext(fs.readFileSync(require.resolve('../call-center'),'utf8'),{exports,require:n=>deps[n] || require(n),Date});return exports.getGmsCallCenterReport;
}
const input=()=>({from:new Date(Date.now()-86400000).toISOString(),to:new Date(Date.now()).toISOString()});
test('phone agents and unauthenticated callers cannot access call-center reports',async()=>{await assert.rejects(fixture()({data:input()}),e=>e.code==='unauthenticated');await assert.rejects(fixture()({auth:{uid:'fixture'},data:input()}),e=>e.code==='permission-denied');});
test('supervisors cannot request a client outside their assignments',async()=>{await assert.rejects(fixture({role:'supervisor'})({auth:{uid:'fixture'},data:{...input(),clientId:'other-client'}}),e=>e.code==='permission-denied');});
test('report bounds reject invalid or oversized periods',async()=>{await assert.rejects(fixture({global:true})({auth:{uid:'fixture'},data:{from:'invalid',to:'invalid'}}),e=>e.code==='invalid-argument');await assert.rejects(fixture({global:true})({auth:{uid:'fixture'},data:{from:'2020-01-01',to:'2026-01-01'}}),e=>e.code==='invalid-argument');});
