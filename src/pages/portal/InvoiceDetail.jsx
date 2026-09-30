import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { Skeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtMoney, fmtDate } from "@/lib/portalUtils";

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data: inv, loading, error, retry } = usePortalData(() => portalAdapter.getInvoice(id), [id]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-40" /><Skeleton className="h-64 w-full" /></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!inv) return <EmptyState title="Invoice not found" action={<Link to="/billing" className="text-[13px] font-medium hover:underline" style={{ color: "var(--gms-navy)" }}>Back to billing</Link>} />;

  const download = () => {
    const lines = [`Invoice ${inv.number}`, `Period: ${inv.period}`, `Date: ${inv.date}`, `Status: ${inv.status}`, "", "Line items:"];
    inv.lineItems.forEach((l) => lines.push(`${l.leadId} — ${l.prospect} — ${l.outcome} — ${fmtMoney(l.amount)}`));
    lines.push("", `Subtotal: ${fmtMoney(inv.subtotal)}`, `Credits: ${fmtMoney(inv.credits)}`, `Total: ${fmtMoney(inv.total)}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${inv.number}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Link to="/billing" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-4 hover:underline focus-ring rounded" style={{ color: "var(--muted-ink)" }}>
        <ArrowLeft className="w-4 h-4" /> Back to Billing
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-[26px] sm:text-[30px] font-semibold" style={{ color: "var(--shell)" }}>{inv.number}</h1>
          <div className="mt-1 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--muted-ink)" }}>
            <span>{inv.period}</span><span className="opacity-40">·</span><span>{fmtDate(inv.date)}</span><span className="opacity-40">·</span><Badge tone={inv.status === "Paid" ? "success" : "warn"}>{inv.status}</Badge>
          </div>
        </div>
        <button onClick={download} className="touch-target inline-flex items-center gap-2 px-4 rounded-lg text-[13px] font-semibold text-white focus-ring" style={{ background: "var(--shell)" }}><Download className="w-4 h-4" /> Download invoice</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionCard title="Charges linked to qualified outcomes" subtitle={`${inv.qualified} qualified opportunities at ${fmtMoney(inv.ratePerQualified)}`}>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-[13px]">
                <thead><tr className="text-left border-b" style={{ borderColor: "var(--line-2)" }}>
                  {["Lead", "Prospect", "Outcome", "Amount"].map((h, i) => <th key={h} className={`px-2 py-2 eyebrow font-semibold ${i === 3 ? "text-right" : ""}`} style={{ color: "var(--muted-ink)" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {inv.lineItems.map((l) => (
                    <tr key={l.leadId} className="border-b last:border-0" style={{ borderColor: "var(--line-2)" }}>
                      <td className="px-2 py-3"><Link to={`/leads/${l.leadId}`} className="font-semibold hover:underline" style={{ color: "var(--shell)" }}>{l.leadId}</Link></td>
                      <td className="px-2 py-3">{l.prospect}</td>
                      <td className="px-2 py-3">{l.outcome}</td>
                      <td className="px-2 py-3 text-right font-semibold">{fmtMoney(l.amount)}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={3} className="px-2 py-3 text-right text-[12px]" style={{ color: "var(--muted-ink)" }}>+ {inv.qualified - inv.lineItems.length} more qualified outcomes</td><td className="px-2 py-3 text-right font-semibold">{fmtMoney((inv.qualified - inv.lineItems.length) * inv.ratePerQualified)}</td></tr>
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
        <SectionCard title="Summary">
          <dl className="space-y-2.5 text-[13.5px]">
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Subtotal</dt><dd className="font-semibold" style={{ color: "var(--shell)" }}>{fmtMoney(inv.subtotal)}</dd></div>
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Credits</dt><dd className="font-semibold" style={{ color: "var(--success)" }}>{fmtMoney(inv.credits)}</dd></div>
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Adjustments</dt><dd className="font-semibold">{fmtMoney(inv.adjustments)}</dd></div>
            <div className="flex justify-between pt-2 border-t text-[16px]" style={{ borderColor: "var(--line-2)" }}><dt className="font-semibold" style={{ color: "var(--shell)" }}>Total</dt><dd className="font-display font-semibold" style={{ color: "var(--shell)" }}>{fmtMoney(inv.total)}</dd></div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}