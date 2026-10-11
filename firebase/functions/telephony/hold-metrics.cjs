const {Timestamp}=require('firebase-admin/firestore');
async function holdMetric(db,ref,held) {
  try { await db.runTransaction(async tx=>{const c=(await tx.get(ref)).data();if(!c)return;const now=Date.now();
    if(held && !c.holdStartedAt)tx.update(ref,{holdStartedAt:Timestamp.fromMillis(now),holdSeconds:c.holdSeconds || 0});
    else if(!held && c.holdStartedAt)tx.update(ref,{holdSeconds:(c.holdSeconds || 0)+Math.max(0,(now-c.holdStartedAt.toMillis())/1000),holdStartedAt:null});
  }); } catch { console.warn('Call hold timing could not be saved.'); }
}
module.exports={holdMetric};
