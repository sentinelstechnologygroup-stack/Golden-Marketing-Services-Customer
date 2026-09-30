import { useNavigate } from "react-router-dom";
import { Menu, Bell, ChevronDown } from "lucide-react";
import { usePortalAuth } from "@/lib/PortalAuthContext";
import Badge from "@/components/portal/Badge";

export default function TopBar({ title, onOpenMenu }) {
  const { session, signOut } = usePortalAuth();
  const navigate = useNavigate();
  const company = session?.company;

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 border-b safe-t"
      style={{ background: "var(--offwhite)", borderColor: "var(--line)" }}
    >
      <button
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="lg:hidden touch-target w-10 h-10 -ml-1 rounded-lg flex items-center justify-center focus-ring"
        style={{ color: "var(--shell)" }}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[17px] sm:text-[19px] font-semibold leading-none truncate" style={{ color: "var(--shell)" }}>
          {title}
        </h2>
        <div className="mt-1 flex items-center gap-2 text-[11.5px]" style={{ color: "var(--muted-ink)" }}>
          <span className="truncate">{company?.name}</span>
          <span className="opacity-40">·</span>
          <Badge tone={company?.programStatus === "Active" ? "success" : "neutral"}>{company?.programStatus || "—"}</Badge>
        </div>
      </div>

      <button
        onClick={() => navigate("/notifications")}
        aria-label="Notifications"
        className="touch-target w-10 h-10 rounded-lg flex items-center justify-center focus-ring relative"
        style={{ color: "var(--ink-2)" }}
      >
        <Bell className="w-[19px] h-[19px]" />
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: "var(--gold)" }} />
      </button>

      <button
        onClick={() => navigate("/account")}
        aria-label="Account"
        className="hidden sm:flex touch-target h-10 pl-1.5 pr-2.5 rounded-lg items-center gap-2 focus-ring border"
        style={{ borderColor: "var(--line)" }}
      >
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: "var(--gms-navy)" }}>
          {session?.user?.initials}
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-ink)" }} />
      </button>
    </header>
  );
}