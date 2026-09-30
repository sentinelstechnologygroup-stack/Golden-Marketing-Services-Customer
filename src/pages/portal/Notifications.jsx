import { useState } from "react";
import { Bell, Mail, Smartphone, Globe, LayoutGrid, Lock } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { PrimaryButton } from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { Skeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import { relativeTime } from "@/lib/portalUtils";

const CHANNELS = [
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: Smartphone },
  { key: "browser", label: "Browser", icon: Globe },
  { key: "portal", label: "In-portal", icon: LayoutGrid },
];

const LABELS = {
  newQualifiedOpportunity: "New qualified opportunity",
  appointmentScheduled: "Appointment scheduled",
  appointmentChanged: "Appointment changed",
  liveTransferOutcome: "Live-transfer outcome",
  followUpMilestone: "Follow-up milestone",
  customerActionRequest: "Customer-action request",
  weeklySummary: "Weekly performance summary",
  invoiceIssued: "Invoice issued",
  paymentProcessed: "Payment processed",
  paymentFailed: "Payment failed",
  billingReviewUpdate: "Billing-review update",
  documentUploaded: "Document uploaded",
  supportRequestUpdate: "Support-request update",
  newDeviceSignIn: "New-device sign-in",
  passwordChange: "Password change",
  mfaChange: "MFA change",
  permissionChange: "Permission change",
};

export default function Notifications() {
  const { data, loading, error, retry, setData } = usePortalData(() => portalAdapter.getNotifications(), []);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  if (loading) return <div><PageHeader title="Notifications" /><div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return null;

  const toggle = (eventKey, channelKey) => {
    const cur = data.preferences[eventKey][channelKey];
    setData((d) => ({ ...d, preferences: { ...d.preferences, [eventKey]: { ...d.preferences[eventKey], [channelKey]: !cur } } }));
  };

  const save = async () => {
    setSaving(true);
    try { await portalAdapter.updateNotifications(data.preferences); setSavedAt(Date.now()); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Choose how you’re notified about program events. Security notifications cannot be fully disabled."
        actions={<PrimaryButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save preferences"}</PrimaryButton>}
      />
      {savedAt && <div className="mb-3 text-[12.5px] px-3 py-2 rounded-lg inline-flex items-center gap-2" style={{ background: "rgba(46,125,91,0.10)", color: "var(--success)" }}><Bell className="w-4 h-4" /> Preferences saved.</div>}

      <div className="portal-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
              <th className="px-4 py-3 text-left eyebrow font-semibold" style={{ color: "var(--muted-ink)" }}>Event</th>
              {CHANNELS.map((c) => <th key={c.key} className="px-3 py-3 text-center eyebrow font-semibold" style={{ color: "var(--muted-ink)" }}><c.icon className="w-4 h-4 mx-auto mb-0.5" /><span className="hidden sm:inline">{c.label}</span></th>)}
            </tr></thead>
            <tbody>
              {Object.entries(data.preferences).map(([key, prefs]) => {
                const locked = prefs.locked;
                return (
                  <tr key={key} className="border-b last:border-0" style={{ borderColor: "var(--line-2)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--shell)" }}>{LABELS[key] || key}</div>
                      {locked && <div className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--warn)" }}><Lock className="w-3 h-3" /> Security — required</div>}
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c.key} className="px-3 py-3 text-center">
                        <button
                          onClick={() => !locked && toggle(key, c.key)}
                          disabled={locked}
                          aria-label={`${LABELS[key]} ${c.label}`}
                          className="touch-target w-11 h-6 rounded-full inline-flex items-center px-0.5 transition-colors focus-ring disabled:opacity-60"
                          style={{ background: prefs[c.key] ? "var(--gms-navy)" : "var(--line)", justifyContent: prefs[c.key] ? "flex-end" : "flex-start" }}
                        >
                          <span className="w-5 h-5 rounded-full bg-white shadow" />
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4">
        <SectionCard title="Recent notifications">
          <ul className="divide-y" style={{ borderColor: "var(--line-2)" }}>
            {data.recent.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? "" : ""}`} style={{ background: n.read ? "var(--line)" : "var(--gold)" }} />
                <div className="flex-1 min-w-0"><div className="text-[13px] font-medium" style={{ color: "var(--shell)" }}>{n.title}</div><div className="text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{n.type} · {relativeTime(n.at)}</div></div>
                {!n.read && <Badge tone="gold">New</Badge>}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}