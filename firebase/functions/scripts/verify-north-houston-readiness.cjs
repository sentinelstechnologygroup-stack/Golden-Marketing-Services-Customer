// Recheck CRM resources and paused intake without creating a prospect or call.
const {execFileSync}=require('node:child_process');const path=require('node:path');
const projectId='gms-prod-1089114348316';if(process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Explicit production check only');
const gcloud=path.join(process.env.LOCALAPPDATA,'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd');
const secret=name=>execFileSync('powershell.exe',['-NoProfile','-Command',`& '${gcloud}' secrets versions access latest --secret ${name} --project ${projectId}`],{encoding:'utf8',windowsHide:true}).trim();
process.env.GMS_GOHIGHLEVEL_CONFIG=secret('GMS_GOHIGHLEVEL_CONFIG');
const {initializeApp,applicationDefault}=require('firebase-admin/app');initializeApp({projectId,credential:applicationDefault()});
const {getAuth}=require('firebase-admin/auth');const {getFirestore}=require('firebase-admin/firestore');
const crm=require('../gohighlevel-operations');const policy=require('../client-onboarding-policy.cjs');
async function main(){
 const tenantId='tenant-golden-cross-beta';const admin=await getAuth().getUserByEmail('admin@goldenmarketingservices.com');
 const result=await crm.verifyGoHighLevelConnection.run({auth:{uid:admin.uid,token:{}},data:{tenantId}});
 const token=secret('GMS_INGESTION_KEY');
 const response=await fetch(`https://us-central1-${projectId}.cloudfunctions.net/ingestWebsiteLead`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'x-gms-route-key':`${tenantId}--campaign-e5de6185`,'Content-Type':'application/json'},body:'{}'});
 if(response.status!==404)throw new Error('Expected paused intake response was not observed');
 const db=getFirestore();const [config,ready]=await Promise.all([db.doc(`tenants/${tenantId}/config/onboarding`).get(),db.doc(`tenants/${tenantId}/integrations/readiness`).get()]);
 console.log(JSON.stringify({crm:result,pausedIntakeStatus:response.status,revision:config.data().revision,lifecycle:config.data().lifecycle,connections:ready.data(),connectionHashMatches:ready.data().configHash===policy.connectionVersion(config.data().data)}));
}
main().catch(error=>{console.error(error.code || error.message);process.exitCode=1});
