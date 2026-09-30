import { useEffect, useState } from "react";
import { X, ShieldCheck } from "lucide-react";

const REASONS = [
  "Disputed qualified lead",
  "Duplicate lead",
  "Lead not in service area",
  "Lead did not meet qualification criteria",
  "Billing calculation error",
  "Other",
];

export default function BillingReviewDialog({ open, onClose, invoices = [], onSubmit }) {
  const [invoice, setInvoice] = useState(invoices[0]?.number || "");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open) { setInvoice(invoices[0]?.number || ""); setReason(REASONS[0]); setNote(""); setErr(null); }
  }, [open, invoices]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!invoice || !reason) { setErr("Select an invoice and a reason."); return; }
    setSubmitting(true);
    try {
      await onSubmit({ invoice, reason, note });
      onClose();
    } catch (error) {
      setErr(error?.message || "Unable to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Request billing review">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg portal-card rounded-b-none sm:rounded-[14px] max-h-[92vh] overflow-y-auto safe-b">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--line-2)" }}>
          <h2 className="font-display text-[18px] font-semibold" style={{ color: "var(--shell)" }}>Request billing review</h2>
          <button onClick={onClose} aria-label="Close" className="touch-target w-9 h-9 rounded-lg flex items-center justify-center focus-ring" style={{ color: "var(--muted-ink)" }}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>Invoice</label>
            <select value={invoice} onChange={(e) => setInvoice(e.target.value)} className="w-full touch-target rounded-lg px-3 text-[14px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>
              {invoices.map((i) => <option key={i.id} value={i.number}>{i.number} — {i.period}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>Reason for review</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full touch-target rounded-lg px-3 text-[14px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>Supporting note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="w-full touch-target rounded-lg px-3 py-2.5 text-[14px] bg-white border focus-ring resize-none" style={{ borderColor: "var(--line)" }} placeholder="Add context for the review team…" />
          </div>
          <div className="text-[11.5px] flex items-start gap-2 p-3 rounded-lg" style={{ background: "var(--gms-champagne)", color: "var(--ink-2)" }}>
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--gms-navy)" }} />
            Reviews must be submitted within 30 days of the invoice date. Approved credits apply to your next invoice. Review history is immutable.
          </div>
          {err && <div role="alert" className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "rgba(180,69,47,0.08)", color: "var(--danger)" }}>{err}</div>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="touch-target px-4 rounded-lg text-[13px] font-medium border bg-white focus-ring" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>Cancel</button>
            <button type="submit" disabled={submitting} className="touch-target px-4 rounded-lg text-[13px] font-semibold text-white focus-ring disabled:opacity-50" style={{ background: "var(--shell)" }}>{submitting ? "Submitting…" : "Submit review"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}