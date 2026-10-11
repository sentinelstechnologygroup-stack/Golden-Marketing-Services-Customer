const ms=value=>value?.toMillis?.() ?? (typeof value==='number'?value:Date.parse(value || '') || null);
const sec=(a,b)=>a!=null && b!=null?Math.max(0,(b-a)/1000):null;
function summarize(calls,events,from,to) {
  const rows=calls.map(c=>{
    const start=ms(c.startedAt || c.createdAt),connected=ms(c.connectedAt),end=ms(c.handoffAt || c.endedAt);
    const held=c.holdSeconds==null?null:c.holdSeconds+(c.holdStartedAt?sec(ms(c.holdStartedAt),Math.min(ms(c.endedAt) || to,to)) || 0:0);
    return {...c,queueSeconds:sec(ms(c.queuedAt),ms(c.acceptedAt) || ms(c.queueExitedAt) || (c.status==='queued'?to:null)),connectionSeconds:sec(ms(c.acceptedAt),connected),handlingSeconds:sec(connected,end || to),holdSeconds:held,totalSeconds:sec(start,ms(c.endedAt) || to)};
  });
  function group(items,key,label){return [...new Set(items.map(c=>c[key] || 'unassigned'))].map(id=>({id,label:label(id),...totals(items.filter(c=>(c[key] || 'unassigned')===id))}));}
  function totals(items){const avg=key=>{const v=items.map(c=>c[key]).filter(v=>v!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};return {calls:items.length,inbound:items.filter(c=>c.direction==='inbound').length,outbound:items.filter(c=>c.direction!=='inbound').length,connected:items.filter(c=>c.connectedAt || c.connectionConfirmed).length,handoffs:items.filter(c=>c.transferStatus==='completed').length,voicemails:items.filter(c=>c.callKind==='voicemail').length,callbacks:items.filter(c=>c.status==='callback_requested' || c.callbackRequestedAt).length,avgQueueSeconds:avg('queueSeconds'),avgConnectionSeconds:avg('connectionSeconds'),avgHandlingSeconds:avg('handlingSeconds'),avgHoldSeconds:avg('holdSeconds'),queueSamples:items.filter(c=>c.queueSeconds!=null).length,handlingSamples:items.filter(c=>c.handlingSeconds!=null).length,holdSamples:items.filter(c=>c.holdSeconds!=null).length};}
  const points=[];for(const c of rows){const a=ms(c.connectedAt),b=ms(c.handoffAt || c.endedAt) || to;if(a!=null && b>from && a<to){points.push([Math.max(from,a),1],[Math.min(to,b),-1]);}}
  points.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);let concurrent=0,peak=0;for(const [,d]of points){concurrent+=d;peak=Math.max(peak,concurrent);}
  const statuses=new Map();for(const e of events){const end=ms(e.occurredAt),duration=e.previousDurationSeconds;if(end==null || duration==null || duration<0)continue;const seconds=sec(Math.max(from,end-duration*1000),Math.min(to,end));if(!seconds)continue;const key=e.agentUid+'|'+e.previousStatus;const old=statuses.get(key);statuses.set(key,{agentUid:e.agentUid,status:e.previousStatus,seconds:seconds+(old?.seconds || 0)});}
  return {summary:{...totals(rows),peakConcurrentCalls:peak},byAgent:group(rows,'agentUid',id=>id),byBrand:group(rows,'brandId',id=>id),byClient:group(rows,'tenantId',id=>rows.find(c=>c.tenantId===id)?.clientName || id),byDay:group(rows.map(c=>({...c,day:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms(c.startedAt || c.createdAt)))})),'day',id=>id),statuses:[...statuses.values()],calls:rows};
}
module.exports={ms,sec,summarize};
