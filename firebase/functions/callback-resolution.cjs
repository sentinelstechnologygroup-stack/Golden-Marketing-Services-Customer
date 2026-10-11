const {FieldValue}=require('firebase-admin/firestore');
const {ms}=require('./call-center-policy.cjs');
const successful=new Set(['connected','qualified','warm_transfer_completed','appointment_booked','appointment_completed','contact_accepted']);
function eligible(task,{tenantId,leadId,brandId,cutoffMs}){const created=ms(task.createdAt || task.created_date),due=ms(task.dueAt || task.due_date);return task.status==='pending' && task.task_type==='callback_reminder' && (task.leadId || task.lead_id)===leadId && (!task.tenantId || task.tenantId===tenantId) && (!(task.brandId || task.brand_id) || (task.brandId || task.brand_id)===brandId) && (created!=null || due!=null) && (created==null || created<=cutoffMs) && (due==null || due<=cutoffMs);}
async function resolveInTransaction({db,tx,tenantId,leadId,brandId,actorUid,disposition,cutoffMs=Date.now(),completionAt}){
 if(!successful.has(disposition))return 0;
 const collection=db.collection(`tenants/${tenantId}/followUpTasks`);const [canonical,legacy]=await Promise.all([tx.get(collection.where('leadId','==',leadId).limit(501)),tx.get(collection.where('lead_id','==',leadId).limit(501))]);
 const unique=new Map([...canonical.docs,...legacy.docs].map(doc=>[doc.id,doc]));if(unique.size>500)throw new Error('Too many follow-up tasks for one contact.');
 let count=0;for(const doc of unique.values())if(eligible(doc.data(),{tenantId,leadId,brandId,cutoffMs})){tx.update(doc.ref,{status:'completed',completedAt:completionAt || FieldValue.serverTimestamp(),completedBy:actorUid,completionSource:'successful_call_disposition',completionDisposition:disposition,updatedAt:FieldValue.serverTimestamp()});count++;}return count;
}
async function saveLeadOutcome({db,ref,patch,tenantId,leadId,brandId,actorUid,disposition,cutoffMs=Date.now(),completionAt}){return db.runTransaction(async tx=>{await tx.get(ref);const count=await resolveInTransaction({db,tx,tenantId,leadId,brandId,actorUid,disposition,cutoffMs,completionAt});tx.update(ref,patch);return count;});}
module.exports={eligible,successful,resolveInTransaction,saveLeadOutcome};
