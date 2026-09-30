import { useState } from "react";
import { Download, FileText } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { GhostButton } from "@/components/portal/PageHeader";
import StatCard from "@/components/portal/StatCard";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { TrendChart } from "@/components/portal/Charts";
import { CardSkeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import { pct } from "@/lib/portalUtils";

export default function Reports() {
  const [range, setRange] = useState("current");
  const [compare, setCompare] = useState("previous");
  const { data, loading, error, retry } = usePortalData(() => portalAdapter.getReports({ range }), [range]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value", "Change %"],
      ["Lead volume", data.metrics.leadVolume.value, data.metrics.leadVolume.change],
      ["Contact rate", data.metrics.contactRate.value, data.metrics.contactRate.change],
      ["Qualification rate", data.metrics.qualificationRate.value, data.metrics.qualificationRate.change],
      ["Appointment rate", data.metrics.appointmentRate.value, data.metrics.appointmentRate.change],
      ["Live-transfer rate", data.metrics.liveTransferRate.value, data.metrics.liveTransferRate.change],
      ["Acceptance rate", data.metrics.acceptanceRate.value, data.metrics.acceptanceRate.change],
      ["Show rate", data.metrics.showRate.value, data.metrics.showRate.change],
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "northstar-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => window.print();

  if (loading) return <div><PageHeader title="Reports" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return null;
  const m = data.metrics;

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Performance for ${data.range} compared with ${data.comparison}.`}
        actions={
          <>
            <select value={range} onChange={(e) => setRange(e.target.value)} className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>
              <option value="current">Current period</option>
              <option value="previous">Previous period</option>
              <option value="qtd">Quarter to date</option>
              <option value="ytd">Year to date</option>
            </select>
            <select value={compare} onChange={(e) => setCompare(e.target.value)} className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>
              <option value="previous">vs. Previous period</option>
              <option value="yoy">vs. Last year</option>
            </select>
            <GhostButton onClick={exportCsv}><Download className="w-4 h-4" /> CSV</GhostButton>
            <GhostButton onClick={exportPdf}><FileText className="w-4 h-4" /> PDF</GhostButton>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Lead volume" value={m.leadVolume.value} change={m.leadVolume.change} />
        <StatCard label="Contact rate" value={pct(m.contactRate.value)} change={m.contactRate.change} />
        <StatCard label="Qualification rate" value={pct(m.qualificationRate.value)} change={m.qualificationRate.change} />
        <StatCard label="Appointment rate" value={pct(m.appointmentRate.value)} change={m.appointmentRate.change} />
        <StatCard label="Live-transfer rate" value={pct(m.liveTransferRate.value)} change={m.liveTransferRate.change} />
        <StatCard label="Acceptance rate" value={pct(m.acceptanceRate.value)} change={m.acceptanceRate.change} />
        <StatCard label="Show rate" value={pct(m.showRate.value)} change={m.showRate.change} />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Lead volume & qualification trend" className="lg:col-span-2">
          <TrendChart data={data.trend} />
        </SectionCard>
        <SectionCard title="Response-time distribution">
          <div className="space-y-3">
            {[
              { label: "Under 5 min", value: data.responseDistribution.under5, tone: "var(--success)" },
              { label: "5–15 min", value: data.responseDistribution.fiveTo15, tone: "var(--warn)" },
              { label: "Over 15 min", value: data.responseDistribution.over15, tone: "var(--danger)" },
            ].map((r) => {
              const total = data.responseDistribution.under5 + data.responseDistribution.fiveTo15 + data.responseDistribution.over15;
              const w = total ? (r.value / total) * 100 : 0;
              return (
                <div key={r.label}>
                  <div className="flex justify-between text-[12.5px] mb-1"><span style={{ color: "var(--ink-2)" }}>{r.label}</span><span className="font-semibold" style={{ color: "var(--shell)" }}>{r.value}</span></div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--line-2)" }}><div className="h-full rounded-full" style={{ width: `${w}%`, background: r.tone }} /></div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerformanceTable title="Lead-source performance" rows={data.sourcePerformance.map((s) => ({ name: s.source, a: s.leads, b: s.qualified, c: `${s.rate}%` }))} headers={["Source", "Leads", "Qualified", "Rate"]} />
        <PerformanceTable title="Campaign performance" rows={data.campaignPerformance.map((s) => ({ name: s.campaign, a: s.leads, b: s.qualified, c: s.appointments }))} headers={["Campaign", "Leads", "Qualified", "Appts"]} />
        <PerformanceTable title="Service performance" rows={data.servicePerformance.map((s) => ({ name: s.service, a: s.leads, b: s.qualified, c: `${s.rate}%` }))} headers={["Service", "Leads", "Qualified", "Rate"]} />
        <PerformanceTable title="Representative performance" rows={data.repPerformance.map((s) => ({ name: s.rep, a: s.leads, b: s.qualified, c: `${s.rate}%` }))} headers={["Representative", "Leads", "Qualified", "Rate"]} />
      </div>

      <div className="mt-4">
        <SectionCard title="Customer outcome reporting">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Accepted", value: data.outcome.accepted, tone: "var(--success)" },
              { label: "Refused", value: data.outcome.refused, tone: "var(--danger)" },
              { label: "Pending", value: data.outcome.pending, tone: "var(--warn)" },
              { label: "Closed-won", value: data.outcome.closedWon, tone: "var(--gms-navy)" },
              { label: "Closed-lost", value: data.outcome.closedLost, tone: "var(--muted-ink)" },
              { label: "In progress", value: data.outcome.inProgress, tone: "var(--gold-2)" },
            ].map((o) => (
              <div key={o.label} className="p-3 rounded-lg border text-center" style={{ borderColor: "var(--line-2)" }}>
                <div className="font-display text-[24px] font-semibold" style={{ color: o.tone }}>{o.value}</div>
                <div className="text-[11px]" style={{ color: "var(--muted-ink)" }}>{o.label}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PerformanceTable({ title, rows, headers }) {
  return (
    <SectionCard title={title}>
      <div className="overflow-x-auto scrollbar-thin -mx-1">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left border-b" style={{ borderColor: "var(--line-2)" }}>{headers.map((h, i) => <th key={h} className={`px-2 py-2 eyebrow font-semibold ${i === 0 ? "text-left" : "text-right"}`} style={{ color: "var(--muted-ink)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b last:border-0" style={{ borderColor: "var(--line-2)" }}>
                <td className="px-2 py-2.5 font-medium" style={{ color: "var(--shell)" }}>{r.name}</td>
                <td className="px-2 py-2.5 text-right">{r.a}</td>
                <td className="px-2 py-2.5 text-right">{r.b}</td>
                <td className="px-2 py-2.5 text-right font-semibold" style={{ color: "var(--gms-deep)" }}>{r.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}