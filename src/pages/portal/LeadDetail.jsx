import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, Clock, User, FileText, CheckCircle2, XCircle, CalendarClock, Headset, ShieldCheck, ReceiptText, Activity } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import Badge, { stageTone } from "@/components/portal/Badge";
import SectionCard from "@/components/portal/SectionCard";
import { Skeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtDateTime, fmtTime } from "@/lib/portalUtils";
import { derivePortalLifecycle, lifecycleLabel, verificationState } from "@/lib/leadLifecycle";

function Collapsible({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="portal-card">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 focus-ring rounded-t-[14px]" aria-expanded={open}>
        <span className="font-display text-[15px] font-semibold" style={{ color: "var(--shell)" }}>{title}</span>
        <span className="text-[12px] font-medium" style={{ color: "var(--teal)" }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div className="px-4 sm:px-5 pb-5">{children}</div>}
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const { data: lead, loading, error, retry } = usePortalData(() => portalAdapter.getLead(id), [id]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-40" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!lead) return <EmptyState title="Lead not found" description="This lead may have been removed or you may not have access." action={<Link to="/leads" className="text-[13px] font-medium hover:underline" style={{ color: "var(--teal)" }}>Back to leads</Link>} />;

  const lifecycle = derivePortalLifecycle(lead);
  const verification = verificationState(lead);
  const consentRecorded = lead.consentRecorded ?? lead.consent_recorded;
  const handoffEvidence = lead.handoffEvidence || lead.handoff_evidence || null;
  const handoffStatus = lead.handoffStatus || lead.handoff_status || (lead.customerAcceptance === "Accepted" ? "accepted" : lead.handoffType || "Not ready");

  return (
    <div>
      <Link to="/leads" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-4 hover:underline focus-ring rounded" style={{ color: "var(--muted-ink)" }}>
        <ArrowLeft className="w-4 h-4" /> Back to Lead Activity
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-[26px] sm:text-[30px] font-semibold leading-tight" style={{ color: "var(--shell)" }}>{lead.name}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-[12.5px]" style={{ color: "var(--muted-ink)" }}>
            <span>{lead.source} · {lead.campaign}</span>
            <span className="opacity-40">·</span>
            <Badge tone={stageTone(lead.stage)}>{lead.stage}</Badge>
            <span className="opacity-40">·</span>
            <span>{lead.service} · {lead.location}</span>
          </div>
        </div>
        <div className="text-right text-[12px]" style={{ color: "var(--muted-ink)" }}>
          <div>Received {fmtDateTime(lead.received)}</div>
          <div className="mt-0.5">Lead ID {lead.id}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Contact */}
          <SectionCard title="Contact information" subtitle="Subject to your permission settings">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow icon={Phone} label="Phone" value={lead.phone} />
              <InfoRow icon={Mail} label="Email" value={lead.email} />
              <InfoRow icon={MapPin} label="Location" value={lead.location} />
              <InfoRow icon={Clock} label="First response" value={lead.firstResponseMinutes != null ? `${lead.firstResponseMinutes} min` : "Awaiting contact"} />
            </div>
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Conversation timeline" subtitle={`${lead.outreachAttempts} outreach attempt${lead.outreachAttempts !== 1 ? "s" : ""}`}>
            <ol className="relative pl-6">
              <span className="absolute left-2 top-1 bottom-1 w-px" style={{ background: "var(--line)" }} />
              {lead.timeline.map((t, i) => (
                <li key={i} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full border-2" style={{ background: "#fff", borderColor: "var(--teal)" }} />
                  <div className="text-[13px] font-medium" style={{ color: "var(--shell)" }}>{t.event}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{fmtDateTime(t.at)}</div>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="Call activity" subtitle="Calls placed through this campaign's assigned number">
            {lead.calls?.length ? <div className="space-y-2">{lead.calls.map((call) => <div key={call.id} className="rounded-lg border p-3 text-[12.5px]" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
              <div className="flex items-center justify-between gap-3"><span className="font-semibold capitalize" style={{ color: "var(--shell)" }}>{String(call.status || "pending").replace(/_/g, " ")}</span><span style={{ color: "var(--muted-ink)" }}>{fmtDateTime(call.startedAt)}</span></div>
              <div className="mt-1" style={{ color: "var(--ink-2)" }}>Campaign number {call.from || "Pending assignment"} · Recording {String(call.recordingStatus || "not requested").replace(/_/g, " ")}</div>
              {call.recordingUrl && <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-semibold hover:underline" style={{ color: "var(--teal)" }}>Open recording</a>}
            </div>)}</div> : <p className="text-[13px]" style={{ color: "var(--muted-ink)" }}>No calls have been recorded for this lead.</p>}
          </SectionCard>

          <SectionCard title="GMS Qualification Receipt" subtitle="Evidence-backed checkpoints for this opportunity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReceiptRow icon={ShieldCheck} label="Lifecycle stage" value={lifecycleLabel(lifecycle)} />
              <ReceiptRow icon={CheckCircle2} label="Identity / mobile" value={verification.label} good={verification.key === "verified"} />
              <ReceiptRow icon={FileText} label="Consent record" value={consentRecorded === true ? "Recorded" : consentRecorded === false ? "Not recorded" : "Not available"} good={consentRecorded === true} />
              <ReceiptRow icon={CheckCircle2} label="Qualification" value={lead.qualification || "In progress"} good={String(lead.qualification || "").toLowerCase() === "qualified"} />
              <ReceiptRow icon={Headset} label="Handoff" value={String(handoffStatus).replace(/_/g, " ")} good={["accepted","completed"].includes(String(handoffStatus).toLowerCase())} />
              <ReceiptRow icon={User} label="Customer acceptance" value={lead.customerAcceptance || "Pending"} good={lead.customerAcceptance === "Accepted"} />
              <ReceiptRow icon={Activity} label="Intent score" value={lead.intentScore ?? lead.intent_score ?? "Not available"} />
              <ReceiptRow icon={ReceiptText} label="Billing eligibility" value={lead.billingEligible ? "Eligible" : "Not eligible"} good={lead.billingEligible === true} />
            </div>
            {handoffEvidence ? (
              <div className="mt-4 rounded-lg border p-3 text-[12.5px]" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
                <div className="font-semibold mb-2" style={{ color: "var(--shell)" }}>Recorded handoff evidence</div>
                <pre className="whitespace-pre-wrap font-sans leading-5" style={{ color: "var(--ink-2)" }}>{JSON.stringify(handoffEvidence, null, 2)}</pre>
              </div>
            ) : (
              <p className="mt-4 text-[12.5px]" style={{ color: "var(--muted-ink)" }}>No structured handoff-evidence package has been attached yet. Timeline, qualification, transfer, and acceptance records remain visible below.</p>
            )}
          </SectionCard>

          {/* Qualification */}
          <SectionCard title="Qualification answers" subtitle={lead.score != null ? `Qualification score ${lead.score}/100` : "Qualification in progress"}>
            {lead.qualificationAnswers.length ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lead.qualificationAnswers.map((a) => (
                  <div key={a.q} className="p-3 rounded-lg border" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
                    <dt className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{a.q}</dt>
                    <dd className="text-[13.5px] font-semibold mt-0.5" style={{ color: "var(--shell)" }}>{a.a}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-[13px]" style={{ color: "var(--muted-ink)" }}>No qualification answers recorded yet.</p>}
          </SectionCard>

          {/* Appointment / transfer */}
          {(lead.appointment || lead.liveTransfer) && (
            <SectionCard title={lead.appointment ? "Appointment" : "Live transfer"}>
              {lead.appointment && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gold-soft)" }}><CalendarClock className="w-5 h-5" style={{ color: "var(--gold-2)" }} /></div>
                  <div>
                    <div className="text-[13.5px] font-semibold" style={{ color: "var(--shell)" }}>{lead.appointment.type}</div>
                    <div className="text-[12.5px]" style={{ color: "var(--muted-ink)" }}>{fmtDateTime(lead.appointment.when)} · {lead.appointment.salesperson}</div>
                    <div className="mt-1"><Badge tone={lead.appointment.status === "Confirmed" ? "success" : "warn"}>{lead.appointment.status}</Badge></div>
                  </div>
                </div>
              )}
              {lead.liveTransfer && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--teal-soft)" }}><Headset className="w-5 h-5" style={{ color: "var(--teal)" }} /></div>
                  <div>
                    <div className="text-[13.5px] font-semibold" style={{ color: "var(--shell)" }}>Connected to {lead.liveTransfer.recipient}</div>
                    <div className="text-[12.5px]" style={{ color: "var(--muted-ink)" }}>{fmtTime(lead.liveTransfer.connectedAt)} · {Math.round(lead.liveTransfer.durationSec / 60)} min · {lead.liveTransfer.outcome}</div>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Event history */}
          <Collapsible title="Complete event history" defaultOpen={false}>
            <ol className="space-y-2.5">
              {lead.events.map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-[12.5px]">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--teal)" }} />
                  <div><span style={{ color: "var(--shell)" }} className="font-medium">{e.action}</span> <span style={{ color: "var(--muted-ink)" }}>— {e.actor} · {fmtDateTime(e.at)}</span></div>
                </li>
              ))}
            </ol>
          </Collapsible>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <SectionCard title="Outcome">
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Assigned Link rep" value={lead.rep} icon={User} />
              <Row label="Sales-team recipient" value={lead.salesRecipient || "—"} icon={User} />
              <Row label="Customer acceptance" value={lead.customerAcceptance} icon={lead.customerAcceptance === "Accepted" ? CheckCircle2 : lead.customerAcceptance === "Refused" ? XCircle : FileText} />
              <Row label="Final disposition" value={lead.disposition} icon={FileText} />
              <Row label="Billing eligibility" value={lead.billingEligible ? "Eligible" : "Not eligible"} icon={lead.billingEligible ? CheckCircle2 : XCircle} />
              <Row label="Dispute / review" value={lead.disputeStatus} icon={FileText} />
            </dl>
          </SectionCard>

          <SectionCard title="Notes">
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{lead.notes || "No notes recorded."}</p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ icon: Icon, label, value, good = false }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg border" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: good ? "var(--success)" : "var(--teal)" }} />
      <div>
        <div className="text-[11px]" style={{ color: "var(--muted-ink)" }}>{label}</div>
        <div className="text-[13px] font-semibold capitalize" style={{ color: good ? "var(--success)" : "var(--shell)" }}>{String(value ?? "—")}</div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--muted-ink)" }} />
      <div><div className="text-[11px]" style={{ color: "var(--muted-ink)" }}>{label}</div><div className="text-[13px] font-medium" style={{ color: "var(--shell)" }}>{value || "—"}</div></div>
    </div>
  );
}

function Row({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2" style={{ color: "var(--muted-ink)" }}><Icon className="w-4 h-4" /> {label}</span>
      <span className="font-semibold text-right" style={{ color: "var(--shell)" }}>{value}</span>
    </div>
  );
}
