import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Clock, CalendarClock, LifeBuoy, TrendingUp } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import { usePortalAuth } from "@/lib/PortalAuthContext";
import PageHeader, { PrimaryButton, LinkButton } from "@/components/portal/PageHeader";
import StatCard from "@/components/portal/StatCard";
import SectionCard from "@/components/portal/SectionCard";
import Badge, { stageTone } from "@/components/portal/Badge";
import { ConversationsAreaChart, SourceBarChart } from "@/components/portal/Charts";
import { CardSkeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtDateTime, fmtTime, relativeTime, pct } from "@/lib/portalUtils";
import { GMS_LIFECYCLE } from "@/lib/leadLifecycle";

export default function Dashboard() {
  const { session } = usePortalAuth();
  const navigate = useNavigate();
  const { data, loading, error, retry } = usePortalData(() => portalAdapter.getDashboard(), []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Overview" description="Loading your program summary…" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return <EmptyState title="No dashboard data available" />;

  const m = data.metrics;
  const maxFunnel = Math.max(...data.funnel.map((f) => f.value));

  return (
    <div>
      <PageHeader
        title={data.greeting}
        description={`${data.programStatus} program · Reporting period ${data.reportingPeriod} · vs. ${data.previousPeriod}`}
        actions={
          <>
            <LinkButton to="/reports"><TrendingUp className="w-4 h-4" /> View full report</LinkButton>
            <PrimaryButton onClick={() => navigate("/support")}><LifeBuoy className="w-4 h-4" /> Request support</PrimaryButton>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Inquiries received" value={m.leadsReceived.value} change={m.leadsReceived.change} />
        <StatCard label="Conversations completed" value={m.conversations.value} change={m.conversations.change} />
        <StatCard label="Qualified opportunities" value={m.qualifiedOpportunities.value} change={m.qualifiedOpportunities.change} />
        <StatCard label="Appointments & transfers" value={m.appointmentsAndTransfers.value} change={m.appointmentsAndTransfers.change} />
        <StatCard label="Contact rate" value={pct(m.contactRate.value)} change={m.contactRate.change} />
        <StatCard label="Qualification rate" value={pct(m.qualificationRate.value)} change={m.qualificationRate.change} />
        <StatCard label="Handoff rate" value={pct(m.handoffRate.value)} change={m.handoffRate.change} />
        <StatCard label="Show rate" value={pct(m.showRate.value)} change={m.showRate.change} />
      </div>

      {/* Response time callout */}
      <div className="mt-4 portal-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--gms-champagne)" }}>
            <Clock className="w-5 h-5" style={{ color: "var(--gms-navy)" }} />
          </div>
          <div>
            <div className="eyebrow" style={{ color: "var(--muted-ink)" }}>Average first response</div>
            <div className="font-display text-[22px] font-semibold" style={{ color: "var(--shell)" }}>
              {m.avgResponseMinutes.value} min
              <span className="ml-2 text-[12px] font-semibold" style={{ color: "var(--success)" }}>
                {m.avgResponseMinutes.change}% faster
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-3 text-center">
          {[
            { label: "Under 5 min", value: data.responseTime.under5, tone: "var(--success)" },
            { label: "5–15 min", value: data.responseTime.fiveTo15, tone: "var(--warn)" },
            { label: "Over 15 min", value: data.responseTime.over15, tone: "var(--danger)" },
          ].map((r) => (
            <div key={r.label}>
              <div className="font-display text-[20px] font-semibold" style={{ color: r.tone }}>{r.value}</div>
              <div className="text-[11px]" style={{ color: "var(--muted-ink)" }}>{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Conversations & qualified opportunities" subtitle="Last 7 days" className="lg:col-span-2">
          <ConversationsAreaChart data={data.sevenDay} />
          <p className="mt-3 text-[12px]" style={{ color: "var(--muted-ink)" }}>
            Conversations rose through the week, with qualified opportunities peaking on Sep 12 (13).
          </p>
        </SectionCard>
        <SectionCard title="Lead sources" subtitle="This period">
          <SourceBarChart data={data.sources} />
        </SectionCard>
      </div>

      {/* Qualification gate */}
      <div className="mt-4">
        <SectionCard title="GMS Qualification Gate" subtitle="The controlled lifecycle behind every documented handoff">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {GMS_LIFECYCLE.map((stage, i) => (
              <div key={stage.key} className="rounded-lg border p-3 min-h-[82px]" style={{ borderColor: "var(--line-2)", background: i >= 4 ? "var(--gold-soft)" : "var(--offwhite)" }}>
                <div className="text-[10px] font-semibold" style={{ color: "var(--muted-ink)" }}>{String(i + 1).padStart(2, "0")}</div>
                <div className="mt-1 text-[12px] font-semibold leading-4" style={{ color: "var(--shell)" }}>{stage.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px]" style={{ color: "var(--muted-ink)" }}>A form submission is an inquiry. Verification, qualification, documented contact, and handoff evidence determine when it advances.</p>
        </SectionCard>
      </div>

      {/* Funnel */}
      <div className="mt-4">
        <SectionCard title="Lead journey" subtitle="From received lead to customer outcome">
          <ol className="space-y-2">
            {data.funnel.map((f, i) => {
              const width = Math.max(8, (f.value / maxFunnel) * 100);
              return (
                <li key={f.stage} className="flex items-center gap-3">
                  <span className="w-6 text-[12px] font-semibold text-right shrink-0" style={{ color: "var(--muted-ink)" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[12.5px] mb-1">
                      <span className="font-medium truncate" style={{ color: "var(--ink-2)" }}>{f.stage}</span>
                      <span className="font-semibold" style={{ color: "var(--shell)" }}>{f.value}</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--line-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${width}%`, background: i >= 4 ? "var(--gold)" : "var(--gms-navy)" }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionCard>
      </div>

      {/* Recent activity + upcoming */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Recent lead activity"
          action={<Link to="/leads" className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline" style={{ color: "var(--gms-navy)" }}>All leads <ArrowRight className="w-3.5 h-3.5" /></Link>}
        >
          <ul className="divide-y" style={{ borderColor: "var(--line-2)" }}>
            {data.recentLeads.map((l) => (
              <li key={l.id}>
                <Link to={`/leads/${l.id}`} className="flex items-center gap-3 py-2.5 hover:bg-[var(--cream)] -mx-2 px-2 rounded-lg focus-ring">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0" style={{ background: "var(--gms-deep)" }}>
                    {l.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold truncate" style={{ color: "var(--shell)" }}>{l.name}</div>
                    <div className="text-[11.5px] truncate" style={{ color: "var(--muted-ink)" }}>{l.source} · {l.campaign} · {l.rep}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge tone={stageTone(l.stage)}>{l.stage}</Badge>
                    <div className="text-[11px] mt-1" style={{ color: "var(--muted-ink)" }}>{relativeTime(l.received)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Upcoming appointments"
          action={<Link to="/appointments" className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline" style={{ color: "var(--gms-navy)" }}>All <ArrowRight className="w-3.5 h-3.5" /></Link>}
        >
          <ul className="space-y-3">
            {data.upcomingAppointments.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
                <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ background: "var(--shell)" }}>
                  <CalendarClock className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--shell)" }}>{a.prospect}</div>
                  <div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{a.type} · {a.salesperson}</div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-2)" }}>{fmtDateTime(a.when)}</div>
                </div>
                <Badge tone={a.status === "Confirmed" ? "success" : "warn"}>{a.status}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Outcome */}
      <div className="mt-4">
        <SectionCard title="Current program outcome" subtitle="Customer sales-team handoff results">
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
