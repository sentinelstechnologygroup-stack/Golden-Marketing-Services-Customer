'use strict';
async function browserSession(name,config,identity,provisioning,transport=fetch) {
  if(name!=='telnyx') throw new Error('Unsupported phone service.');
  if(!provisioning.telnyxCredentialId) throw new Error('Agent calling identity is not provisioned.');
  if(!config.browserConnectionId) throw new Error('Receive-only calling connection is not configured.');
  const headers={Authorization:'Bearer '+config.token,'Content-Type':'application/json'};
  const credentialResponse=await transport('https://api.telnyx.com/v2/telephony_credentials/'+encodeURIComponent(provisioning.telnyxCredentialId),{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!credentialResponse.ok || require('./credential-identity.cjs').connectionId((await credentialResponse.json()).data)!==config.browserConnectionId) throw new Error('Agent calling connection mismatch.');
  const connectionResponse=await transport('https://api.telnyx.com/v2/credential_connections/'+encodeURIComponent(config.browserConnectionId),{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  const connection=connectionResponse.ok?(await connectionResponse.json()).data:null;
  if(!connection?.active || connection.outbound?.outbound_voice_profile_id) throw new Error('Browser connection must have outbound calling disabled.');
  const url='https://api.telnyx.com/v2/telephony_credentials/'+encodeURIComponent(provisioning.telnyxCredentialId)+'/token';
  const result=await transport(url,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'}});
  if(!result.ok) throw new Error('Could not obtain an agent calling session.');
  const token=await result.text();
  if(!token.trim()) throw new Error('Phone service returned no session token.');
  return {provider:name,identity,token,receiveOnly:true};
}
module.exports={browserSession};
