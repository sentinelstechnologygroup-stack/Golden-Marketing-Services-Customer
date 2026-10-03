'use strict';
async function browserSession(name,config,identity,provisioning,transport=fetch) {
  if(name!=='telnyx') throw new Error('Unsupported phone service.');
  if(!provisioning.telnyxCredentialId) throw new Error('Agent calling identity is not provisioned.');
  const url='https://api.telnyx.com/v2/telephony_credentials/'+encodeURIComponent(provisioning.telnyxCredentialId)+'/token';
  const result=await transport(url,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'}});
  if(!result.ok) throw new Error('Could not obtain an agent calling session.');
  const token=await result.text();
  if(!token.trim()) throw new Error('Phone service returned no session token.');
  return {provider:name,identity,token};
}
module.exports={browserSession};
