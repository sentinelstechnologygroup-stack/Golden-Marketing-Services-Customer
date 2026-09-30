import { useState } from "react";
import { UserPlus, Mail, RefreshCw, Ban, UserRound, Pencil, Save } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { PrimaryButton } from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { Skeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtDate, fmtDateTime, initials, relativeTime } from "@/lib/portalUtils";

const ROLES = [
  { value: "client", label: "Client" },
  { value: "client_supervisor", label: "Client Supervisor" },
  { value: "client_admin", label: "Client Admin" },
];
const ROLE_LABELS = Object.fromEntries(ROLES.map((role) => [role.value, role.label]));
ROLE_LABELS.lms_super_admin = "GMS Super Admin";
ROLE_LABELS.customer = "Client";
ROLE_LABELS.supervisor = "Client Supervisor";
ROLE_LABELS.admin = "Client Admin";

const canonicalRole = (role) => ({
  Owner: "client_admin",
  Administrator: "client_admin",
  Manager: "client_supervisor",
  Viewer: "client",
  customer: "client",
  admin: "client_admin",
  supervisor: "client_supervisor",
  super_admin: "lms_super_admin",
}[role] || role);

export default function Account() {
  const { data, loading, error, retry, setData } = usePortalData(() => portalAdapter.getAccount(), []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("client");
  const [inviting, setInviting] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) return <div><PageHeader title="Team & Account" /><div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return <div><PageHeader title="Team & Account" description="Business profile, organization membership, and account access." /><SectionCard title="Account profile"><EmptyState title="Profile setup is pending" description="Your authenticated identity is active, but the organization profile has not been configured yet." /></SectionCard></div>;
  const currentUser = data.user || data.users?.[0] || {};
  const canManageMembers = data.permissions?.canManageMembers ?? true;
  const canEditBusinessProfile = data.permissions?.canEditBusinessProfile ?? true;

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

  const changeRole = async (userId, role) => {
    await portalAdapter.updateMemberRole(userId, role);
    setData((d) => ({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, role } : u)) }));
  };

  const deactivateUser = async (userId) => {
    await portalAdapter.setMemberStatus(userId, false);
    setData((d) => ({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, status: "Inactive" } : u)) }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = Object.fromEntries(["displayName", "phone", "title", "timezone"].map((key) => [key, form.get(key) || ""]));
    setSaving(true);
    try { await portalAdapter.updateMyProfile(profile); setData((current) => ({ ...current, user: { ...(current.user || {}), ...profile } })); setEditingProfile(false); }
    finally { setSaving(false); }
  };

  const saveBusiness = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const businessProfile = Object.fromEntries(["legalName", "dba", "website", "phone", "address"].map((key) => [key, form.get(key) || ""]));
    setSaving(true);
    try { await portalAdapter.updateBusinessProfile(businessProfile); setData((current) => ({ ...current, businessProfile })); setEditingBusiness(false); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Team & Account" description="Business profile, program information, authorized users, and routing contacts." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <SectionCard title="My profile" className="lg:col-span-2" action={<button onClick={() => setEditingProfile((value) => !value)} className="touch-target inline-flex items-center gap-2 px-3 rounded-lg border bg-white text-[13px] font-medium focus-ring" style={{ borderColor: "var(--line)" }}><Pencil className="w-4 h-4" /> {editingProfile ? "Cancel" : "Edit profile"}</button>}>
          {editingProfile ? <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ProfileInput name="displayName" label="Display name" defaultValue={currentUser.displayName || currentUser.name || ""} required />
            <ProfileInput name="title" label="Job title" defaultValue={currentUser.title || ""} />
            <ProfileInput name="phone" label="Phone" defaultValue={currentUser.phone || ""} />
            <ProfileInput name="timezone" label="Timezone" defaultValue={currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} />
            <button type="submit" disabled={saving} className="touch-target sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 rounded-lg text-[13px] font-semibold text-white focus-ring disabled:opacity-50" style={{ background: "var(--shell)" }}><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save profile"}</button>
          </form> : <div className="flex items-start gap-3"><div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}><UserRound className="w-5 h-5" /></div><dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px] flex-1"><Field label="Name" value={currentUser.displayName || currentUser.name} /><Field label="Email" value={currentUser.email} /><Field label="Role" value={ROLE_LABELS[currentUser.role] || currentUser.role} /><Field label="Timezone" value={currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} /></dl></div>}
        </SectionCard>
        <SectionCard title="Account settings"><dl className="space-y-2.5 text-[13px]"><Field label="Membership" value={currentUser.role ? ROLE_LABELS[currentUser.role] || currentUser.role : "Active"} /><Field label="Language" value={currentUser.locale || "English (US)"} /><Field label="Security" value="Manage on the Security page" /></dl></SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Business profile" className="lg:col-span-2" action={canEditBusinessProfile && <button onClick={() => setEditingBusiness((value) => !value)} className="touch-target inline-flex items-center gap-2 px-3 rounded-lg border bg-white text-[13px] font-medium focus-ring" style={{ borderColor: "var(--line)" }}><Pencil className="w-4 h-4" /> {editingBusiness ? "Cancel" : "Edit"}</button>}>
          {editingBusiness ? <form onSubmit={saveBusiness} className="grid grid-cols-1 sm:grid-cols-2 gap-3"><ProfileInput name="legalName" label="Legal name" defaultValue={data.businessProfile.legalName} required /><ProfileInput name="dba" label="DBA" defaultValue={data.businessProfile.dba} /><ProfileInput name="website" label="Website" defaultValue={data.businessProfile.website} /><ProfileInput name="phone" label="Phone" defaultValue={data.businessProfile.phone} /><ProfileInput name="address" label="Address" defaultValue={data.businessProfile.address} className="sm:col-span-2" /><button type="submit" disabled={saving} className="touch-target sm:col-span-2 inline-flex items-center justify-center gap-2 px-4 rounded-lg text-[13px] font-semibold text-white focus-ring disabled:opacity-50" style={{ background: "var(--shell)" }}><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save business profile"}</button></form> : <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
            <Field label="Legal name" value={data.businessProfile.legalName} />
            <Field label="DBA" value={data.businessProfile.dba} />
            <Field label="Website" value={data.businessProfile.website} />
            <Field label="Phone" value={data.businessProfile.phone} />
            <Field label="Address" value={data.businessProfile.address} className="sm:col-span-2" />
          </dl>}
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
            <Field label="GMS program manager" value={data.programManager} />
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
            {data.salesRoutingContacts.map((c) => <li key={c.email} className="flex items-center gap-2"><Mail className="w-4 h-4" style={{ color: "var(--teal)" }} /><div><div style={{ color: "var(--shell)" }}>{c.name}</div><div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{c.role} · {c.email}</div></div></li>)}
          </ul>
        </SectionCard>
      </div>

      {/* Authorized users */}
      <div className="mt-4">
        <SectionCard
          title="Authorized users"
          subtitle="Deny-by-default permission model. Roles control access across the portal."
          action={canManageMembers && <PrimaryButton onClick={() => setInviteOpen((s) => !s)}><UserPlus className="w-4 h-4" /> Invite user</PrimaryButton>}
        >
          {inviteOpen && (
            <form onSubmit={sendInvite} className="mb-4 p-3 rounded-lg border grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
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
                    <button onClick={() => alert(`Invitation resent to ${inv.email}. (preview)`)} className="touch-target w-9 h-9 rounded-lg flex items-center justify-center focus-ring" style={{ color: "var(--teal)" }}><RefreshCw className="w-4 h-4" /></button>
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
                    <td className="px-2 py-3"><div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0" style={{ background: "var(--teal-2)" }}>{initials(u.name)}</span><div><div className="font-semibold" style={{ color: "var(--shell)" }}>{u.name}</div><div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{u.email}</div></div></div></td>
                    <td className="px-2 py-3">
                      {canManageMembers ? <select value={canonicalRole(u.role)} onChange={(e) => changeRole(u.id, e.target.value)} disabled={u.id === currentUser.uid || u.id === currentUser.id || canonicalRole(u.role) === "lms_super_admin"} className="touch-target rounded-lg px-2 text-[12.5px] bg-white border focus-ring disabled:opacity-70" style={{ borderColor: "var(--line)" }}>{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select> : <span>{ROLE_LABELS[canonicalRole(u.role)] || u.role}</span>}
                    </td>
                    <td className="px-2 py-3"><Badge tone="success">{u.status}</Badge></td>
                    <td className="px-2 py-3 whitespace-nowrap">{relativeTime(u.lastActive)}</td>
                    <td className="px-2 py-3 text-right">{canManageMembers && u.id !== currentUser.uid && u.id !== currentUser.id && canonicalRole(u.role) !== "lms_super_admin" && <button onClick={() => deactivateUser(u.id)} aria-label={`Deactivate ${u.name}`} className="touch-target w-9 h-9 rounded-lg inline-flex items-center justify-center focus-ring" style={{ color: "var(--danger)" }}><Ban className="w-4 h-4" /></button>}</td>
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
              <li key={i} className="flex items-start gap-2.5 text-[12.5px]"><span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--teal)" }} /><div><span style={{ color: "var(--shell)" }} className="font-medium">{a.event}</span><div style={{ color: "var(--muted-ink)" }}>{a.actor} · {fmtDateTime(a.at)}</div></div></li>
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

function ProfileInput({ name, label, defaultValue = "", required = false, className = "" }) {
  return <label className={className}><span className="block text-[11px] mb-1" style={{ color: "var(--muted-ink)" }}>{label}</span><input name={name} defaultValue={defaultValue} required={required} className="w-full touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} /></label>;
}
