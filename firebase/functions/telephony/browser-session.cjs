'use strict';
const crypto=require('node:crypto');
function twilioToken({accountId,keyId,keySecret,applicationId},identity,now=Math.floor(Date.now()/1000)) {
  if (![accountId,keyId,keySecret,applicationId,identity].every(Boolean)) throw new Error('Browser calling is not provisioned.');
  const header={typ:'JWT',alg:'HS256',cty:'twilio-fpa;v=1'};
  const payload={jti:`${keyId}-${crypto.randomUUID()}`,iss:keyId,sub:accountId,iat:now,exp:now+3600,grants:{identity,voice:{incoming:{allow:true},outgoing:{application_sid:applicationId}}}};
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const data=`${encode(header)}.${encode(payload)}`;
  return `${data}.${crypto.createHmac('sha256',keySecret).update(data).digest('base64url')}`;
}
async function browserSession(name,config,identity,provisioning,transport=fetch) {
  if(name==='twilio') return {provider:name,identity,token:twilioToken(config,identity),expiresIn:3600};
  let url,body,authorization;
  if(name==='telnyx') {
    if(!provisioning.telnyxCredentialId) throw new Error('Agent calling identity is not provisioned.');
    url=`https://api.telnyx.com/v2/telephony_credentials/${encodeURIComponent(provisioning.telnyxCredentialId)}/token`;
    authorization=`Bearer ${config.token}`;
  } else if(name==='signalwire') {
    if(!provisioning.signalwireSubscriberReference) throw new Error('Agent calling identity is not provisioned.');
    const space=new URL(config.spaceUrl);
    if(space.protocol!=='https:' || !space.hostname.endsWith('.signalwire.com')) throw new Error('Invalid phone-service host.');
    url=`${space.origin}/api/fabric/subscribers/tokens`;
    body=JSON.stringify({reference:provisioning.signalwireSubscriberReference});
    authorization=`Basic ${Buffer.from(`${config.accountId}:${config.token}`).toString('base64')}`;
  } else throw new Error('Unsupported phone service.');
  const result=await transport(url,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:authorization,'Content-Type':'application/json'},...(body?{body}:{})});
  if(!result.ok) throw new Error('Could not obtain an agent calling session.');
  if(name==='telnyx') return {provider:name,identity,token:await result.text()};
  const value=await result.json();
  if(!value.token) throw new Error('Phone service returned no session token.');
  return {provider:name,identity,token:value.token};
}
module.exports={twilioToken,browserSession};
