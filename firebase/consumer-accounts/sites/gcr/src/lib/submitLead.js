import {syncInquiry} from './visitorAccount';
import {trackAcceptedLead,controlledTest} from './campaignTracking';
import { leadAttribution } from "@/lib/analytics";
import { CONTACT_CONSENT_VERSION } from './contactConsent';

let currentSubmission=null;
const formStartedAt=new Date().toISOString();

export async function submitLead(payload) {
  const fingerprint=JSON.stringify(payload);
  if(currentSubmission?.fingerprint!==fingerprint)currentSubmission={fingerprint,id:crypto.randomUUID()};
  const response = await fetch("/api/submit-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      submissionId:currentSubmission.id,formStartedAt,consentVersion:CONTACT_CONSENT_VERSION,consentAccepted:true,consentMethod:'form_submission',
      ...leadAttribution(),
      page_url: window.location.href,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.accepted!==true || !result.reference) throw new Error(result.error || "We could not confirm your inquiry. Please try again later.");
  void syncInquiry(result.reference,payload.email).catch(()=>{});
  trackAcceptedLead({receiptId:result.reference,testOnly:controlledTest(payload.name),kind:'inquiry'});
  return result;
}
