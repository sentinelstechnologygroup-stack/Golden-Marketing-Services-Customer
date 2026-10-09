const crypto = require('node:crypto');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { defineSecret } = require('firebase-functions/params');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { sendSetupEmail } = require('./onboarding-email.cjs');
const emailKey = defineSecret('RESEND_API_KEY');
exports.sendGmsSetupEmail = onCall({ enforceAppCheck:false, secrets:[emailKey], maxInstances:2, timeoutSeconds:60 }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated','Sign in first.');
  const auth=getAuth(), db=getFirestore(), actor=await auth.getUser(request.auth.uid);
  if (actor.disabled || actor.customClaims?.mustChangePassword || !(actor.customClaims?.gmsSuperAdmin === true || actor.customClaims?.platformAdmin === true)) throw new HttpsError('permission-denied','Super admin access required.');
  const { kind, uid, clientId } = request.data || {};
  let recipient, target;
  if (kind === 'staff') {
    if (!/^gmsstaff_[a-f0-9]{28}$/.test(uid || '')) throw new HttpsError('invalid-argument','Choose a managed staff account.');
    target=db.doc(`agentUsers/${uid}`);
    if ((await target.get()).data()?.managedBy !== 'gms_staff') throw new HttpsError('permission-denied','Staff profile is not managed here.');
    recipient=await auth.getUser(uid);
  } else if (kind === 'client') {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(clientId || '')) throw new HttpsError('invalid-argument','Choose a client.');
    const data=(await db.doc(`tenants/${clientId}/config/onboarding`).get()).data()?.data;
    if (!data?.adminEmail) throw new HttpsError('failed-precondition','Prepare customer login first.');
    recipient=await auth.getUserByEmail(data.adminEmail);
    const member=(await db.doc(`tenants/${clientId}/members/${recipient.uid}`).get()).data();
    if (member?.active !== true || member.role !== 'client_admin' || member.brandIds?.length) throw new HttpsError('failed-precondition','Customer membership needs review.');
    target=db.doc(`tenants/${clientId}/config/clientAccess`);
  } else throw new HttpsError('invalid-argument','Choose staff or client onboarding.');
  if (recipient.disabled || !recipient.email) throw new HttpsError('failed-precondition','Account access is unavailable.');
  let result;
  try { result=await sendSetupEmail({ apiKey:emailKey.value(), auth, email:recipient.email, name:recipient.displayName || '', kind, requestId:crypto.randomUUID() }); }
  catch { result={delivery:'failed',reason:'email_service_unavailable'}; }
  await target.set({ setupEmail:{...result, recipientEmail:recipient.email, requestedBy:actor.uid, requestedAt:FieldValue.serverTimestamp()} },{merge:true});
  // Password action links/codes and email body are never persisted or returned.
  return { ...result, email:recipient.email };
});
