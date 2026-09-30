import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText, CreditCard, Plus, History, ShieldCheck } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { GhostButton, PrimaryButton } from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { CardSkeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import { fmtMoney, fmtDate } from "@/lib/portalUtils";
import BillingReviewDialog from "@/components/portal/BillingReviewDialog";

export default function Billing() {
  const { data, loading, error, retry, setData } = usePortalData(() => portalAdapter.getBilling(), []);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (loading) return <div><PageHeader title="Billing" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return null;

  const downloadInvoice = (inv) => {
    const content = `Invoice ${inv.number}\nPeriod: ${inv.period}\nDate: ${inv.date}\nQualified opportunities: ${inv.qualified}\nAmount: ${fmtMoney(inv.amount)}\nStatus: ${inv.status}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${inv.number}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Billing"
        description={`${data.period} · Per qualified opportunity at ${fmtMoney(data.ratePerQualified)}`}
        actions={<PrimaryButton onClick={() => setReviewOpen(true)}><Plus className="w-4 h-4" /> Request billing review</PrimaryButton>}
      />

      {/* Balance summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="portal-card p-5 lg:col-span-2">
          <div className="eyebrow" style={{ color: "var(--muted-ink)" }}>Current balance</div>
          <div className="mt-2 font-display text-[40px] font-semibold leading-none" style={{ color: "var(--shell)" }}>{fmtMoney(data.balance)}</div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge tone={data.paymentStatus === "Paid" ? "success" : "teal"}>{data.paymentStatus}</Badge>
            <span className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{data.paymentMethod}</span>
            <Badge tone={data.autoPay ? "success" : "neutral"}>{data.autoPay ? "Auto-pay on" : "Auto-pay off"}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
            <div><div style={{ color: "var(--muted-ink)" }}>Billed (qualified)</div><div className="font-semibold mt-0.5" style={{ color: "var(--shell)" }}>{data.billedCount}</div></div>
            <div><div style={{ color: "var(--muted-ink)" }}>Rate / qualified</div><div className="font-semibold mt-0.5" style={{ color: "var(--shell)" }}>{fmtMoney(data.ratePerQualified)}</div></div>
            <div><div style={{ color: "var(--muted-ink)" }}>Credits</div><div className="font-semibold mt-0.5" style={{ color: "var(--success)" }}>{fmtMoney(data.credits)}</div></div>
            <div><div style={{ color: "var(--muted-ink)" }}>Adjustments</div><div className="font-semibold mt-0.5" style={{ color: "var(--danger)" }}>{fmtMoney(data.adjustments)}</div></div>
          </div>
        </div>

        <div className="portal-card p-5">
          <div className="flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4" style={{ color: "var(--gms-navy)" }} /><span className="font-display text-[15px] font-semibold" style={{ color: "var(--shell)" }}>Payment method</span></div>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>{data.paymentMethod}</p>
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted-ink)" }}>Card and bank details are handled by the payment provider. Full card numbers are never collected or stored in the portal.</p>
          <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line-2)" }}>
            <div className="eyebrow mb-1" style={{ color: "var(--muted-ink)" }}>Billing contact</div>
            <div className="text-[13px] font-medium" style={{ color: "var(--shell)" }}>{data.billingContact.name}</div>
            <div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{data.billingContact.email}</div>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="mt-4">
        <SectionCard title="Invoice history" subtitle="Download invoices and receipts">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--line-2)" }}>
                {["Invoice", "Period", "Date", "Qualified", "Amount", "Status", ""].map((h, i) => <th key={h} className={`px-2 py-2 eyebrow font-semibold ${i >= 3 ? "text-right" : ""}`} style={{ color: "var(--muted-ink)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0" style={{ borderColor: "var(--line-2)" }}>
                    <td className="px-2 py-3"><Link to={`/billing/invoices/${inv.id}`} className="font-semibold hover:underline" style={{ color: "var(--shell)" }}>{inv.number}</Link></td>
                    <td className="px-2 py-3">{inv.period}</td>
                    <td className="px-2 py-3 whitespace-nowrap">{fmtDate(inv.date)}</td>
                    <td className="px-2 py-3 text-right">{inv.qualified}</td>
                    <td className="px-2 py-3 text-right font-semibold">{fmtMoney(inv.amount)}</td>
                    <td className="px-2 py-3 text-right"><Badge tone={inv.status === "Paid" ? "success" : "warn"}>{inv.status}</Badge></td>
                    <td className="px-2 py-3 text-right"><button onClick={() => downloadInvoice(inv)} aria-label={`Download ${inv.number}`} className="touch-target w-9 h-9 rounded-lg inline-flex items-center justify-center focus-ring" style={{ color: "var(--gms-navy)" }}><Download className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* Transactions */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Transaction history" subtitle="Payments and credits">
          <ul className="divide-y" style={{ borderColor: "var(--line-2)" }}>
            {data.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <div><div className="text-[13px] font-medium" style={{ color: "var(--shell)" }}>{t.description}</div><div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{fmtDate(t.date)} · {t.method}</div></div>
                <span className="font-semibold text-[13px]" style={{ color: t.amount < 0 ? "var(--success)" : "var(--shell)" }}>{fmtMoney(t.amount)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Billing reviews" subtitle="Disputes and review requests" action={<GhostButton onClick={() => setReviewOpen(true)}><Plus className="w-3.5 h-3.5" /> New</GhostButton>}>
          <ul className="space-y-3">
            {data.reviews.map((r) => (
              <li key={r.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
                <div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-semibold" style={{ color: "var(--shell)" }}>{r.reason}</span><Badge tone={r.status === "Approved" ? "success" : r.status === "Denied" ? "danger" : "warn"}>{r.status}</Badge></div>
                <div className="text-[11.5px] mt-1" style={{ color: "var(--muted-ink)" }}>Invoice {r.invoice} · submitted {fmtDate(r.submitted)} · resolved {fmtDate(r.resolved)}</div>
                {r.status === "Approved" && <div className="text-[12px] mt-1 font-semibold" style={{ color: "var(--success)" }}>Credit {fmtMoney(r.credit)}</div>}
                <p className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>{r.note}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <BillingReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        invoices={data.invoices}
        onSubmit={async (payload) => {
          const res = await portalAdapter.createBillingReview(payload);
          setData((d) => ({ ...d, reviews: [{ id: res.id, invoice: payload.invoice, reason: payload.reason, status: "Submitted", credit: 0, submitted: new Date().toISOString().slice(0, 10), resolved: null, note: payload.note || "Pending review." }, ...d.reviews] }));
        }}
      />
    </div>
  );
}