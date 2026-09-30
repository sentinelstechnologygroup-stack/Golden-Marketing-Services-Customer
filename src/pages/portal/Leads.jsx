import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Download, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { GhostButton, PrimaryButton } from "@/components/portal/PageHeader";
import Badge, { stageTone } from "@/components/portal/Badge";
import { TableSkeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtDateTime, relativeTime } from "@/lib/portalUtils";
import { derivePortalLifecycle, lifecycleLabel, verificationState } from "@/lib/leadLifecycle";

const PAGE_SIZE = 8;

const FILTERS = [
  { key: "source", label: "Source", options: ["all", "Google LSAs", "Website form", "Angi", "Referral", "Outbound callback"] },
  { key: "stage", label: "Stage", options: ["all", "Lead received", "Conversation", "Qualified", "Appointment set", "Live transfer", "Handed off", "No contact", "Disqualified"] },
  { key: "qualification", label: "Qualification", options: ["all", "Qualified", "In progress", "Not qualified", "Disqualified"] },
  { key: "handoff", label: "Handoff", options: ["all", "Appointment", "Live transfer", "None"] },
  { key: "disposition", label: "Disposition", options: ["all", "Open", "Closed"] },
];

export default function Leads() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ source: "all", stage: "all", qualification: "all", handoff: "all", disposition: "all" });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("received-desc");

  const params = useMemo(() => ({ search, ...filters }), [search, filters]);
  const { data, loading, error, retry } = usePortalData(() => portalAdapter.getLeads(params), [params]);

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    const sorted = [...data.rows];
    sorted.sort((a, b) => {
      if (sort === "received-desc") return new Date(b.received) - new Date(a.received);
      if (sort === "received-asc") return new Date(a.received) - new Date(b.received);
      if (sort === "score-desc") return (b.score || 0) - (a.score || 0);
      if (sort === "response-asc") return (a.firstResponseMinutes ?? 999) - (b.firstResponseMinutes ?? 999);
      return 0;
    });
    return sorted;
  }, [data, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const header = ["id", "name", "source", "campaign", "service", "location", "stage", "qualification", "score", "handoffType", "disposition", "received", "firstResponseMinutes", "rep", "billingEligible"];
    const lines = [header.join(",")];
    rows.forEach((r) => lines.push(header.map((h) => JSON.stringify(r[h] ?? "")).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "northstar-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Lead Activity"
        description="Every opportunity from inquiry through verification, qualification, handoff, acceptance, and client outcome."
        actions={<>
          <GhostButton onClick={exportCsv}><Download className="w-4 h-4" /> Export CSV</GhostButton>
          <PrimaryButton onClick={() => setShowFilters((s) => !s)}><SlidersHorizontal className="w-4 h-4" /> Filters</PrimaryButton>
        </>}
      />

      {/* Search + filters */}
      <div className="portal-card p-3 sm:p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-ink)" }} />
          <input
            type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search prospect, campaign, location…"
            className="w-full touch-target rounded-lg pl-10 pr-3 text-[14px] bg-white border focus-ring"
            style={{ borderColor: "var(--line)" }}
          />
        </div>
        {showFilters && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {FILTERS.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: "var(--muted-ink)" }}>{f.label}</label>
                <select
                  value={filters[f.key]} onChange={(e) => { setFilters((s) => ({ ...s, [f.key]: e.target.value })); setPage(1); }}
                  className="w-full touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring"
                  style={{ borderColor: "var(--line)" }}
                >
                  {f.options.map((o) => <option key={o} value={o}>{o === "all" ? `All ${f.label.toLowerCase()}` : o}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 flex-wrap text-[12px]" style={{ color: "var(--muted-ink)" }}>
          <span>Sort:</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="touch-target rounded-lg px-2.5 text-[12.5px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>
            <option value="received-desc">Newest first</option>
            <option value="received-asc">Oldest first</option>
            <option value="score-desc">Highest score</option>
            <option value="response-asc">Fastest response</option>
          </select>
          <span className="ml-auto">{rows.length} lead{rows.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {loading ? <div className="portal-card"><TableSkeleton rows={6} cols={6} /></div> :
       error ? <ErrorState error={error} onRetry={retry} /> :
       rows.length === 0 ? <div className="portal-card"><EmptyState title="No leads match these filters" description="Try widening your search or clearing filters." /></div> :
       (
        <>
          {/* Desktop table */}
          <div className="portal-card overflow-hidden hidden lg:block">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
                    {["Prospect", "Source / Campaign", "Received", "Response", "Stage", "Qualification", "Handoff", "Rep", ""].map((h) => (
                      <th key={h} className="px-4 py-3 eyebrow font-semibold" style={{ color: "var(--muted-ink)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((l) => {
                    const lifecycle = derivePortalLifecycle(l);
                    const verification = verificationState(l);
                    return (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-[var(--cream)]" style={{ borderColor: "var(--line-2)" }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: "var(--shell)" }}>{l.name}</div>
                        <div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{l.location}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{l.source}</div>
                        <div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{l.campaign}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(l.received)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{l.firstResponseMinutes != null ? `${l.firstResponseMinutes} min` : "—"}</td>
                      <td className="px-4 py-3"><Badge tone={stageTone(lifecycleLabel(lifecycle))}>{lifecycleLabel(lifecycle)}</Badge></td>
                      <td className="px-4 py-3">
                        <div>{l.qualification}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: verification.key === "verified" ? "var(--success)" : "var(--muted-ink)" }}>{verification.label}</div>
                      </td>
                      <td className="px-4 py-3">{l.handoffType || "—"}</td>
                      <td className="px-4 py-3">{l.rep}</td>
                      <td className="px-4 py-3"><Link to={`/leads/${l.id}`} className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline" style={{ color: "var(--gms-navy)" }}>View <ArrowRight className="w-3.5 h-3.5" /></Link></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {pageRows.map((l) => {
              const lifecycle = derivePortalLifecycle(l);
              const verification = verificationState(l);
              return (
              <Link key={l.id} to={`/leads/${l.id}`} className="portal-card p-4 block focus-ring">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-[16px] font-semibold" style={{ color: "var(--shell)" }}>{l.name}</div>
                    <div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{l.source} · {l.campaign}</div>
                  </div>
                  <Badge tone={stageTone(lifecycleLabel(lifecycle))}>{lifecycleLabel(lifecycle)}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                  <div><dt className="inline" style={{ color: "var(--muted-ink)" }}>Received: </dt><dd className="inline" style={{ color: "var(--ink-2)" }}>{relativeTime(l.received)}</dd></div>
                  <div><dt className="inline" style={{ color: "var(--muted-ink)" }}>Response: </dt><dd className="inline" style={{ color: "var(--ink-2)" }}>{l.firstResponseMinutes != null ? `${l.firstResponseMinutes} min` : "—"}</dd></div>
                  <div><dt className="inline" style={{ color: "var(--muted-ink)" }}>Qualification: </dt><dd className="inline" style={{ color: "var(--ink-2)" }}>{l.qualification}</dd></div>
                  <div><dt className="inline" style={{ color: "var(--muted-ink)" }}>Verification: </dt><dd className="inline" style={{ color: verification.key === "verified" ? "var(--success)" : "var(--ink-2)" }}>{verification.label}</dd></div>
                  <div><dt className="inline" style={{ color: "var(--muted-ink)" }}>Rep: </dt><dd className="inline" style={{ color: "var(--ink-2)" }}>{l.rep}</dd></div>
                </dl>
              </Link>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[12px]" style={{ color: "var(--muted-ink)" }}>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="touch-target inline-flex items-center gap-1 px-3 rounded-lg text-[12.5px] font-medium border bg-white disabled:opacity-40 focus-ring" style={{ borderColor: "var(--line)" }}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="touch-target inline-flex items-center gap-1 px-3 rounded-lg text-[12.5px] font-medium border bg-white disabled:opacity-40 focus-ring" style={{ borderColor: "var(--line)" }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}