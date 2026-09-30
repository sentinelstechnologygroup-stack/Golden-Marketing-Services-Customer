import { getApp, getApps, initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const required = ["apiKey", "authDomain", "projectId", "appId"];
const env = (key) => import.meta.env?.[key] || "";
// Public Firebase web configuration for the existing production backend.
// Vercel variables still override these values when configured.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHNMYWtu7RkVe0apq94oB271_sXvIIWXE",
  authDomain: "linkmarketing-agent-portal-crm.firebaseapp.com",
  projectId: "linkmarketing-agent-portal-crm",
  storageBucket: "linkmarketing-agent-portal-crm.firebasestorage.app",
  messagingSenderId: "1089114348316",
  appId: "1:1089114348316:web:6d1cf9944ca6ef1cc778d9",
};

export const firebaseConfig = {
  apiKey: env("VITE_FIREBASE_CUSTOMER_PORTAL_API_KEY") || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: env("VITE_FIREBASE_CUSTOMER_PORTAL_AUTH_DOMAIN") || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: env("VITE_FIREBASE_CUSTOMER_PORTAL_PROJECT_ID") || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: env("VITE_FIREBASE_CUSTOMER_PORTAL_STORAGE_BUCKET") || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: env("VITE_FIREBASE_CUSTOMER_PORTAL_MESSAGING_SENDER_ID") || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: env("VITE_FIREBASE_CUSTOMER_PORTAL_APP_ID") || DEFAULT_FIREBASE_CONFIG.appId,
};

export const firebaseConfigured = required.every((key) => Boolean(firebaseConfig[key]));
export const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;
// App Check is enabled explicitly after the new GMS portal domains are
// registered in Firebase. A stale Vercel key must never block Firebase Auth.
const appCheckSiteKey = env("VITE_FIREBASE_CUSTOMER_PORTAL_APP_CHECK_SITE_KEY");
const appCheckEnabled = env("VITE_FIREBASE_ENABLE_APP_CHECK") === "true";
export const firebaseAppCheck = firebaseApp && appCheckEnabled && appCheckSiteKey && typeof window !== "undefined"
  ? initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseFunctions = firebaseApp ? getFunctions(firebaseApp, "us-central1") : null;
export const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

if (firebaseApp && import.meta.env.DEV && env("VITE_FIREBASE_USE_EMULATORS") === "true") {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(firebaseFunctions, "127.0.0.1", 5001);
  connectFirestoreEmulator(firebaseDb, "127.0.0.1", 8080);
  connectStorageEmulator(firebaseStorage, "127.0.0.1", 9199);
}
