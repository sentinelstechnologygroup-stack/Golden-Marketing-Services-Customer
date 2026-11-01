import {accountLink,clearAccountLink} from './accountLink';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, sendSignInLinkToEmail, verifyBeforeUpdateEmail, isSignInWithEmailLink, signInWithEmailLink, signOut } from 'firebase/auth';
const projectId=import.meta.env.VITE_VISITOR_PROJECT_ID;
export const accountsEnabled=projectId==='gcr-visitor-preview-2026'&&Boolean(import.meta.env.VITE_VISITOR_API_KEY&&import.meta.env.VITE_VISITOR_APP_ID);
let auth,cache=null,loading=null,mutationQueue=Promise.resolve();const listeners=new Set();
function service(){if(!accountsEnabled)throw Error('Accounts are temporarily unavailable.');if(!auth){const app=getApps().find(a=>a.name==='gcr-visitors')||initializeApp({projectId,apiKey:import.meta.env.VITE_VISITOR_API_KEY,appId:import.meta.env.VITE_VISITOR_APP_ID,authDomain:projectId+'.firebaseapp.com'},'gcr-visitors');auth=getAuth(app);}return auth;}
async function request(body){const user=service().currentUser;if(!user?.emailVerified)throw Error('Verify your email first.');const response=await fetch('/api/visitor',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body),signal:AbortSignal.timeout(28000)});const data=await response.json();if(!response.ok){if(response.status===409)await loadAccount();throw Error(data.error||'Your account could not be saved.');}if(service().currentUser?.uid!==user.uid)throw Error('Your sign-in changed. Please reload.');cache=data;for(const fn of listeners)fn(data);return data;}
export function watchAccount(callback){return accountsEnabled?onAuthStateChanged(service(),user=>{cache=null;callback(user);}):()=>{};}
function pendingKey(){return 'gcr-account-inquiries:'+service().currentUser?.uid;}
function pendingInquiries(){try{return JSON.parse(localStorage.getItem(pendingKey())||'[]');}catch{return [];}}
async function drainInquiries(){for(const reference of pendingInquiries()){try{await request({action:'adopt_inquiry',reference});localStorage.setItem(pendingKey(),JSON.stringify(pendingInquiries().filter(r=>r!==reference)));}catch{break;}}return cache;}
export function loadAccount(){if(!loading)loading=request({action:'load'}).then(()=>drainInquiries()).finally(()=>{loading=null;});return loading;}
export function watchSaves(user,callback,onError=()=>{}){if(!user?.emailVerified)return()=>{};let active=true;const notify=data=>{if(active)callback(data);};listeners.add(notify);if(cache)notify(cache);loadAccount().catch(onError);const timer=setInterval(()=>{if(document.visibilityState==='visible')loadAccount().catch(onError);},30000);return()=>{active=false;listeners.delete(notify);clearInterval(timer);};}
export function saveAccount(action,changes){const uid=service().currentUser?.uid;const operation=mutationQueue.catch(()=>{}).then(async()=>{if(!uid||service().currentUser?.uid!==uid)throw Error('Your sign-in changed. Please reload.');if(!cache)await loadAccount();return request({action,revision:cache.revision,...changes});});mutationQueue=operation;return operation;}
export function saveProfile(profile){return saveAccount('profile',{profile});}
export function savePermissions(permissions){return saveAccount('permissions',{permissions});}
export function saveSearch(search,enableEmail=false){return saveAccount('save_search',{search,enableEmail});}
export function deleteSearch(searchId){return saveAccount('delete_search',{searchId});}
export async function updateSaves(changes){if(!cache)await loadAccount();if(changes.homes)return saveAccount('homes',{homes:changes.homes});if(changes.searches){const added=changes.searches.find(s=>!s.id);if(added)return saveSearch({...added,frequency:'off'});const removed=cache.searches.find(s=>!changes.searches.some(n=>n.id===s.id));if(removed)return deleteSearch(removed.id);}return cache;}
export async function continueSave(changes){if(!cache)await loadAccount();return updateSaves(changes.homes?{homes:[...new Set([...changes.homes,...cache.homes])].slice(0,50)}:changes);}
export async function sendAccountLink(email){await sendSignInLinkToEmail(service(),email,{url:window.location.origin+'/account',handleCodeInApp:true});localStorage.setItem('gcr-account-email',email);}
export function hasAccountLink(){return accountsEnabled&&isSignInWithEmailLink(service(),accountLink());}
export function rememberedEmail(){try{return localStorage.getItem('gcr-account-email')||'';}catch{return '';}}
export async function completeAccountLink(email){const result=await signInWithEmailLink(service(),email,accountLink());localStorage.removeItem('gcr-account-email');clearAccountLink();window.history.replaceState({},'',window.location.pathname);return result.user;}
export async function enterAccount(email,password){return (await signInWithEmailAndPassword(service(),email,password)).user;}
export async function verifyAccount(){if(service().currentUser)await sendEmailVerification(service().currentUser);}
export async function refreshAccount(){const user=service().currentUser;if(user){await user.reload();await user.getIdToken(true);}return user;}
export function resetAccount(email){return sendPasswordResetEmail(service(),email);}
export function leaveAccount(){cache=null;return signOut(service());}
export function accountError(error){if(['auth/weak-password','auth/password-does-not-meet-requirements'].includes(error?.code))return 'Use a password between 12 and 128 characters.';if(error?.code==='auth/too-many-requests')return 'Please wait before trying again.';if(error?.code==='auth/expired-action-code'||error?.code==='auth/invalid-action-code')return 'This sign-in link has expired or was already used. Request a new link.';if(error?.code?.startsWith('auth/'))return 'We could not sign you in. Check your email or request a fresh sign-in link.';return error?.message||'Your account could not be saved. Please try again.';}

export async function syncInquiry(reference,email){if(!accountsEnabled||!service().currentUser?.emailVerified||email&&service().currentUser.email.toLowerCase()!==String(email).toLowerCase()||!/^([a-f0-9]{64})$/.test(reference||''))return;try{localStorage.setItem(pendingKey(),JSON.stringify([...new Set([...pendingInquiries(),reference])].slice(-20)));}catch{/* Durable intake itself is already saved by the server. */}await drainInquiries();return cache;}

export function changeAccountEmail(email){if(!service().currentUser)throw Error('Sign in first.');return verifyBeforeUpdateEmail(service().currentUser,email,{url:window.location.origin+'/account',handleCodeInApp:false});}

export async function createPasswordAccount(email,password){const result=await createUserWithEmailAndPassword(service(),email,password);await sendEmailVerification(result.user,{url:window.location.origin+'/account'});return result.user;}
export async function recordViewed(listingId){if(!accountsEnabled||!service().currentUser?.emailVerified)return;if(!cache)await loadAccount();if(cache?.recentlyViewed?.[0]===listingId)return;return saveAccount('recently_viewed',{listingId});}
