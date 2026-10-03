import { Link } from "react-router-dom";
import { ArrowUpRight, BarChart3, Building2, CreditCard, LifeBuoy, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import { usePortalAuth } from "@/lib/PortalAuthContext";

const ADMIN_LINKS = [
  { to: "/account", label: "Team & account", detail: "Review the customer account profile and team settings.", icon: Building2 },
  { to: "/reports", label: "Performance reports", detail: "Open and export the current customer performance reports.", icon: BarChart3 },
  { to: "/billing", label: "Billing", detail: "Review invoices and billing records for this account.", icon: CreditCard },
  { to: "/support", label: "Support", detail: "Contact the Golden Marketing Services support team.", icon: LifeBuoy },
];

export default function AdminPortal() {
  const { session } = usePortalAuth();
  const user = session?.user || session;
  return (
    <div>
      <PageHeader title="Admin Portal" description="Administrator access for your Golden Marketing Services account." />
      {session?.gmsSuperAdmin && <div className="mb-4 rounded-xl border bg-white p-4 text-sm">Viewing client: {session?.company?.name || 'No client selected'}. This is a customer account view, not your GMS organization. All new-client onboarding and GMS administration are in <a className="font-semibold underline" href="https://agentcrm.goldenmarketingservices.com/clients">Agent Portal → Clients</a>.</div>}
      <SectionCard title="Administrator access" className="mb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#e7f1ed] p-3 text-[#17665a]"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <p className="text-sm font-semibold text-[#173c3a]">Single administrator tier</p>
            <p className="mt-1 text-sm text-[#667775]">Signed in as {user?.name || user?.email || "Administrator"}{session?.company?.name ? ` for ${session.company.name}` : ""}.</p>
            <p className="mt-2 text-xs leading-5 text-[#788784]">Access is based on the authenticated account role. User provisioning and permission changes must be performed by the trusted backend, not from this browser.</p>
          </div>
        </div>
      </SectionCard>
      <div className="grid gap-3 sm:grid-cols-2">
        {ADMIN_LINKS.map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="group rounded-xl border border-[#dce5e1] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#17665a] hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-lg bg-[#f1f5f2] p-2 text-[#17665a]"><Icon className="h-5 w-5" /></div>
              <ArrowUpRight className="h-4 w-4 text-[#93a09c] transition group-hover:text-[#17665a]" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-[#173c3a]">{label}</h2>
            <p className="mt-1 text-xs leading-5 text-[#71807c]">{detail}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
