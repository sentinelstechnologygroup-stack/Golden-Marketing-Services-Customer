const crypto=require('node:crypto');
// Public verification key published in the GHL provider-delivery documentation.
const GHL_PUBLIC_KEY='-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=\n-----END PUBLIC KEY-----';
function signedDelivery(raw,signature,key=GHL_PUBLIC_KEY) {
  try {
    if(!Buffer.isBuffer(raw) || raw.length>32768 || typeof signature!=='string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
    return crypto.verify(null,raw,key,Buffer.from(signature,'base64'));
  } catch {return false;}
}
function id(value) {if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('Invalid message identifier.');return value;}
function phone(value) {if(typeof value!=='string'||!/^\+1[2-9]\d{9}$/.test(value)) throw new Error('US messaging number is required.');return value;}
function delivery(body) {
  if(!body || body.type!=='SMS' || (body.attachments && (!Array.isArray(body.attachments)||body.attachments.length))) throw new Error('Only text SMS is configured.');
  if(typeof body.message!=='string'||!body.message.trim()||body.message.length>1600) throw new Error('SMS body is unavailable or too long.');
  return {locationId:id(body.locationId),contactId:id(body.contactId),messageId:id(body.messageId),to:phone(body.phone),text:body.message};
}
function recipientId(number) {return crypto.createHash('sha256').update(phone(number)).digest('hex');}
function messageFingerprint({from,to,text}) {return crypto.createHash('sha256').update(JSON.stringify({from:phone(from),to:phone(to),text})).digest('hex');}
function segments(text) {
  const basic='@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  const extended='\f^{}\\[~]|€';
  let units=0,unicode=false;
  for(const c of text) {if(basic.includes(c)) units++;else if(extended.includes(c)) units+=2;else {unicode=true;break;}}
  if(unicode) return text.length<=70?1:Math.ceil(text.length/67);
  return units<=160?1:Math.ceil(units/153);
}
function maySend(consent,lead,number,config,to) {
  if(config?.enabled!==true || config?.registrationStatus!=='approved' || !config?.providerId || !config?.messagingProfileId || !Number.isInteger(config?.dailySegmentLimit) || config.dailySegmentLimit<=0) throw new Error('Messaging configuration is incomplete.');
  if(consent?.status!=='opted_in'||consent.phone!==to||!consent.evidenceReference||!consent.consentedAtMs||consent.consentedAtMs>Date.now()) throw new Error('Recipient messaging consent is unavailable.');
  if(lead.doNotCall||lead.doNotContact||lead.dnc||lead.smsOptOut||phone(lead.phone)!==to) throw new Error('Recipient identity or contact policy did not match.');
  if(number.provider!=='telnyx'||number.status!=='active'||number.brandId!==lead.brandId||number.messagingProfileId!==config.messagingProfileId) throw new Error('Sender ownership is unavailable.');
  return phone(number.phoneNumber);
}
function isOptOut(text) {return /^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(String(text).trim());}
function reserveBudget(config,budget,count) {
  const limit=config?.dailyBudgetMicrosUsd,rate=config?.costCeilingMicrosUsdPerSegment;
  if(!Number.isSafeInteger(limit)||limit<=0 || !Number.isSafeInteger(rate)||rate<=0 || !Number.isSafeInteger(count)||count<=0) throw new Error('Approved monetary limit and verified cost ceiling are required.');
  const verified=config?.rateVerifiedAtMs;
  if(!Number.isSafeInteger(verified)||verified>Date.now()||Date.now()-verified>72*60*60*1000) throw new Error('Messaging rate verification is unavailable or stale.');
  const used=budget?.reservedMicrosUsd ?? 0,usedSegments=budget?.reservedSegments ?? 0;
  if(!Number.isSafeInteger(used)||used<0||!Number.isSafeInteger(usedSegments)||usedSegments<0) throw new Error('Invalid messaging budget.');
  const reservedMicrosUsd=used+rate*count,reservedSegments=usedSegments+count;
  if(!Number.isSafeInteger(reservedMicrosUsd)||reservedMicrosUsd>limit||reservedSegments>config.dailySegmentLimit) throw new Error('Approved messaging limit has been reached.');
  return {reservedMicrosUsd,reservedSegments};
}
module.exports={GHL_PUBLIC_KEY,signedDelivery,delivery,recipientId,messageFingerprint,segments,maySend,isOptOut,reserveBudget};
