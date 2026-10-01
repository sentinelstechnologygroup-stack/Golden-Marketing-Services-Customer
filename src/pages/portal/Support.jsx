import { useState } from "react";
import { Plus, MessageSquare, Paperclip, CheckCircle2 } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import { usePortalAuth } from "@/lib/PortalAuthContext";
import PageHeader, { PrimaryButton } from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { CardSkeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtDate, fmtDateTime } from "@/lib/portalUtils";

const TYPES = [
  "Program-change request", "Script-change request", "Qualification-criteria change",
  "Routing or calendar change", "Technical-support request", "Billing question", "Account conversation",
];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

export default function Support() {
  const { session } = usePortalAuth();
  const authorName = session?.user?.name || "You";
  const { data, loading, error, retry, setData } = usePortalData(() => portalAdapter.getSupport(), []);
  const [openNew, setOpenNew] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [reply, setReply] = useState("");

  const requests = data?.requests || [];
  const active = requests.find((r) => r.id === activeId);

  if (loading) return <div><PageHeader title="Support" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;

  return (
    <div>
      <PageHeader
        title="Support"
        description="Request program changes, script updates, routing changes, technical help, and billing questions."
        actions={<PrimaryButton onClick={() => setOpenNew((s) => !s)}><Plus className="w-4 h-4" /> New request</PrimaryButton>}
      />

      {openNew && <NewRequestForm authorName={authorName} onClose={() => setOpenNew(false)} onCreated={(r) => { setData((d) => ({ requests: [r, ...(d?.requests || [])] })); setOpenNew(false); setActiveId(r.id); }} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          {requests.length === 0 ? <div className="portal-card"><EmptyState title="No support requests yet" /></div> : requests.map((r) => (
            <button key={r.id} onClick={() => setActiveId(r.id)} className="portal-card p-4 w-full text-left focus-ring" style={{ borderColor: activeId === r.id ? "var(--teal)" : undefined }}>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={r.status === "Resolved" ? "success" : r.status === "Open" ? "warn" : "neutral"}>{r.status}</Badge>
                <Badge tone={r.priority === "Urgent" || r.priority === "High" ? "danger" : "neutral"}>{r.priority}</Badge>
              </div>
              <div className="mt-2 font-semibold text-[14px]" style={{ color: "var(--shell)" }}>{r.subject}</div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--muted-ink)" }}>{r.type} · {r.assigned}</div>
              <div className="text-[11.5px] mt-1" style={{ color: "var(--muted-ink)" }}>Updated {fmtDate(r.updated)}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {!active ? <div className="portal-card"><EmptyState title="Select a request" description="Choose a request from the left to view its conversation thread and resolution." /></div> : (
            <SectionCard
              title={active.subject}
              subtitle={`${active.type} · ${active.assigned}`}
              action={<Badge tone={active.status === "Resolved" ? "success" : "warn"}>{active.status}</Badge>}
            >
              <ul className="space-y-4">
                {active.thread.map((m, i) => (
                  <li key={i} className={`flex ${m.from === authorName ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%]">
                      <div className="text-[11px] mb-1" style={{ color: "var(--muted-ink)" }}>{m.from} · {fmtDateTime(m.at)}</div>
                      <div className="px-3.5 py-2.5 rounded-2xl text-[13px]" style={{ background: m.from === authorName ? "var(--shell)" : "var(--offwhite)", color: m.from === authorName ? "#fff" : "var(--ink-2)", border: m.from === authorName ? "none" : "1px solid var(--line-2)" }}>{m.body}</div>
                    </div>
                  </li>
                ))}
              </ul>

              {active.resolution && (
                <div className="mt-5 p-3 rounded-lg flex items-start gap-2.5" style={{ background: "rgba(46,125,91,0.08)" }}>
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                  <div><div className="text-[12px] font-semibold" style={{ color: "var(--success)" }}>Resolution</div><div className="text-[13px]" style={{ color: "var(--ink-2)" }}>{active.resolution}</div></div>
                </div>
              )}

              {active.status !== "Resolved" && (
                <form onSubmit={async (e) => { e.preventDefault(); if (!reply.trim()) return; const body = reply.trim(); const result = await portalAdapter.addSupportReply(active.id, body); const msg = result?.message || { at: new Date().toISOString(), from: "Portal user", body }; setData((d) => ({ requests: d.requests.map((r) => r.id === active.id ? { ...r, thread: [...(r.thread || []), msg], updated: new Date().toISOString().slice(0, 10) } : r) })); setReply(""); }} className="mt-5 flex gap-2 items-end">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Reply…" className="flex-1 touch-target rounded-lg px-3 py-2.5 text-[13px] bg-white border focus-ring resize-none" style={{ borderColor: "var(--line)" }} />
                  <button type="submit" className="touch-target px-4 rounded-lg text-[13px] font-semibold text-white focus-ring" style={{ background: "var(--shell)" }}><MessageSquare className="w-4 h-4" /></button>
                </form>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function NewRequestForm({ onClose, onCreated, authorName }) {
  const [type, setType] = useState(TYPES[0]);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!subject || !body) return;
    setSubmitting(true);
    try {
      const res = await portalAdapter.createSupport({ type, subject, priority, body });
      onCreated({ id: res.id, type, subject, priority, status: "Open", assigned: "Queued — GMS team", created: new Date().toISOString().slice(0, 10), updated: new Date().toISOString().slice(0, 10), thread: [{ at: new Date().toISOString(), from: authorName, body }], resolution: null });
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="portal-card p-4 sm:p-5 mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--ink-2)" }}>Type</label><select value={type} onChange={(e) => setType(e.target.value)} className="w-full touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--ink-2)" }}>Priority</label><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--ink-2)" }}>Subject</label><input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} /></div>
      </div>
      <div><label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--ink-2)" }}>Details</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full touch-target rounded-lg px-3 py-2.5 text-[13px] bg-white border focus-ring resize-none" style={{ borderColor: "var(--line)" }} /></div>
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted-ink)" }}><Paperclip className="w-4 h-4" /> Attachments are accepted via the production API.</div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="touch-target px-4 rounded-lg text-[13px] font-medium border bg-white focus-ring" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>Cancel</button>
        <button type="submit" disabled={submitting} className="touch-target px-4 rounded-lg text-[13px] font-semibold text-white focus-ring disabled:opacity-50" style={{ background: "var(--shell)" }}>{submitting ? "Submitting…" : "Submit request"}</button>
      </div>
    </form>
  );
}
