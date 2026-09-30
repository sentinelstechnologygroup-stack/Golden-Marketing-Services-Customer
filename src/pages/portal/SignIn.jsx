import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, Lock, LifeBuoy } from "lucide-react";
import Logo from "@/components/portal/Logo";
import PortalSplash from "@/components/portal/PortalSplash";
import { usePortalAuth } from "@/lib/PortalAuthContext";
import portalAdapter from "@/services/portalAdapter";
import { PrimaryButton } from "@/components/portal/PageHeader";

const TRUST_FEATURES = [
  "Protected customer workspace",
  "Multi-factor authentication",
  "Encrypted session cookies",
  "Tenant-separated customer information",
  "Role-based permissions",
  "Account access history",
  "Credentials are not stored by the marketing website",
];

export default function SignIn() {
  const { signIn } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [trust, setTrust] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [transition, setTransition] = useState("entry");

  const from = location.state?.from || "/dashboard";

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!email || !password) { setErr("Enter your business email and password."); return; }
    setSubmitting(true);
    try {
      const res = await signIn({ email, password, trustDevice: trust });
      if (res?.requiresMfa) {
        navigate("/verify", { state: { from, trustDevice: trust } });
      } else {
        setTransition("dashboard");
      }
    } catch (error) {
      setErr(error?.message || "Sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (transition) {
    return (
      <PortalSplash
        mode={transition}
        onComplete={() => {
          if (transition === "dashboard") navigate(from, { replace: true });
          else setTransition(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: "var(--offwhite)" }}>
      {/* Brand panel */}
      <div className="lg:w-[42%] xl:w-[40%] portal-shell-bg text-white flex flex-col p-7 sm:p-10 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px gold-rule" />
        <div>
          <Logo variant="light" size={32} />
        </div>

        <div className="mt-auto lg:my-auto pt-12 lg:pt-0">
          <h1 className="font-display text-[34px] sm:text-[42px] leading-[1.05] font-semibold tracking-tight">
            Welcome back.
          </h1>
          <p className="mt-4 text-[15px] max-w-md leading-relaxed" style={{ color: "#BFD0CE" }}>
            Sign in to follow every lead from first response through qualification, appointment setting,
            live transfer, and final outcome — all in one protected workspace.
          </p>

          <ul className="mt-9 space-y-3 max-w-md">
            {TRUST_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[13.5px]" style={{ color: "#D9E6E3" }}>
                <ShieldCheck className="w-[18px] h-[18px] mt-0.5 shrink-0" style={{ color: "var(--gold)" }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 lg:mt-12 text-[11.5px]" style={{ color: "#7FA09D" }}>
          © {new Date().getFullYear()} Golden Marketing Services. All rights reserved.
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-8">
            <Logo size={30} />
          </div>

          <div className="eyebrow mb-2" style={{ color: "var(--gms-navy)" }}>Customer Portal</div>
          <h2 className="font-display text-[26px] font-semibold leading-tight" style={{ color: "var(--shell)" }}>
            Sign in to your account
          </h2>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--muted-ink)" }}>
            Use your business credentials to access your lead-response program.
          </p>

          {portalAdapter.isPreviewMode && (
            <div className="mt-4 text-[12px] px-3 py-2 rounded-lg border" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--shell)" }}>
              Interface preview — no real authentication is performed. Sample program data is shown after sign-in.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>
                Business email
              </label>
              <input
                id="email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full touch-target rounded-lg px-3.5 text-[14px] bg-white border focus-ring"
                style={{ borderColor: "var(--line)" }}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-[12.5px] font-semibold" style={{ color: "var(--ink-2)" }}>
                  Password
                </label>
                <Link to="/forgot-password" className="text-[12px] font-medium hover:underline" style={{ color: "var(--gms-navy)" }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password" type={showPw ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full touch-target rounded-lg px-3.5 pr-11 text-[14px] bg-white border focus-ring"
                  style={{ borderColor: "var(--line)" }}
                  placeholder="••••••••"
                />
                <button
                  type="button" onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 touch-target w-9 h-9 rounded-md flex items-center justify-center focus-ring"
                  style={{ color: "var(--muted-ink)" }}
                >
                  {showPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="w-4 h-4 rounded accent-[var(--gms-navy)]" />
              <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>Trust this device for 30 days</span>
            </label>

            {err && (
              <div role="alert" className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "rgba(180,69,47,0.08)", color: "var(--danger)" }}>
                {err}
              </div>
            )}

            <PrimaryButton type="submit" disabled={submitting} className="w-full" style={{ background: "var(--shell)" }}>
              <Lock className="w-4 h-4" />
              {submitting ? "Signing in…" : "Secure sign-in"}
            </PrimaryButton>
          </form>

          <div className="mt-6 pt-5 border-t flex items-center justify-between text-[12px]" style={{ borderColor: "var(--line)", color: "var(--muted-ink)" }}>
            <Link to="/support" className="inline-flex items-center gap-1.5 hover:underline" style={{ color: "var(--gms-navy)" }}>
              <LifeBuoy className="w-4 h-4" /> Contact support
            </Link>
            <span>Secured · Encrypted · MFA protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}