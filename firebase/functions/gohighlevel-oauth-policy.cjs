const crypto = require('node:crypto');
const SCOPES = Object.freeze(['locations.readonly','contacts.readonly','contacts.write','opportunities.readonly','opportunities.write','calendars.readonly','calendars/events.readonly','calendars/events.write','conversations.readonly','conversations.write','conversations/message.readonly','conversations/message.write','workflows.readonly']);
function stateHash(state) {
  if(typeof state!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new Error('Invalid authorization state.');
  return crypto.createHash('sha256').update(state).digest('hex');
}
function verifiedToken(value,expected,now=Date.now()) {
  if(!value || value.userType!=='Location' || value.locationId!==expected.locationId || value.companyId!==expected.companyId || value.token_type!=='Bearer') throw new Error('Authorization ownership mismatch.');
  const scopes=new Set(String(value.scope || '').split(/\s+/).filter(Boolean));
  if(SCOPES.some(scope=>!scopes.has(scope)) || [...scopes].some(scope=>!SCOPES.includes(scope))) throw new Error('Authorization scope mismatch.');
  if(typeof value.access_token!=='string' || value.access_token.length<20 || typeof value.refresh_token!=='string' || value.refresh_token.length<20 || !Number.isFinite(value.expires_in) || value.expires_in<300 || value.expires_in>172800) throw new Error('Invalid authorization response.');
  return {accessToken:value.access_token,refreshToken:value.refresh_token,locationId:value.locationId,companyId:value.companyId,scopes:[...scopes].sort(),expiresAtMs:now+value.expires_in*1000,rotatedAtMs:now};
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
module.exports={SCOPES,stateHash,verifiedToken,installUrl};
