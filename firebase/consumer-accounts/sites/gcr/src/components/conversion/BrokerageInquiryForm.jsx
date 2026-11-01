import {syncInquiry} from '../../lib/visitorAccount';
import {trackAcceptedLead,controlledTest} from '../../lib/campaignTracking';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { CONTACT_CONSENT_TEXT as CONSENT_TEXT, CONTACT_CONSENT_VERSION as CONSENT_VERSION } from '../../lib/contactConsent';
/** @param {{ property?: any, filters?: Record<string,string>, weeklyOnly?: boolean, weeklyDefault?: boolean, onWeeklyChange?: (value: boolean) => Promise<boolean> }} props */
export default function BrokerageInquiryForm({ property=null, filters={location:'',minPrice:'',maxPrice:'',propertyType:''}, weeklyOnly=false, weeklyDefault=false, onWeeklyChange=async()=>true }) {
  const [form,setForm]=useState({name:'',email:'',phone:'',message:'',weekly:weeklyDefault,website_check:''});
  const [status,setStatus]=useState('idle'),[error,setError]=useState('');
  const [showThanks,setShowThanks]=useState(false);
  const started=useRef(new Date().toISOString()),receipt=useRef(null);
  useEffect(()=>setForm(current=>({...current,weekly:weeklyDefault})),[weeklyDefault]);
  const change=(key,value)=>setForm(current=>({...current,[key]:value}));
  async function submit(event){
    event.preventDefault();if(status==='sending')return;
    const details={...form,property:property?{mlsNumber:property.mlsNumber,boardId:property.boardId,address:property.address}:null,filters};
    const fingerprint=JSON.stringify(details);
    if(receipt.current?.fingerprint!==fingerprint)receipt.current={fingerprint,id:crypto.randomUUID()};
    setStatus('sending');setError('');
    let attribution={};
    try{attribution=JSON.parse(sessionStorage.getItem('property-search-attribution')||'{}');}catch{/* Tracking is optional. */}
    const params=new URLSearchParams(window.location.search);
    for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','gbraid','wbraid','fbclid'])if(params.has(key))attribution[key]=params.get(key).slice(0,200);
    try{
      const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        submissionId:receipt.current.id,name:form.name,email:form.email,phone:form.phone,interested_in:'buying',
        message:form.message,property:details.property,searchCriteria:filters,requestType:weeklyOnly?'weekly_matches':'property_inquiry',
        website_check:form.website_check,formStartedAt:started.current,consentAccepted:true,consentVersion:CONSENT_VERSION,consentMethod:'form_submission',
        weeklyListingPreferencePresented:true,weeklyListingEmailsRequested:form.weekly,
        funnelProfile:{area:filters.location||'',budgetRange:[filters.minPrice,filters.maxPrice].filter(Boolean).join('–'),propertyType:filters.propertyType||''},attribution,
      })});
      const result=await response.json();
      if(!response.ok || result.accepted!==true || !result.reference)throw new Error(result.error||'Receipt could not be confirmed.');
      void syncInquiry(result.reference,form.email).catch(()=>{});
      trackAcceptedLead({receiptId:result.reference,testOnly:controlledTest(form.name),area:filters?.location,kind:weeklyOnly?'weekly_matches':'property_inquiry'});setStatus('sent');setShowThanks(true);
    }catch(failure){setStatus('idle');setError(failure.message||'Please try again later.');}
  }
  if(status==='sent')return <section className="gms-inquiry" aria-label="Inquiry received">
    <div role="status"><h2>Thank you for your request.</h2><p>Your inquiry has been sent to Golden Cross Realty. Our team will contact you shortly.</p></div>
    <Dialog open={showThanks} onOpenChange={setShowThanks}><DialogContent className="bg-white text-[#192D3D] sm:max-w-md"><p className="ps-eyebrow">GOLDEN CROSS REALTY</p><DialogTitle className="font-display text-3xl">Thank you for your request.</DialogTitle><DialogDescription className="text-base leading-relaxed text-[#475762]">Your inquiry has been sent to Golden Cross Realty. Our team will contact you shortly.</DialogDescription><button type="button" className="ps-primary" onClick={()=>setShowThanks(false)}>Done</button></DialogContent></Dialog>
  </section>;
  return <section className="gms-inquiry" aria-label={weeklyOnly?'Request weekly home matches':'Ask about this home'}>
    <p className="ps-eyebrow">GOLDEN CROSS REALTY</p>
    <h2>{weeklyOnly?'Find your next home, one good match at a time.':'Interested in this home?'}</h2>
    <p>{weeklyOnly?'Request weekly newly listed homes matching this search.':'Ask a question or request a showing. The Golden Cross Realty office team will review your request and help with the next step.'}</p>

    <form onSubmit={submit}>
      <div className="ps-fields"><label>Name<input required autoComplete="name" value={form.name} onChange={e=>change('name',e.target.value)} /></label><label>Email<input required type="email" autoComplete="email" value={form.email} onChange={e=>change('email',e.target.value)} /></label><label>Phone<input required type="tel" autoComplete="tel" value={form.phone} onChange={e=>change('phone',e.target.value)} /></label></div>
      <label className="ps-trap" aria-hidden="true">Leave blank<input tabIndex={-1} autoComplete="off" value={form.website_check} onChange={e=>change('website_check',e.target.value)} /></label>
      <label>Your question or preferred showing time<textarea maxLength={2000} value={form.message} onChange={e=>change('message',e.target.value)} /></label>
      <label className="ps-check"><input type="checkbox" checked={form.weekly} onChange={async e=>{const value=e.target.checked;change('weekly',value);if(!await onWeeklyChange(value))setError('Your account preference could not be updated. Please try again before sending.');}} />Send me a weekly email with newly listed homes that match my search preferences. I can unsubscribe at any time.</label>
      {error && <p role="alert">{error}</p>}<button disabled={status==='sending'} className="ps-primary" type="submit">{status==='sending'?'Submitting…':weeklyOnly?'Request weekly matches':'Send inquiry to Golden Cross Realty'}</button><p className="ps-small">* {CONSENT_TEXT}</p>
    </form>
  </section>;
}




