const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(user,assignment){
 const source=fs.readFileSync(require.resolve('../platform-core'),'utf8'),start=source.indexOf('function requireAuth('),end=source.indexOf('function scopedBrandIds(');
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const context={auth:{getUser:async()=>user},db:{doc:path=>({get:async()=>({exists:Boolean(path.includes('/assignments/') && assignment),data:()=>path.includes('/assignments/')?assignment:null})})},HttpsError,normalizeRole:r=>r,roleAllowed:(r,roles)=>!roles || roles.includes(r),TENANT_ADMIN_ROLES:['client_admin']};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';this.check=requireAgentAssignment;this.membership=requireMembership;',context);return context;
}
test('an archived user cannot use an already-issued super-admin token',async()=>{const f=fixture({disabled:true,customClaims:{gmsSuperAdmin:true}},{status:'active',role:'agent'});await assert.rejects(f.check({auth:{uid:'fixture',token:{gmsSuperAdmin:true}}},'client',['agent']),e=>e.code==='permission-denied');});
test('removed super-admin authority is not retained through stale token claims',async()=>{const f=fixture({disabled:false,customClaims:{gmsSuperAdmin:false}},{status:'active',role:'agent'});const result=await f.check({auth:{uid:'fixture',token:{gmsSuperAdmin:true}}},'client',['agent']);assert.equal(result.assignment.role,'agent');assert.equal(result.caller.token.gmsSuperAdmin,false);await assert.rejects(f.membership({auth:{uid:'fixture',token:{gmsSuperAdmin:true}}},'other'),e=>e.code==='permission-denied');});
