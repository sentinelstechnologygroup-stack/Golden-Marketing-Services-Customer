const crypto = require('node:crypto');
const SCOPES = Object.freeze(['locations.readonly','contacts.readonly','contacts.write','opportunities.readonly','opportunities.write','calendars.readonly','calendars/events.readonly','calendars/events.write','conversations.readonly','conversations.write','conversations/message.readonly','conversations/message.write','workflows.readonly']);
// GHL adds these protocol permissions to a converted Location token. They do
// not add CRM workflows; accept only the documented pair, never arbitrary extras.
const OAUTH_PROTOCOL_SCOPES=Object.freeze(['oauth.readonly','oauth.write']);
function stateHash(state) {
  if(typeof state!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new Error('Invalid authorization state.');
  return crypto.createHash('sha256').update(state).digest('hex');
}
function verifiedToken(value,expected,now=Date.now()) {
  if(!value || value.userType!=='Location' || value.locationId!==expected.locationId || value.companyId!==expected.companyId || value.token_type!=='Bearer') throw new Error('Authorization ownership mismatch.');
  const scopeValues=Array.isArray(value.scope)?value.scope:typeof value.scope==='string'?value.scope.split(/\s+/).filter(Boolean):[];
  const scopes=new Set(scopeValues);
  const missingScopes=SCOPES.filter(scope=>!scopes.has(scope));
  const unexpectedScopes=[...scopes].filter(scope=>typeof scope!=='string' || !(SCOPES.includes(scope) || OAUTH_PROTOCOL_SCOPES.includes(scope)));
  const partialProtocolScopes=OAUTH_PROTOCOL_SCOPES.some(scope=>scopes.has(scope)) && !OAUTH_PROTOCOL_SCOPES.every(scope=>scopes.has(scope));
  if(missingScopes.length || unexpectedScopes.length || partialProtocolScopes) {
    const error=new Error('Authorization scope mismatch.');
    error.scopeDiagnostic={missingScopes,unexpectedScopes:unexpectedScopes.filter(scope=>typeof scope==='string' && /^[a-zA-Z0-9_/.:-]{1,100}$/.test(scope)),format:Array.isArray(value.scope)?'array':typeof value.scope};
    throw error;
  }
  if(typeof value.access_token!=='string' || value.access_token.length<20 || typeof value.refresh_token!=='string' || value.refresh_token.length<20 || !Number.isFinite(value.expires_in) || value.expires_in<300 || value.expires_in>172800) throw new Error('Invalid authorization response.');
  return {accessToken:value.access_token,refreshToken:value.refresh_token,locationId:value.locationId,companyId:value.companyId,scopes:[...scopes].sort(),expiresAtMs:now+value.expires_in*1000,rotatedAtMs:now};
}
function verifiedAgencyToken(value,expected,now=Date.now()) {
  if(value?.userType!=='Company' || value.companyId!==expected.companyId || value.installToFutureLocations===true) throw new Error('Authorization agency mismatch.');
  // Validate the same credentials, lifetime and exact scopes without treating
  // this transient agency token as a usable customer credential.
  verifiedToken({...value,userType:'Location',locationId:expected.locationId},expected,now);
  return value.access_token;
}
async function resolveAuthorization(value,expected,{deriveLocation,readProfile},now=Date.now()) {
  if(value?.userType==='Location') return verifiedToken(value,expected,now);
  const agencyAccessToken=verifiedAgencyToken(value,expected,now);
  const location=await deriveLocation(agencyAccessToken,expected);
  if(location?.locationId!==expected.locationId || (location.companyId && location.companyId!==expected.companyId) || (location.userType && location.userType!=='Location')) throw new Error('Authorization ownership mismatch.');
  // v3 location-token responses may omit companyId and userType. Resolve the
  // company through an authenticated location profile before normalization.
  const profile=await readProfile(location.access_token,expected.locationId);
  if(profile?.id!==expected.locationId || profile.companyId!==expected.companyId) throw new Error('Authorization profile mismatch.');
  return verifiedToken({...location,userType:'Location',companyId:profile.companyId},expected,now);
}
function installUrl(base,client,state) {
  stateHash(state);
  const url=new URL(base);
  if(url.protocol!=='https:' || !['marketplace.gohighlevel.com','marketplace.leadconnectorhq.com'].includes(url.hostname) || url.username || url.password || url.port || !['/oauth/chooselocation','/v2/oauth/chooselocation'].includes(url.pathname)) throw new Error('Invalid installation destination.');
  url.searchParams.set('client_id',client.clientId);
  url.searchParams.set('redirect_uri',client.redirectUri);
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope',SCOPES.join(' '));
  url.searchParams.set('state',state);
  return url.toString();
}
module.exports={SCOPES,stateHash,verifiedToken,verifiedAgencyToken,resolveAuthorization,installUrl};
