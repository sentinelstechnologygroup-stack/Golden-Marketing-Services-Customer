const assert=require('node:assert/strict'),test=require('node:test');
const {SCOPES,stateHash,verifiedToken,installUrl}=require('../gohighlevel-oauth-policy.cjs');
const expected={locationId:'gcr-location',companyId:'gms-agency'};
const response={locationId:expected.locationId,companyId:expected.companyId,userType:'Location',token_type:'Bearer',access_token:'a'.repeat(40),refresh_token:'r'.repeat(40),scope:SCOPES.join(' '),expires_in:86399};
test('OAuth accepts only the approved location, agency and exact approved scope set',()=>{
  assert.equal(verifiedToken(response,expected,1000).expiresAtMs,86400000);
  for(const patch of [{locationId:'foreign'},{companyId:'foreign'},{userType:'Company'},{scope:response.scope+' users.write'},{scope:'contacts.readonly'},{expires_in:1},{refresh_token:''}]) assert.throws(()=>verifiedToken({...response,...patch},expected));
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
