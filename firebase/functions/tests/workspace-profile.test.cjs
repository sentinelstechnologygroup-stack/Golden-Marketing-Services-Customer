const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(isAdmin,tokenAdmin){
 const src=fs.readFileSync(require.resolve('../platform-core.js'),'utf8'),start=src.indexOf('exports.getMyProfile ='),end=src.indexOf('exports.getAccountWorkspace',start);
 const row=(id,data)=>({id,data:()=>data});
 const assigned=row('assigned',{tenantId:'assigned',status:'active',role:'agent',brandId:'brand',telnyxCredentialId:'credential'});
 const tenants=[row('assigned',{name:'Assigned'}),row('unassigned',{name:'Unassigned'}),row('archived',{status:'archived'})];
 const query=(docs)=>({where(){return this;},limit(){return this;},get:async()=>({docs,size:docs.length})});
 const db={collectionGroup:()=>query([]),collection:path=>query(path==='tenants'?tenants:[assigned]),doc:path=>({get:async()=>path.endsWith('inboundCalling')?row('',{enabled:true,brandId:'brand'}):path.startsWith('gmsTestingApprovals')?row('',{}):path.startsWith('users/')?row('',{}):tenants.find(t=>path===`tenants/${t.id}`)})};
 const ctx={exports:{},onCall:(_,fn)=>fn,requireAuth:r=>r.auth,auth:{getUser:async()=>({uid:'user',customClaims:{gmsSuperAdmin:isAdmin}})},db,normalizeRole:r=>r,HttpsError:Error};vm.runInNewContext(src.slice(start,end),ctx);
 return ctx.exports.getMyProfile({auth:{uid:'user',token:{gmsSuperAdmin:tokenAdmin}}});
}
test('fresh super-admin authority covers all active clients including those without assignments',async()=>{const p=await fixture(true,false);assert.equal(p.gmsSuperAdmin,true);assert.deepEqual(Array.from(p.agentAssignments,a=>a.tenantId),['assigned','unassigned']);assert.equal(p.agentAssignments[0].phoneEnabled,true);assert.equal(p.agentAssignments[1].phoneEnabled,false);});
test('old elevated token does not expand a normal agent beyond active assignments',async()=>{const p=await fixture(false,true);assert.equal(p.gmsSuperAdmin,false);assert.deepEqual(Array.from(p.agentAssignments,a=>a.tenantId),['assigned']);});
