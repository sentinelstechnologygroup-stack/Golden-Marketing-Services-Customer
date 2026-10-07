const {getApp}=require('firebase-admin/app');
const PROJECT='gms-prod-1089114348316';
function secretId(locationId) {
  if(!/^[A-Za-z0-9_-]{1,60}$/.test(locationId || '')) throw new Error('Invalid location.');
  return `GMS_GHL_OAUTH_${locationId}`;
}
async function secretRequest(name,suffix,method='GET',body) {
  if(!/^[A-Za-z0-9_-]{1,255}$/.test(name)) throw new Error('Invalid secret identifier.');
  const credential=await getApp().options.credential.getAccessToken();
  const response=await fetch(`https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets/${name}${suffix}`,{
    method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${credential.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,
  });
  if(response.status===404 && method==='GET') return null;
  if(!response.ok) throw new Error(`Secure credential storage failed (${response.status}).`);
  return response.json();
}
async function readToken(locationId) {
  const result=await secretRequest(secretId(locationId),'/versions/latest:access');
  if(!result) return null;
  const value=JSON.parse(Buffer.from(result.payload.data,'base64').toString('utf8'));
  if(value.locationId!==locationId || !value.accessToken || !value.refreshToken) throw new Error('Stored authorization mismatch.');
  return value;
}
async function writeToken(locationId,value) {
  if(value.locationId!==locationId) throw new Error('Token ownership mismatch.');
  const result=await secretRequest(secretId(locationId),':addVersion','POST',{payload:{data:Buffer.from(JSON.stringify(value)).toString('base64')}});
  const saved=await readToken(locationId);
  if(saved.accessToken!==value.accessToken || saved.refreshToken!==value.refreshToken) throw new Error('Authorization storage readback failed.');
  return result.name;
}
async function locationToken(locationId,fallback) {
  const value=await readToken(locationId);
  if(!value) return fallback?.locationTokens?.[locationId] || null;
  if(value.expiresAtMs<Date.now()+60000) throw new Error('Location authorization requires refresh.');
  return value.accessToken;
}
module.exports={secretId,readToken,writeToken,locationToken};
