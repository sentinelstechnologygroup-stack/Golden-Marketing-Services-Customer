import {syncInquiry} from '../../lib/visitorAccount';
import {trackAcceptedLead,controlledTest} from '../../lib/campaignTracking';
import CompactPreferences from './CompactPreferences';
import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Send, CheckCircle } from "lucide-react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { campaignDefaults, resultsUrl, sendFunnelAction, funnelEvent } from "@/lib/funnelSession"
import { CONTACT_CONSENT_TEXT, CONTACT_CONSENT_VERSION, SMS_CONSENT_TEXT, SMS_CONSENT_VERSION } from "@/lib/contactConsent"
import { captureLeadAttribution } from "@/lib/leadAttribution"

const interests = [
  { value: "buying", label: "Buying" },
  { value: "selling", label: "Selling" },
  { value: "investing", label: "Investment Properties" },
  { value: "buying_and_selling", label: "Buying & Selling" },
]


export default function LeadFormSection({ popup = false, open = true, closeRef, panel = content => content }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const searchInquiry = params.get('inquiryContext') === 'search'
  const requestedInterest = params.get("interest")
  useEffect(() => {
    if (interests.some(item => item.value === requestedInterest)) {
      setForm(current => ({ ...current, interested_in: requestedInterest }))
      setSubmitted(false)
    }
  }, [requestedInterest])
  const [form, setForm] = useState({
    name: "", firstName: "", lastName: "",
    phone: "",
    email: "",
    interested_in: "buying",
    message: "",
    area: "", budgetRange: "", timeline: "", workingWithAgent: "",
    website_check: "", weeklyListingEmailsRequested: true, smsConsentAccepted: false,
    ...campaignDefaults(params),
  })
  const submissionId = useRef(null)
  const telemetry = useRef({ events: [], visibleContactMs: 0, visiblePreferencesMs: 0, lastTick: 0, visible: false, stage: 1 })
  const [submitted, setSubmitted] = useState(false)
  const [step, setStep] = useState(1)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [reference, setReference] = useState("")
  const [session, setSession] = useState(null)
  useEffect(() => {
    setForm(current => ({ ...current, ...campaignDefaults(params) }))
  }, [params])
  const [attribution] = useState(captureLeadAttribution)
  const [formStartedAt] = useState(() => new Date().toISOString())
  const collectTelemetry = () => {
    const trace = telemetry.current, now = Date.now()
    if (trace.visible && trace.lastTick) trace[trace.stage === 1 ? 'visibleContactMs' : 'visiblePreferencesMs'] += now - trace.lastTick
    trace.lastTick = now
    return { events: trace.events, visibleContactMs: trace.visibleContactMs, visiblePreferencesMs: trace.visiblePreferencesMs }
  }
  useEffect(() => {
    collectTelemetry()
    telemetry.current.stage = step
    telemetry.current.visible = !document.hidden && !submitted
    const visibility = () => { collectTelemetry(); telemetry.current.visible = !document.hidden && !submitted }
    const click = event => {
      const button = event.target.closest?.('#contact button')
      if (button && telemetry.current.events.length < 100) telemetry.current.events.push({ button: button.textContent.trim().slice(0,80), clientAt: new Date().toISOString() })
    }
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('click', click, true)
    return () => { collectTelemetry(); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('click', click, true) }
  }, [step, submitted])

  useEffect(() => {
    if (open && submitted) { setSubmitted(false); setSession(null); setStep(1); submissionId.current=null; }
  }, [open]);

  const update = (field, value) => setForm((current) => {
    const next = { ...current, [field]: value }
    if (field === 'firstName' || field === 'lastName') next.name = `${next.firstName} ${next.lastName}`.trim()
    return next
  })
  useEffect(() => {
    if (!open || !session || step !== 2 || submitted) return
    const signal = () => { sendFunnelAction(session, document.hidden ? 'hidden' : 'active', {}, collectTelemetry()).catch(() => {}) }
    const heartbeat = setInterval(() => { if (!document.hidden) signal() }, 30000)
    const hide = () => { sendFunnelAction(session, 'hidden', {}, collectTelemetry()).catch(() => {}) }
    document.addEventListener('visibilitychange', signal)
    window.addEventListener('pagehide', hide)
    signal()
    return () => { clearInterval(heartbeat); document.removeEventListener('visibilitychange', signal); window.removeEventListener('pagehide', hide) }
  }, [session, step, submitted, open])

  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = async () => {
      if (sending) return false;
      if (session && step === 2 && !submitted) {
        try { await sendFunnelAction(session, 'exit', {}, collectTelemetry()); }
        catch { setError('Could not save your exit. Please try again.'); return false; }
      }
      return true;
    };
    return () => { closeRef.current = null; };
  }, [closeRef, sending, session, step, submitted]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (sending) return
    submissionId.current ||= crypto.randomUUID()
    setSending(true)
    setError("")
    try {
      if (step === 2 && session) {
        if (form.minPrice && form.maxPrice && Number(form.minPrice) > Number(form.maxPrice)) throw new Error('Maximum price must be at least the minimum price.')
        await sendFunnelAction(session, 'complete', { ...form, weeklyListingPreferencePresented: true, area: form.city || form.zip || form.neighborhood }, collectTelemetry())
        funnelEvent('preferences_completed')
        setSubmitted(true)
        navigate(resultsUrl(form, params.toString()))
        return
      }
      const response = await fetch("/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submissionId.current, name: form.name, email: form.email, phone: form.phone, interested_in: form.interested_in,
          funnelAction: 'capture',
          funnelTelemetry: collectTelemetry(),
          weeklyListingEmailsRequested: form.weeklyListingEmailsRequested, weeklyListingPreferencePresented: step === 2,
          message: form.message, website_check: form.website_check, formStartedAt,
          consentAccepted: true, consentVersion: CONTACT_CONSENT_VERSION, consentMethod: 'form_submission',
          smsConsentAccepted: form.smsConsentAccepted, smsConsentVersion: SMS_CONSENT_VERSION,
          funnelProfile: { ...campaignDefaults(params), area: form.city || form.zip || form.neighborhood },
          attribution: { ...attribution, ...captureLeadAttribution() },
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.accepted !== true || !result.reference) throw new Error(result.error || "We could not confirm receipt. Please contact the Golden Cross Realty office before submitting again.")
      trackAcceptedLead({receiptId:result.reference,testOnly:controlledTest(form.name),area:form.city||form.zip});setReference(result.reference);void syncInquiry(result.reference,form.email).catch(()=>{})
      if (!result.sessionId || !result.sessionToken) throw new Error('Contact capture is not available yet. Please try again later.')
      setSession({ sessionId: result.sessionId, sessionToken: result.sessionToken })
      funnelEvent('contact_captured')
      setStep(2)
    } catch (failure) {
      setError(failure.message || "We could not confirm receipt. Please contact the Golden Cross Realty office before submitting again.")
    } finally { setSending(false) }
  }

  if (submitted) {
    return panel(
      <section id="contact" className={popup ? "relative" : "relative bg-[#F1F3F5] py-20 lg:py-28"}>
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-12 shadow-xl"
          >
            <CheckCircle className="w-16 h-16 text-[#C5A059] mx-auto mb-6" />
            <h3 className="font-display text-2xl font-semibold text-[#0A192F] mb-3">Your Inquiry Has Been Received</h3>
            <p className="font-body text-[#0A192F]/60 text-lg">
              The office team will follow up about your request.
            </p>
            <p className="mt-5 text-sm text-[#0A192F]/70">Inquiry reference: {reference}</p>

          </motion.div>
        </div>
      </section>
    )
  }

  return panel(
    <section id="contact" className={popup ? "relative" : "relative bg-[#F1F3F5] py-20 lg:py-28"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={popup ? "block" : "grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start"}>
          <motion.div
            className={popup ? "hidden" : ""}
            initial={{ opacity: 0, x: -30 }}
            animate={popup ? { opacity: 1, x: 0 } : undefined}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[#C5A059] font-body text-sm font-semibold tracking-[0.2em] uppercase mb-3">Get In Touch</p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-[#0A192F] leading-tight mb-6">
              Buy, Sell, or Invest
              <br />in North Houston
            </h2>
            <p className="font-body text-[#0A192F]/60 text-lg leading-relaxed mb-8">
              Tell us about the home you want to buy, the property you plan to sell, or your investment property goals. Our office team will follow up about your request.
            </p>

            <div className="space-y-4">
              {[
                "Personalized home search assistance",
                "Free market analysis for sellers",
                "Investment property purchase guidance",
                "A plan for buying and selling together",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
                  <span className="font-body text-[#0A192F]/70">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={popup ? { opacity: 1, x: 0 } : undefined}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl p-6 md:p-8 space-y-5"
            >
              <p className="text-sm font-semibold text-[#0A192F]" aria-live="polite">Step {step} of 2 · {step === 1 ? "Your contact details" : "Your area of interest"}</p>
              {import.meta.env.VITE_CONTROLLED_INTAKE_PREVIEW === 'true' && <p role="note" className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">Controlled preview test: use the designated test email. Test inquiries appear in the Agent Portal; calls and SMS are disabled.</p>}
              {step === 1 && <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[["firstName", "First name"], ["lastName", "Last name"]].map(([field, label]) => <label key={field} className="block font-body text-sm font-medium text-[#0A192F] mb-1.5">{label} *
                <input
                  required
                  aria-label={label}
                  type="text"
                  autoComplete={field === 'firstName' ? 'given-name' : 'family-name'}
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-[#0A192F]/10 font-body text-sm focus:outline-none focus:border-[#C5A059] transition-colors"
                />
                </label>)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block font-body text-sm font-medium text-[#0A192F] mb-1.5">Phone *</label>
                  <input
                    required
                    aria-label="Phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-[#0A192F]/10 font-body text-sm focus:outline-none focus:border-[#C5A059] transition-colors"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block font-body text-sm font-medium text-[#0A192F] mb-1.5">Email *</label>
                  <input
                    required
                    aria-label="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-[#0A192F]/10 font-body text-sm focus:outline-none focus:border-[#C5A059] transition-colors"
                    placeholder="you@email.com"
                  />
                </div>
              </div>

              </>}
              {step === 2 && <CompactPreferences form={form} update={update} searchInquiry={searchInquiry} onLocation={value=>setForm(current=>({...current,location:value,city:/^\d{5}$/.test(value)?'':value,zip:/^\d{5}$/.test(value)?value:''}))} />}
              <div className="hidden" aria-hidden="true"><input aria-label="Leave this field empty" tabIndex={-1} autoComplete="off" value={form.website_check} onChange={e => update("website_check", e.target.value)} /></div>
              {step === 1 && <label className="flex items-start gap-2 text-xs leading-relaxed text-[#0A192F]/80"><input type="checkbox" checked={form.smsConsentAccepted} onChange={e => update('smsConsentAccepted', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />{SMS_CONSENT_TEXT}</label>}
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={sending || !form.firstName || !form.lastName || !form.email || !form.phone || !form.interested_in}
                className="w-full py-3.5 bg-[#C5A059] text-white font-body font-semibold rounded-lg hover:bg-[#B08A3E] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#C5A059]/20"
              >
                <Send className="w-4 h-4" />
                {sending ? "Saving…" : step === 1 ? "Continue" : "View Matching Homes"}
              </button>
              <p className="text-sm text-[#0A192F]/75 leading-relaxed">* {CONTACT_CONSENT_TEXT} <a href="/privacy" className="underline">Privacy Policy</a> · <a href="/terms" className="underline">Terms</a></p>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
