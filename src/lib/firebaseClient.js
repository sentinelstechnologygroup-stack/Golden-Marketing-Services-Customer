import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const required = ["apiKey", "authDomain", "projectId", "appId"];
const env = (key) => import.meta.env?.[key] || "";
// Public Firebase web configuration for the existing production backend.
// Vercel variables still override these values when configured.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyA9qG9fo-PtTjSCNU8nH6H3JFfOB8uoSWc",
  authDomain: "gms-prod-1089114348316.firebaseapp.com",
  projectId: "gms-prod-1089114348316",
  storageBucket: "gms-prod-1089114348316.firebasestorage.app",
  messagingSenderId: "852174491354",
  appId: "1:852174491354:web:2a343214aa5cc41c7b5fe3",
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
// Configure only after registering the GMS production domains in App Check.
// A missing key leaves the pre-existing authentication behavior unchanged.
const appCheckSiteKey = env('VITE_FIREBASE_APPCHECK_SITE_KEY');
const usingEmulators = import.meta.env.DEV && env('VITE_FIREBASE_USE_EMULATORS') === 'true';
export const firebaseAppCheck = firebaseApp && env('VITE_FIREBASE_APPCHECK_ENABLED') === 'true' && appCheckSiteKey && !usingEmulators
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
