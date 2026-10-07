const assert=require('node:assert/strict'),test=require('node:test');
const {SCOPES,stateHash,verifiedToken,verifiedAgencyToken,resolveAuthorization,installUrl}=require('../gohighlevel-oauth-policy.cjs');
const expected={locationId:'gcr-location',companyId:'gms-agency'};
const response={locationId:expected.locationId,companyId:expected.companyId,userType:'Location',token_type:'Bearer',access_token:'a'.repeat(40),refresh_token:'r'.repeat(40),scope:SCOPES.join(' '),expires_in:86399};
test('OAuth accepts only the approved location, agency and exact approved scope set',()=>{
  assert.equal(verifiedToken(response,expected,1000).expiresAtMs,86400000);
  for(const patch of [{locationId:'foreign'},{companyId:'foreign'},{userType:'Company'},{scope:response.scope+' users.write'},{scope:'contacts.readonly'},{expires_in:1},{refresh_token:''}]) assert.throws(()=>verifiedToken({...response,...patch},expected));
});

test('agency installation derives only the expected location and saves no agency credential',async()=>{
  const agency={...response,userType:'Company',locationId:undefined,access_token:'c'.repeat(40)};
  const derived={...response}; delete derived.userType; delete derived.companyId;
  const calls=[];
  const result=await resolveAuthorization(agency,expected,{
    deriveLocation:async(token,target)=>{calls.push([token,target.locationId,target.companyId]);return derived;},
    readProfile:async(token,id)=>{assert.equal(token,response.access_token);assert.equal(id,expected.locationId);return {id,companyId:expected.companyId};},
  },1000);
  assert.deepEqual(calls,[[agency.access_token,expected.locationId,expected.companyId]]);
  assert.equal(result.accessToken,response.access_token); assert.equal(result.refreshToken,response.refresh_token);
  assert.equal(result.companyId,expected.companyId); assert.equal(result.locationId,expected.locationId);
  assert.ok(!JSON.stringify(result).includes(agency.access_token));
});

test('agency grants and converted profiles cannot broaden customer ownership or scopes',async()=>{
  const agency={...response,userType:'Company',locationId:undefined};
  for(const patch of [{companyId:'foreign'},{userType:'Location'},{installToFutureLocations:true},{scope:response.scope+' users.write'},{refresh_token:''}]) assert.throws(()=>verifiedAgencyToken({...agency,...patch},expected));
  for(const patch of [{locationId:'foreign'},{companyId:'foreign'},{userType:'Company'},{scope:'contacts.readonly'},{refresh_token:''}]) {
    await assert.rejects(resolveAuthorization(agency,expected,{deriveLocation:async()=>({...response,...patch}),readProfile:async()=>({id:expected.locationId,companyId:expected.companyId})}));
  }
  for(const profile of [{id:'foreign',companyId:expected.companyId},{id:expected.locationId,companyId:'foreign'},{id:expected.locationId}]) await assert.rejects(resolveAuthorization(agency,expected,{deriveLocation:async()=>response,readProfile:async()=>profile}));
});

test('conversion and profile failures never yield a credential or retry a grant',async()=>{
  const agency={...response,userType:'Company',locationId:undefined}; let conversions=0;
  await assert.rejects(resolveAuthorization(agency,expected,{deriveLocation:async()=>{conversions++;throw Error('conversion failed');},readProfile:async()=>{throw Error('must not run');}}));
  assert.equal(conversions,1);
  await assert.rejects(resolveAuthorization(agency,expected,{deriveLocation:async()=>response,readProfile:async()=>{throw Error('profile unavailable');}}));
});
test('OAuth state is unpredictable, bounded and hashed before persistence',()=>{
  const state=require('node:crypto').randomBytes(32).toString('base64url');
  assert.equal(stateHash(state).length,64); assert.notEqual(stateHash(state),state);
  for(const value of ['', 'x'.repeat(42), '../'+'x'.repeat(40)]) assert.throws(()=>stateHash(value));
});
test('installation destinations cannot disclose state or client metadata to another host',()=>{
  const state=require('node:crypto').randomBytes(32).toString('base64url'),client={clientId:'public-client',redirectUri:'https://gms.example/callback'};
  const url=new URL(installUrl('https://marketplace.gohighlevel.com/oauth/chooselocation',client,state));
  assert.equal(url.searchParams.get('state'),state); assert.equal(url.searchParams.get('scope'),SCOPES.join(' '));
  for(const base of ['https://evil.example/oauth/chooselocation','http://marketplace.gohighlevel.com/oauth/chooselocation','https://marketplace.gohighlevel.com:444/oauth/chooselocation']) assert.throws(()=>installUrl(base,client,state));
});
