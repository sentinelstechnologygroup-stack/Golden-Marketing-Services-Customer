'use strict';
function rubricItems(form) {
  const fields=form?.fields || form?.questions;
  if(!Array.isArray(fields) || !fields.length || fields.length>40) throw new Error('Approved qualification rubric is required.');
  return fields.map((field,index)=>{
    const label=typeof field==='string'?field:field.label || field.question || field.text;
    if(typeof label!=='string' || !label.trim() || label.length>1000) throw new Error('Invalid qualification criterion.');
    const weight=typeof field==='object' && field.weight!==undefined?Number(field.weight):1;
    if(!Number.isFinite(weight) || weight<=0 || weight>1000) throw new Error('Invalid qualification weight.');
    return {id:typeof field==='object' && field.id?String(field.id):`criterion-${index+1}`,label,weight,required:typeof field==='object' && field.required===true};
  });
}
function verifiedScorecard(output,criteria,transcript) {
  if(!Array.isArray(output?.items) || output.items.length!==criteria.length) throw new Error('Incomplete AI scorecard.');
  const items=criteria.map(criterion=>{
    const rows=output.items.filter(item=>item.id===criterion.id);
    if(rows.length!==1 || !['met','not_met','unclear','not_applicable'].includes(rows[0].outcome)) throw new Error('Invalid scorecard criterion.');
    const item=rows[0];
    const quote=typeof item.quote==='string'?item.quote.trim().slice(0,500):'';
    const supported=quote.length>0 && transcript.includes(quote);
    const outcome=supported && !(criterion.required && item.outcome==='not_applicable')?item.outcome:'unclear';
    return {id:criterion.id,label:criterion.label,weight:criterion.weight ?? 1,outcome,quote:supported?quote:'',explanation:String(item.explanation || '').slice(0,1000)};
  });
  const assessed=items.filter(item=>['met','not_met'].includes(item.outcome));
  const unresolved=items.filter(item=>item.outcome==='unclear').length;
  const totalWeight=assessed.reduce((sum,item)=>sum+item.weight,0);
  const earnedWeight=assessed.filter(item=>item.outcome==='met').reduce((sum,item)=>sum+item.weight,0);
  return {items,score:unresolved || !assessed.length?null:Math.round(100*earnedWeight/totalWeight),coverage:Math.round(100*items.filter(item=>item.outcome!=='unclear').length/items.length),status:'needs_human_review',aiGenerated:true};
}
function transcriptionSegments(results) {
  if(!Array.isArray(results)) throw new Error('Invalid transcription result.');
  const segments=results.map(result=>{
    const alternative=result.alternatives?.[0];
    if(typeof alternative?.transcript!=='string') throw new Error('Invalid transcript segment.');
    const first=alternative.words?.[0]?.startTime,last=alternative.words?.at(-1)?.endTime;
    const seconds=value=>typeof value==='string' && /^\d+(\.\d+)?s$/.test(value)?Number(value.slice(0,-1)):null;
    return {channel:result.channelTag || null,text:alternative.transcript,startSeconds:seconds(first),endSeconds:seconds(last),confidence:Number.isFinite(alternative.confidence)?alternative.confidence:null};
  });
  segments.sort((a,b)=>(a.startSeconds ?? 0)-(b.startSeconds ?? 0));
  return {segments,text:segments.map(segment=>segment.text).join('\n')};
}
module.exports={rubricItems,verifiedScorecard,transcriptionSegments};
