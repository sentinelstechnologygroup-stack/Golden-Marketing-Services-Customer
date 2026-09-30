import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, List, CalendarPlus, Check, X, Clock, RefreshCw } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { GhostButton } from "@/components/portal/PageHeader";
import Badge from "@/components/portal/Badge";
import SectionCard from "@/components/portal/SectionCard";
import { CardSkeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtDateTime, fmtTime } from "@/lib/portalUtils";

function toneFor(a) {
  if (a.cancellation) return "danger";
  if (a.attendance === "Show") return "success";
  if (a.attendance === "No-show") return "warn";
  if (a.confirmation === "Confirmed") return "success";
  return "warn";
}

export default function Appointments() {
  const [view, setView] = useState("list");
  const { data, loading, error, retry } = usePortalData(() => portalAdapter.getAppointments(), []);

  const upcoming = useMemo(() => (data || []).filter((a) => a.attendance === "Upcoming"), [data]);
  const past = useMemo(() => (data || []).filter((a) => a.attendance !== "Upcoming"), [data]);

  if (loading) return <div><PageHeader title="Appointments" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="Appointments & Handoffs"
        description="Scheduled estimates, live transfers, attendance, and customer acceptance."
        actions={
          <>
            <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)" }}>
              <button onClick={() => setView("list")} className="touch-target inline-flex items-center gap-1.5 px-3 rounded-md text-[12.5px] font-medium focus-ring" style={{ background: view === "list" ? "var(--shell)" : "transparent", color: view === "list" ? "#fff" : "var(--ink-2)" }}><List className="w-4 h-4" /> List</button>
              <button onClick={() => setView("calendar")} className="touch-target inline-flex items-center gap-1.5 px-3 rounded-md text-[12.5px] font-medium focus-ring" style={{ background: view === "calendar" ? "var(--shell)" : "transparent", color: view === "calendar" ? "#fff" : "var(--ink-2)" }}><CalendarDays className="w-4 h-4" /> Calendar</button>
            </div>
            <GhostButton onClick={() => alert("Calendar integrations are adapter-ready placeholders. No integration is connected yet.")}><CalendarPlus className="w-4 h-4" /> Connect calendar</GhostButton>
          </>
        }
      />

      {view === "calendar" ? <CalendarView appointments={data} /> : (
        <div className="space-y-6">
          <SectionCard title="Upcoming" subtitle={`${upcoming.length} scheduled`}>
            {upcoming.length === 0 ? <EmptyState title="No upcoming appointments" /> : (
              <ul className="space-y-3">
                {upcoming.map((a) => <AppointmentCard key={a.id} a={a} />)}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent" subtitle={`${past.length} completed`}>
            {past.length === 0 ? <EmptyState title="No past appointments" /> : (
              <ul className="space-y-3">
                {past.map((a) => <AppointmentCard key={a.id} a={a} />)}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function AppointmentCard({ a }) {
  return (
    <li className="p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 text-white" style={{ background: "var(--shell)" }}>
          <span className="text-[10px] uppercase tracking-wide opacity-80">{new Date(a.when).toLocaleDateString("en-US", { month: "short" })}</span>
          <span className="font-display text-[16px] font-semibold leading-none">{new Date(a.when).getDate()}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/leads/${a.leadId}`} className="font-semibold text-[14px] hover:underline" style={{ color: "var(--shell)" }}>{a.prospect}</Link>
            <Badge tone={toneFor(a)}>{a.attendance === "Upcoming" ? a.confirmation : a.attendance}</Badge>
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: "var(--muted-ink)" }}>{a.type} · {fmtTime(a.when)} · {a.salesperson}</div>
          {a.followUp && <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-2)" }}>Follow-up: {a.followUp}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11.5px] sm:text-right">
        {a.liveTransfer && <Badge tone="teal">Live transfer</Badge>}
        {a.reschedule !== "None" && <Badge tone="warn"><RefreshCw className="w-3 h-3" /> {a.reschedule}</Badge>}
        {a.cancellation && <Badge tone="danger"><X className="w-3 h-3" /> {a.cancellation}</Badge>}
        <Badge tone={a.acceptance === "Accepted" ? "success" : a.acceptance === "Refused" ? "danger" : "neutral"}>{a.acceptance}</Badge>
      </div>
    </li>
  );
}

function CalendarView({ appointments }) {
  const days = useMemo(() => {
    const map = {};
    appointments.forEach((a) => { const d = new Date(a.when).toDateString(); (map[d] ||= []).push(a); });
    return map;
  }, [appointments]);
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - today.getDay());
  const week = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });

  return (
    <div className="portal-card p-3 sm:p-4">
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        {week.map((d) => {
          const items = days[d.toDateString()] || [];
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={d.toISOString()} className="min-h-[96px] p-2 rounded-lg border" style={{ borderColor: isToday ? "var(--gms-navy)" : "var(--line-2)", background: isToday ? "var(--gms-champagne)" : "#fff" }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: isToday ? "var(--gms-deep)" : "var(--muted-ink)" }}>
                {d.toLocaleDateString("en-US", { weekday: "short" })} {d.getDate()}
              </div>
              <div className="space-y-1">
                {items.map((a) => (
                  <Link key={a.id} to={`/leads/${a.leadId}`} className="block text-[10.5px] px-1.5 py-1 rounded truncate hover:underline" style={{ background: "var(--shell)", color: "#fff" }} title={`${a.prospect} · ${fmtTime(a.when)}`}>
                    {fmtTime(a.when)} {a.prospect}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted-ink)" }}>Two-week view. Calendar integrations are adapter-ready placeholders — no integration is currently connected.</p>
    </div>
  );
}