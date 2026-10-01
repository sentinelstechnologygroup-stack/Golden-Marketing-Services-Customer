const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
if (process.env.CONFIRM_GMS_INITIAL_ADMIN !== 'yes') throw new Error('Explicit administrator provisioning confirmation is required.');
const email = String(process.env.GMS_INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.GMS_INITIAL_ADMIN_PASSWORD || '');
if (!email.includes('@') || password.length < 8) throw new Error('Email and temporary password are required.');
initializeApp({ projectId: 'linkmarketing-agent-portal-crm', credential: applicationDefault() });
(async () => {
  const auth = getAuth();
  try {
    await auth.getUserByEmail(email);
    throw new Error('Account already exists; refusing to overwrite it.');
  } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  const user = await auth.createUser({ email, password, displayName: 'GMS Super Admin', emailVerified: false });
  await getFirestore().doc(`users/${user.uid}`).set({ uid: user.uid, email, displayName: 'GMS Super Admin', status: 'pending_password_change', mustChangePassword: true, createdAt: FieldValue.serverTimestamp() });
  await auth.setCustomUserClaims(user.uid, { mustChangePassword: true, initialAdminSetup: true });
  console.log(JSON.stringify({ uid: user.uid, email, passwordChangeRequired: true, portals: ['agent', 'customer'] }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
