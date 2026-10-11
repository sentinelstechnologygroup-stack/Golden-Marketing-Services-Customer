// Prepare a review draft through the existing onboarding service. Never approves
// campaigns, enables intake, changes call recipients, or initiates calls.
const {execFileSync}=require('node:child_process');
const path=require('node:path');const fs=require('node:fs');
const projectId='gms-prod-1089114348316';const tenantId='tenant-golden-cross-beta';
if(process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Production draft preparation cannot use an emulator');
const {initializeApp,applicationDefault}=require('firebase-admin/app');
initializeApp({projectId,storageBucket:`${projectId}.firebasestorage.app`,credential:applicationDefault()});
const {getFirestore}=require('firebase-admin/firestore');const {getAuth}=require('firebase-admin/auth');const {getStorage}=require('firebase-admin/storage');
const onboarding=require('../client-onboarding');const policy=require('../client-onboarding-policy.cjs');
const {FINANCING_SCRIPT,WEEKLY_EMAIL_PROTOCOL}=require('../lead-enrichment-policy.cjs');
async function main(){
 const db=getFirestore();const root=db.doc(`tenants/${tenantId}`);const snapshot=await root.collection('config').doc('onboarding').get();
 const saved=snapshot.data();if(saved.lifecycle!=='draft')throw new Error('Refusing to alter an activated client');
 const [draft,script]=await Promise.all([root.collection('qualificationForms').doc('qualification-golden-cross-default').get(),root.collection('scripts').doc('script-golden-cross-default').get()]);
 if(!draft.exists || !script.exists)throw new Error('Existing broker-review sources required');
 const data=structuredClone(saved.data);const empty=data.campaigns.find(c=>c.id==='campaign-e5de6185');if(!empty)throw new Error('Expected draft campaign missing');
 if(empty.script && !empty.name.includes('Homes Around North Houston'))throw new Error('Another administrator has prepared this campaign; review rather than overwrite');
 const consent="I agree that GMS Pro and Golden Cross Realty may contact me by phone and email about this real estate inquiry. GMS Pro will review and verify my request before connecting me with the brokerage.";
 const baseProtocol=`BROKER REVIEW DRAFT — not approved for live outreach or billable qualification.\nWebsite: Homes Around North Houston. Brokerage: Golden Cross Realty. Intake provider: GMS Pro.\nServices: Buying, Selling, Investment Properties, Buying & Selling.\n${draft.data().description}\n\nPreserve three documented requalification checkpoints: inquiry/contact authorization; customer-approved needs and qualification criteria; readiness/consent and Realtor acceptance at handoff. These checkpoint labels are proposed for this website and need customer confirmation against the agreement.\nWebsite permission covers phone and email about this inquiry. It does not grant SMS permission or recording permission. Record those separately if requested.\nNo answer/voicemail: save disposition and a dated callback task; no automatic qualification. No staffing or response-time promise is approved.\nOpt-out, wrong person or denied inquiry: stop outreach and record the applicable disposition. Existing representation or uncertainty: broker review before normal qualification/handoff.\nQualified requires an approved rubric and documented conversation/identity verification. This draft has no approved score or pass threshold.\nHandoff: obtain prospect permission; consult the existing brokerage call tree; brief the recipient; record actual acceptance and provider outcome. If unavailable, resume the prospect conversation and arrange a callback. An attempted transfer or booked appointment is not a completed handoff or billable qualified lead.\nPreserve source/campaign, inquiry reference, permission text/version, answers, agent notes, provider call IDs, verification, disposition, callback and handoff evidence.\nExisting beta script reference (beta acceptance scope only): ${script.id}, version ${script.data().version || 1}.`;
 const protocol=`${baseProtocol}\n\n${FINANCING_SCRIPT}\n\n${WEEKLY_EMAIL_PROTOCOL}`;
 const questions=draft.data().questions || draft.data().fields || [];
 if(!questions.length)throw new Error('Source qualification questions missing');
 const qualification=questions.filter(q=>q.id!=='lender-next-steps').map(q=>`${q.question || q.label} ${q.instruction || q.instructions || ''}`.trim()).join('\n');
 const campaign={...empty,name:'Homes Around North Houston — Buying, Selling & Investment Properties',type:'website',source:'Homes Around North Houston website',script:protocol,qualification,consent,adCopy:'Buy, Sell, or Invest in North Houston. Tell us your property goals. GMS Pro will review and verify your request before connecting you with Golden Cross Realty.'};
 const documentId='north-houston-workflow-review-v3';campaign.documentIds=[...new Set([...(campaign.documentIds || []),documentId])];
 data.campaigns=data.campaigns.map(c=>c.id===campaign.id?campaign:c);const normalized=policy.normalize(data);
 const packet=`# Homes Around North Houston — Workflow Review\n\nStatus: draft for Golden Cross Realty review.\n\n${protocol}\n\n## Qualification questions\n\n${qualification}\n\n## Website contact permission\n\n${consent}\n\n## Approval needed\n\nConfirm the actual criteria, score/threshold or non-scored assessment method, three requalification checkpoints, callback expectations, brokerage recipient availability, and contractual acceptance/billability conditions. No approval is recorded by this preparation.\n\n## Pending integration\n\nRepliers IDX and public domain launch remain pending. No marketing SMS automation is enabled.\n`;
 const output=path.resolve(__dirname,'../../../../output/north-houston-workflow-review.md');fs.writeFileSync(output,packet);
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'review_only',revision:saved.revision,campaign:campaign.name,packet:output}));return;}
 const admin=await getAuth().getUserByEmail('admin@goldenmarketingservices.com');if(!admin.customClaims?.gmsSuperAdmin && !admin.customClaims?.platformAdmin)throw new Error('Existing GMS administrator required');
 const request=data=>({auth:{uid:admin.uid,token:{}},data});
 const docRef=root.collection('documents').doc(documentId);
 if(!(await docRef.get()).exists){
  const storagePath=`tenants/${tenantId}/documents/${documentId}/workflow-review.md`;
  await getStorage().bucket().file(storagePath).save(packet,{resumable:false,metadata:{contentType:'text/markdown; charset=utf-8'}});
  await onboarding.addGmsClientDocument.run(request({clientId:tenantId,documentId,storagePath,name:'Homes Around North Houston — Workflow Review (Draft)'}));
 }
 const result=await onboarding.saveGmsClient.run(request({clientId:tenantId,revision:saved.revision,data:normalized}));
 const route=(await db.doc(`ingestionRoutes/${tenantId}--${campaign.id}`).get()).data();
 if(route.status!=='paused' || result.lifecycle!=='draft')throw new Error('Draft routing safety check failed');
 console.log(JSON.stringify({saved:true,revision:result.revision,lifecycle:result.lifecycle,routeStatus:route.status,campaign:campaign.name,readiness:result.readiness,packet:output}));
}
main().catch(error=>{console.error(error.code || error.message);process.exitCode=1});
