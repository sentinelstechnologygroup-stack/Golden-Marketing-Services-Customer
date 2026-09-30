import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft, RotateCw } from "lucide-react";
import Logo from "@/components/portal/Logo";
import PortalSplash from "@/components/portal/PortalSplash";
import { usePortalAuth } from "@/lib/PortalAuthContext";
import { PrimaryButton } from "@/components/portal/PageHeader";

export default function Verify() {
  const { pendingMfa, verifyMfa, cancelMfa } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";
  const trust = location.state?.trustDevice ?? true;

  const methods = pendingMfa?.methods || ["authenticator", "email"];
  const [method, setMethod] = useState(methods[0] || "authenticator");
  const [code, setCode] = useState("");
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  if (openingDashboard) {
    return <PortalSplash mode="dashboard" onComplete={() => navigate(from, { replace: true })} />;
  }

  if (!pendingMfa) {
    // Direct visit without a pending MFA — return to sign-in.
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--offwhite)" }}>
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--muted-ink)" }}>No verification in progress.</p>
          <Link to="/sign-in" className="mt-3 inline-block text-[13px] font-medium hover:underline" style={{ color: "var(--gms-navy)" }}>Return to sign-in</Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!/^\d{6}$/.test(code)) { setErr("Enter the 6-digit code."); return; }
    setSubmitting(true);
    try {
      await verifyMfa({ code, method, trustDevice: trust });
      setOpeningDashboard(true);
    } catch (error) {
      setErr(error?.message || "Invalid or expired code. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = () => {
    setResendIn(30);
    setCode("");
    setErr("A new code has been sent.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--offwhite)" }}>
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-6"><Logo size={30} /></div>
        <div className="portal-card p-6 sm:p-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--gms-champagne)" }}>
              <ShieldCheck className="w-6 h-6" style={{ color: "var(--gms-navy)" }} />
            </div>
          </div>
          <h1 className="font-display text-[24px] font-semibold text-center" style={{ color: "var(--shell)" }}>
            Verify it’s you
          </h1>
          <p className="mt-2 text-[13.5px] text-center" style={{ color: "var(--muted-ink)" }}>
            Enter the 6-digit code from your {method === "authenticator" ? "authenticator app" : "email"}.
          </p>

          {methods.length > 1 && (
            <div className="mt-5 flex gap-2 justify-center">
              {methods.map((m) => (
                <button
                  key={m} type="button" onClick={() => setMethod(m)}
                  className="touch-target px-3.5 rounded-lg text-[12.5px] font-medium border focus-ring"
                  style={{
                    borderColor: method === m ? "var(--gms-navy)" : "var(--line)",
                    background: method === m ? "var(--gms-champagne)" : "#fff",
                    color: method === m ? "var(--gms-deep)" : "var(--ink-2)",
                  }}
                >
                  {m === "authenticator" ? "Authenticator app" : "Email code"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor="code" className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>
                Verification code
              </label>
              <input
                id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full touch-target rounded-lg px-3.5 text-center text-[20px] tracking-[0.4em] bg-white border focus-ring"
                style={{ borderColor: "var(--line)" }}
                placeholder="000000"
              />
            </div>

            {err && (
              <div role="alert" className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "rgba(180,69,47,0.08)", color: "var(--danger)" }}>
                {err}
              </div>
            )}

            <PrimaryButton type="submit" disabled={submitting} className="w-full">
              {submitting ? "Verifying…" : "Verify and continue"}
            </PrimaryButton>
          </form>

          <div className="mt-4 flex items-center justify-between text-[12px]" style={{ color: "var(--muted-ink)" }}>
            <button
              type="button" onClick={resend} disabled={resendIn > 0}
              className="inline-flex items-center gap-1.5 touch-target px-2 disabled:opacity-50 hover:underline"
              style={{ color: "var(--gms-navy)" }}
            >
              <RotateCw className="w-3.5 h-3.5" />
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
            <Link to="/forgot-password" className="hover:underline" style={{ color: "var(--gms-navy)" }}>Use a recovery code</Link>
          </div>
        </div>

        <div className="mt-5 text-center">
          <button
            onClick={() => { cancelMfa(); navigate("/sign-in", { replace: true }); }}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:underline focus-ring rounded"
            style={{ color: "var(--muted-ink)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Return to sign-in
          </button>
        </div>
      </div>
    </div>
  );
}