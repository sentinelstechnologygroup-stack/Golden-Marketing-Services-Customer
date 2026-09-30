import { useState } from "react";
import { ShieldCheck, Smartphone, KeyRound, Monitor, LogOut, Eye, EyeOff, AlertTriangle, RefreshCw, Clock, Plus } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { PrimaryButton, GhostButton } from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { Skeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import { fmtDateTime, relativeTime } from "@/lib/portalUtils";

export default function Security() {
  const { data, loading, error, retry } = usePortalData(() => portalAdapter.getSecurity(), []);
  const [showCodes, setShowCodes] = useState(false);

  if (loading) return <div><PageHeader title="Security" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div></div>;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (!data) return null;

  const scoreTone = data.securityScore >= 80 ? "var(--success)" : data.securityScore >= 60 ? "var(--warn)" : "var(--danger)";

  return (
    <div>
      <PageHeader title="Security" description="Manage authentication, sessions, devices, and security events. Sensitive changes require recent authentication or MFA step-up." />

      {/* Security score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="portal-card p-5 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line-2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={scoreTone} strokeWidth="3" strokeDasharray={`${(data.securityScore / 100) * 97.4} 97.4`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-display text-[18px] font-semibold" style={{ color: "var(--shell)" }}>{data.securityScore}</div>
          </div>
          <div><div className="eyebrow" style={{ color: "var(--muted-ink)" }}>Security score</div><div className="text-[13px] mt-1" style={{ color: "var(--ink-2)" }}>{data.mfaEnabled ? "MFA enabled · " : ""}{data.sessions.length} active sessions</div></div>
        </div>
        <div className="portal-card p-5 lg:col-span-2 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: "var(--gms-navy)" }} />
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>Idle-session timeout is set to <strong>{data.idleTimeoutMinutes} minutes</strong>. Sessions expire automatically and rotate on privilege changes.</p>
          <GhostButton className="ml-auto" onClick={() => alert("Step-up authentication required for this change. (preview)")}>Change timeout</GhostButton>
        </div>
      </div>

      {/* MFA */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Multi-factor authentication" action={<Badge tone={data.mfaEnabled ? "success" : "danger"}>{data.mfaEnabled ? "Enabled" : "Disabled"}</Badge>}>
          <ul className="space-y-3">
            {data.mfaMethods.map((m) => {
              const Icon = m.type === "Authenticator app" ? Smartphone : KeyRound;
              return (
                <li key={m.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--line-2)" }}>
                  <Icon className="w-5 h-5" style={{ color: "var(--gms-navy)" }} />
                  <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold" style={{ color: "var(--shell)" }}>{m.type}</div><div className="text-[12px] truncate" style={{ color: "var(--muted-ink)" }}>{m.name} · added {m.added}</div></div>
                  {m.primary && <Badge tone="teal">Primary</Badge>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex gap-2"><GhostButton onClick={() => alert("MFA step-up required. (preview)")}><Plus className="w-4 h-4" /> Add method</GhostButton><GhostButton onClick={() => alert("MFA step-up required. (preview)")}>Manage</GhostButton></div>
        </SectionCard>

        <SectionCard title="Recovery codes" subtitle="Store these securely. Each code is single-use.">
          <div className="grid grid-cols-2 gap-2">
            {data.recoveryCodes.map((c, i) => (
              <div key={i} className="font-mono text-[13px] px-3 py-2 rounded-lg text-center" style={{ background: "var(--shell)", color: showCodes ? "#fff" : "transparent", letterSpacing: "0.1em" }}>{showCodes ? c : "••••••"}</div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <GhostButton onClick={() => setShowCodes((s) => !s)}>{showCodes ? <><EyeOff className="w-4 h-4" /> Hide</> : <><Eye className="w-4 h-4" /> Reveal</>}</GhostButton>
            <GhostButton onClick={() => alert("Regenerating codes requires MFA step-up. (preview)")}><RefreshCw className="w-4 h-4" /> Regenerate</GhostButton>
          </div>
        </SectionCard>
      </div>

      {/* Sessions */}
      <div className="mt-4">
        <SectionCard title="Active sessions & trusted devices" action={<PrimaryButton onClick={() => alert("Sign out of all devices. (preview)")}><LogOut className="w-4 h-4" /> Sign out all</PrimaryButton>}>
          <ul className="space-y-3">
            {data.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: "var(--line-2)" }}>
                <Monitor className="w-5 h-5 shrink-0" style={{ color: "var(--ink-2)" }} />
                <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--shell)" }}>{s.device}{s.current && <Badge tone="teal">This device</Badge>}{s.trusted && <Badge tone="neutral">Trusted</Badge>}</div><div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{s.location} · active {relativeTime(s.lastActive)}</div></div>
                {!s.current && <button onClick={() => alert("Session revoked. (preview)")} className="touch-target px-3 rounded-lg text-[12px] font-medium border focus-ring" style={{ borderColor: "var(--line)", color: "var(--danger)" }}>Revoke</button>}
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line-2)" }}>
            <div className="eyebrow mb-2" style={{ color: "var(--muted-ink)" }}>Trusted devices</div>
            <ul className="space-y-2 text-[12.5px]">
              {data.trustedDevices.map((t) => <li key={t.id} className="flex justify-between"><span style={{ color: "var(--ink-2)" }}>{t.name}</span><span style={{ color: "var(--muted-ink)" }}>expires {t.expires}</span></li>)}
            </ul>
          </div>
        </SectionCard>
      </div>

      {/* Sign-in activity + events */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Recent sign-in activity">
          <ul className="divide-y" style={{ borderColor: "var(--line-2)" }}>
            {data.recentSignIns.map((s, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--muted-ink)" }} />
                <div className="flex-1 min-w-0"><div className="text-[12.5px]" style={{ color: "var(--shell)" }}>{s.device} · {s.location}</div><div className="text-[11px]" style={{ color: "var(--muted-ink)" }}>{fmtDateTime(s.at)} · MFA: {s.mfa}</div></div>
                <Badge tone={s.result === "Success" ? "success" : "danger"}>{s.result}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Security-event history">
          <ul className="space-y-2.5">
            {data.events.map((e, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px]">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: e.severity === "Warning" ? "var(--warn)" : "var(--muted-ink)" }} />
                <div><span style={{ color: "var(--shell)" }} className="font-medium">{e.event}</span><div style={{ color: "var(--muted-ink)" }}>{fmtDateTime(e.at)}</div></div>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: "var(--line-2)" }}>
            <GhostButton onClick={() => alert("Password change requires recent authentication. (preview)")}><KeyRound className="w-4 h-4" /> Change password</GhostButton>
            <GhostButton onClick={() => alert("Report suspicious activity to the Link security team. (preview)")}><AlertTriangle className="w-4 h-4" /> Report suspicious activity</GhostButton>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}