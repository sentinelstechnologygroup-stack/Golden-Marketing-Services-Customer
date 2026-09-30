import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Activity, CalendarClock, BarChart3, CreditCard,
  FileText, LifeBuoy, Bell, ShieldCheck, Building2, LogOut,
} from "lucide-react";
import Logo from "@/components/portal/Logo";
import { usePortalAuth } from "@/lib/PortalAuthContext";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/leads", label: "Lead Activity", icon: Activity },
  { to: "/appointments", label: "Appointments", icon: CalendarClock },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/security", label: "Security", icon: ShieldCheck },
  { to: "/account", label: "Team & Account", icon: Building2 },
];

export default function Sidebar({ onNavigate }) {
  const { session, signOut } = usePortalAuth();
  const navigate = useNavigate();
  const user = session?.user;
  const company = session?.company;

  const handleSignOut = async () => {
    await signOut();
    navigate("/sign-in", { replace: true });
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-x-hidden portal-shell-bg text-white">
      <div className="min-w-0 px-5 pt-5 pb-3">
        <Logo variant="light" size={30} />
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-2" aria-label="Primary">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors touch-target ${
                    isActive ? "text-white" : "text-[#9FB5B3] hover:text-white"
                  }`
                }
                style={({ isActive }) => (isActive ? { background: "var(--shell-3)" } : undefined)}
              >
                {({ isActive }) => (
                  <>
                    <Icon className="w-[18px] h-[18px] shrink-0" style={{ color: isActive ? "var(--gold)" : "currentColor" }} />
                    <span>{label}</span>
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-3 pb-4 pt-3 border-t" style={{ borderColor: "var(--shell-line)" }}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
            style={{ background: "var(--gms-navy)", color: "#fff" }}
            aria-hidden="true"
          >
            {user?.initials || "—"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-white truncate">{user?.name || "—"}</div>
            <div className="text-[11px] truncate" style={{ color: "#9FB5B3" }}>{user?.role || "—"} · {company?.name || ""}</div>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="touch-target w-9 h-9 rounded-lg flex items-center justify-center focus-ring"
            style={{ color: "#9FB5B3" }}
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}