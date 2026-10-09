const {FieldValue}=require('firebase-admin/firestore');
const crypto=require('node:crypto');
async function advance({db,ref,provider,expectedCallId,callbackUrl}){
 const next=await db.runTransaction(async tx=>{const call=(await tx.get(ref)).data();if(!call || call.consultationCallId!==expectedCallId || call.consultationJoined || !['starting','consulting'].includes(call.transferStatus))return null;const index=(call.handoffIndex || 0)+1;const recipient=call.handoffOrder?.[index];tx.update(ref,{handoffIndex:index,consultationCallId:null,consultationStatus:'pending',consultationJoined:false,transferStatus:recipient?'starting':'exhausted',...(recipient?{consultationDestination:recipient.phone,handoffRecipientId:recipient.id}:{})});return {call,recipient,index};});
 if(!next)return;
 if(!next.recipient){await provider.hold(next.call.conferenceId,next.call.providerCallId,false);await ref.update({status:'in_progress'});return;}
 try{const result=await provider.start({to:next.recipient.phone,from:next.call.from,callbackUrl,timeoutSeconds:next.call.handoffRingSeconds || 25,commandId:crypto.randomUUID(),clientState:require('./server-dial.cjs').state(ref.id,next.call.tenantId,'consultation')});await ref.update({consultationCallId:result.id,transferStatus:'consulting',updatedAt:FieldValue.serverTimestamp()});}
 catch{await provider.hold(next.call.conferenceId,next.call.providerCallId,false);await ref.update({transferStatus:'needs_reconciliation'});}
}
module.exports={advance};
