// Supplemental questions never contribute to a qualification score.
const FINANCING_SCRIPT = `OPTIONAL FINANCING INFORMATION — NON-DISQUALIFYING
Ask buyers and investment-property purchasers; skip for seller-only inquiries.
Have you been pre-qualified for a loan amount? (Yes/No)
If yes: What amount have you been pre-qualified for? Record the amount; stop this branch.
If no: Are you working with a lender or mortgage broker? (Yes/No)
If yes: No further financing questions.
If no: Would you like to be referred to a lender or mortgage broker? (Yes/No)
If yes: Flag referral requested for an approved preferred partner lender or mortgage broker. This is a request, not an already-completed referral.
If no: Stop financing questions. No follow-up pressure.
Missing pre-qualification, an unknown/declined amount, not working with a lender, or declining a referral never disqualifies this inquiry. No lender approval or financing eligibility is certified by the phone agent.`;
const WEEKLY_EMAIL_LABEL = 'Send me a weekly email with newly listed homes that match my search preferences. I can unsubscribe at any time.';
const WEEKLY_EMAIL_PROTOCOL = `STEP 3 — OPTIONAL WEEKLY LISTING EMAILS
The website and phone-agent handoff review share one saved preference. Honor existing unsubscribes; reload if the preference changed while it was being reviewed.
Present the weekly listing-email checkbox selected by default, with this label: "${WEEKLY_EMAIL_LABEL}"
The prospect can clear the checkbox without affecting their inquiry, qualification, referral or Realtor handoff.
Record the actual submitted/confirmed preference, its wording/version, time and source. Do not enroll a prospect who was never shown or asked the preference, who opted out, or whose earlier unsubscribe remains in effect.
Until HAR/Repliers delivery is confirmed, create a manual setup task for the assigned Realtor. Include the search criteria, email address and preference evidence. Mark requested/pending setup; never mark delivery active before the Realtor confirms the alert is configured.
Every listing email must include an easy-to-find, working unsubscribe option. Before sending, confirm the provider/manual process honors unsubscribe requests and prevents future listing sends. Phone agents also honor a verbal/email removal request without requiring a login.
Email and SMS preferences are separate. Email selection does not authorize texting. Any permitted text must give a simple opt-out instruction; STOP and equivalent opt-out requests suppress future texts through the messaging workflow.
Do not enable weekly sends while the email unsubscribe process is unverified. No weekly email automation is activated by this draft.`;
function financingProfile(input={}) {
 const yesNo=value=>['yes','no'].includes(value)?value:'unknown';
 const loanPrequalified=yesNo(input.loanPrequalified);
 const workingWithLender=loanPrequalified==='no'?yesNo(input.workingWithLender):'not_applicable';
 const wantsLenderReferral=loanPrequalified==='no' && workingWithLender==='no'?yesNo(input.wantsLenderReferral):'not_applicable';
 return {loanPrequalified,prequalifiedAmount:loanPrequalified==='yes' && typeof input.prequalifiedAmount==='string'?input.prequalifiedAmount.trim().slice(0,80):'',workingWithLender,wantsLenderReferral,lenderReferralRequested:wantsLenderReferral==='yes',nonDisqualifying:true};
}
module.exports={FINANCING_SCRIPT,WEEKLY_EMAIL_LABEL,WEEKLY_EMAIL_PROTOCOL,financingProfile};
