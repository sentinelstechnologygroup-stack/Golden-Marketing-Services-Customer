import { useState } from "react";
import { UserPlus, Mail, RefreshCw, Ban, Building2, Users, History } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { PrimaryButton, GhostButton } from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { Skeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import { fmtDate, fmtDateTime, initials, relativeTime } from "@/lib/portalUtils";

const ROLES = ["Owner", "Administrator", "Manager", "Billing", "Viewer"];

export default function Account() {
  const { data, loading, error, retry, setData } = usePortalData(() => portalAdapter.getAccount(), []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviting, setInviting] = useState(false);

  if (loading) return <div><PageHeader title="Team & Account" /><div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return null;

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await portalAdapter.inviteUser({ email: inviteEmail, role: inviteRole });
      setData((d) => ({ ...d, invitations: [{ id: res.id, email: inviteEmail, role: inviteRole, status: "Pending", sent: new Date().toISOString().slice(0, 10) }, ...d.invitations] }));
      setInviteEmail(""); setInviteOpen(false);
    } finally { setInviting(false); }
  };

  const changeRole = (userId, role) => {
    setData((d) => ({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, role } : u)) }));
  };

  return (
    <div>
      <PageHeader title="Team & Account" description="Business profile, program information, authorized users, and routing contacts." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Business profile" className="lg:col-span-2">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
            <Field label="Legal name" value={data.businessProfile.legalName} />
            <Field label="DBA" value={data.businessProfile.dba} />
            <Field label="Website" value={data.businessProfile.website} />
            <Field label="Phone" value={data.businessProfile.phone} />
            <Field label="Address" value={data.businessProfile.address} className="sm:col-span-2" />
          </dl>
        </SectionCard>
        <SectionCard title="Program information">
          <dl className="space-y-2.5 text-[13px]">
            <Field label="Program" value={data.program.name} />
            <Field label="Status" value={<Badge tone="success">{data.program.status}</Badge>} />
            <Field label="Start date" value={fmtDate(data.program.startDate)} />
            <Field label="Services" value={data.program.services.join(", ")} />
            <Field label="Pricing model" value={`${data.program.pricingModel} · $${data.program.rate}`} />
          </dl>
        </SectionCard>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Account ownership">
          <dl className="space-y-2.5 text-[13px]">
            <Field label="Primary market" value={data.primaryMarket} />
            <Field label="Account owner" value={data.accountOwner} />
            <Field label="Link program manager" value={data.programManager} />
          </dl>
        </SectionCard>
        <SectionCard title="Billing & notification contacts">
          <div className="space-y-3 text-[13px]">
            <div><div className="eyebrow mb-1" style={{ color: "var(--muted-ink)" }}>Billing</div><div style={{ color: "var(--shell)" }}>{data.billingContact.name}</div><div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{data.billingContact.email}</div></div>
            <div className="pt-2 border-t" style={{ borderColor: "var(--line-2)" }}><div className="eyebrow mb-1" style={{ color: "var(--muted-ink)" }}>Notifications</div>
              <ul className="space-y-1">{data.notificationContacts.map((c) => <li key={c.email} className="text-[12.5px]"><span style={{ color: "var(--shell)" }}>{c.name}</span> <span style={{ color: "var(--muted-ink)" }}>· {c.email}</span></li>)}</ul>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Sales-team routing contacts">
          <ul className="space-y-2 text-[13px]">
            {data.salesRoutingContacts.map((c) => <li key={c.email} className="flex items-center gap-2"><Mail className="w-4 h-4" style={{ color: "var(--gms-navy)" }} /><div><div style={{ color: "var(--shell)" }}>{c.name}</div><div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{c.role} · {c.email}</div></div></li>)}
          </ul>
        </SectionCard>
      </div>

      {/* Authorized users */}
      <div className="mt-4">
        <SectionCard
          title="Authorized users"
          subtitle="Deny-by-default permission model. Roles control access across the portal."
          action={<PrimaryButton onClick={() => setInviteOpen((s) => !s)}><UserPlus className="w-4 h-4" /> Invite user</PrimaryButton>}
        >
          {inviteOpen && (
            <form onSubmit={sendInvite} className="mb-4 p-3 rounded-lg border grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
              <button type="submit" disabled={inviting} className="touch-target px-4 rounded-lg text-[13px] font-semibold text-white focus-ring disabled:opacity-50" style={{ background: "var(--shell)" }}>{inviting ? "Sending…" : "Send invite"}</button>
            </form>
          )}

          {data.invitations.length > 0 && (
            <div className="mb-4">
              <div className="eyebrow mb-2" style={{ color: "var(--muted-ink)" }}>Pending invitations</div>
              <ul className="space-y-2">
                {data.invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: "var(--line-2)" }}>
                    <Mail className="w-4 h-4" style={{ color: "var(--warn)" }} />
                    <div className="flex-1 min-w-0"><div className="text-[13px] font-medium" style={{ color: "var(--shell)" }}>{inv.email}</div><div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>Invited as {inv.role} · {fmtDate(inv.sent)}</div></div>
                    <Badge tone="warn">{inv.status}</Badge>
                    <button onClick={() => alert(`Invitation resent to ${inv.email}. (preview)`)} className="touch-target w-9 h-9 rounded-lg flex items-center justify-center focus-ring" style={{ color: "var(--gms-navy)" }}><RefreshCw className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--line-2)" }}>
                {["User", "Role", "Status", "Last active", ""].map((h, i) => <th key={h} className={`px-2 py-2 eyebrow font-semibold ${i === 4 ? "text-right" : ""}`} style={{ color: "var(--muted-ink)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0" style={{ borderColor: "var(--line-2)" }}>
                    <td className="px-2 py-3"><div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ background: "var(--gms-deep)" }}>{initials(u.name)}</span><div><div className="font-semibold" style={{ color: "var(--shell)" }}>{u.name}</div><div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{u.email}</div></div></div></td>
                    <td className="px-2 py-3">
                      <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} disabled={u.role === "Owner"} className="touch-target rounded-lg px-2 text-[12.5px] bg-white border focus-ring disabled:opacity-70" style={{ borderColor: "var(--line)" }}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                    </td>
                    <td className="px-2 py-3"><Badge tone="success">{u.status}</Badge></td>
                    <td className="px-2 py-3 whitespace-nowrap">{relativeTime(u.lastActive)}</td>
                    <td className="px-2 py-3 text-right">{u.role !== "Owner" && <button onClick={() => alert(`Deactivate ${u.name}? (preview)`)} aria-label={`Deactivate ${u.name}`} className="touch-target w-9 h-9 rounded-lg inline-flex items-center justify-center focus-ring" style={{ color: "var(--danger)" }}><Ban className="w-4 h-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Account activity history">
          <ul className="space-y-2.5">
            {data.activity.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px]"><span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--gms-navy)" }} /><div><span style={{ color: "var(--shell)" }} className="font-medium">{a.event}</span><div style={{ color: "var(--muted-ink)" }}>{a.actor} · {fmtDateTime(a.at)}</div></div></li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function Field({ label, value, className = "" }) {
  return <div className={className}><dt className="text-[11px]" style={{ color: "var(--muted-ink)" }}>{label}</dt><dd className="text-[13.5px] font-medium mt-0.5" style={{ color: "var(--shell)" }}>{value || "—"}</dd></div>;
}