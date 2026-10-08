'use strict';
const crypto=require('node:crypto');
const PROVIDERS=['telnyx'];
function selectedProvider(value){if(!PROVIDERS.includes(value))throw new Error('Only Telnyx is supported.');return value;}
function required(config,keys){for(const key of keys)if(!String(config[key]||'').trim()||String(config[key]).trim()==='not-configured')throw new Error('Missing telephony configuration: '+key);}
function createProvider(name,config,transport=fetch){
 selectedProvider(name);required(config,['token','connectionId']);
 async function request(path,values={},method='POST'){
  const response=await transport('https://api.telnyx.com/v2'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(values)})});
  const body=await response.json();if(!response.ok){const error=new Error('Phone service rejected the request.');error.providerStatus=response.status;throw error;}return body.data;
 }
 const callPath=id=>'/calls/'+encodeURIComponent(id)+'/actions';
 const conferencePath=id=>'/conferences/'+encodeURIComponent(id)+'/actions';
 return {name,
  async credential(id){const data=await request('/telephony_credentials/'+encodeURIComponent(id),{},'GET');return {...data,connection_id:require('./credential-identity.cjs').connectionId(data)};},
  async start({to,from,callbackUrl,commandId,clientState,linkTo}){required({from,callbackUrl},['from','callbackUrl']);const result=await request('/calls',{to,from,connection_id:config.connectionId,webhook_url:callbackUrl,command_id:commandId,...(clientState?{client_state:clientState}:{}),...(linkTo?{link_to:linkTo,bridge_intent:true,bridge_on_answer:true,prevent_double_bridge:true}:{})});return {id:result.call_control_id,status:result.status||'queued'};},
  async end(id) {
    try { return await request(callPath(id)+'/hangup'); }
    catch (error) {
      if (error.providerStatus !== 422) throw error;
      const state = await request('/calls/'+encodeURIComponent(id),{},'GET');
      if (state?.is_alive === false) return {status:'completed'};
      throw error;
    }
  },
  holdCall:(id,hold)=>request(callPath(id)+(hold?'/hold':'/unhold')),
  answer:id=>request(callPath(id)+'/answer'),
  conference:(id,name)=>request('/conferences',{call_control_id:id,name}),
  join:(conferenceId,callId)=>request(conferencePath(conferenceId)+'/join',{call_control_id:callId}),
  hold:(conferenceId,callId,hold)=>request(conferencePath(conferenceId)+(hold?'/hold':'/unhold'),{call_control_ids:[callId]}),
  mute:(conferenceId,callId,muted)=>request(conferencePath(conferenceId)+(muted?'/mute':'/unmute'),{call_control_ids:[callId]}),
  remove:(conferenceId,callId)=>request(conferencePath(conferenceId)+'/leave',{call_control_id:callId}),
  record:(callId,start)=>request(callPath(callId)+(start?'/record_start':'/record_stop'),start?{format:'wav',channels:'dual'}:{}),
  sendSms:({to,from,text})=>request('/messages',{to,from,text}),
 };
}
function verifySignature(name,{rawBody,signature,timestamp},config,now=Date.now()){
 try {
  if(name!=='telnyx'||!timestamp||!Number.isFinite(Number(timestamp))||Math.abs(now/1000-Number(timestamp))>300||!config.publicKey)return false;
  const key=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(config.publicKey,'base64')]),format:'der',type:'spki'});
  return crypto.verify(null,Buffer.concat([Buffer.from(timestamp+'|'),Buffer.from(rawBody)]),key,Buffer.from(signature,'base64'));
 }catch{return false;}
}
module.exports={PROVIDERS,selectedProvider,createProvider,verifySignature};
