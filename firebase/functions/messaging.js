const { getFirestore } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { verifySignature } = require('./telephony/providers.cjs');
const { createMessagingService } = require('./messaging/service.cjs');
const apiKey = defineSecret('TELNYX_API_KEY');
const service = () => createMessagingService({db:getFirestore(), token:()=>apiKey.value(), enabled:process.env.GMS_SMS_ENABLED === 'true'});
exports.sendLeadSmsVerification = onDocumentCreated({document:'smsIntakes/{intakeId}', secrets:[apiKey], retry:true}, event => service().send(event.params.intakeId));
exports.telnyxMessagingWebhook = onRequest({cors:false}, async (request, response) => {
  if (request.method !== 'POST') return response.sendStatus(405);
  if (!verifySignature('telnyx', {rawBody:request.rawBody, signature:request.get('telnyx-signature-ed25519'), timestamp:request.get('telnyx-timestamp')}, {publicKey:process.env.TELNYX_PUBLIC_KEY})) return response.sendStatus(401);
  try { await service().webhook(request.body?.data || {}); return response.sendStatus(200); }
  catch { return response.sendStatus(503); }
});
