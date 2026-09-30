import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Mail, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";
import Logo from "@/components/portal/Logo";
import portalAdapter from "@/services/portalAdapter";
import { PrimaryButton } from "@/components/portal/PageHeader";

const STRENGTH = [
  { re: /.{8,}/, label: "At least 8 characters" },
  { re: /[A-Z]/, label: "An uppercase letter" },
  { re: /[a-z]/, label: "A lowercase letter" },
  { re: /[0-9]/, label: "A number" },
  { re: /[^A-Za-z0-9]/, label: "A symbol" },
];

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const requestRecovery = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!email) { setErr("Enter your business email."); return; }
    setSubmitting(true);
    try {
      await portalAdapter.auth.requestRecovery({ email });
      setSent(true);
    } catch {
      setErr("Unable to process the request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const completeRecovery = async (e) => {
    e.preventDefault();
    setErr(null);
    const failed = STRENGTH.filter((s) => !s.re.test(newPw));
    if (failed.length) { setErr(`Password must include: ${failed.map((f) => f.label.toLowerCase()).join(", ")}.`); return; }
    if (newPw !== confirm) { setErr("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      await portalAdapter.auth.completeRecovery({ token, password: newPw });
      setDone(true);
    } catch (error) {
      setErr(error?.message || "Recovery link is invalid or expired. Request a new one.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--offwhite)" }}>
      <div className="w-full max-w-[440px]">
        <div className="flex justify-center mb-6"><Logo size={30} /></div>

        {!token && !sent && (
          <div className="portal-card p-6 sm:p-8">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--gms-champagne)" }}>
                <Mail className="w-6 h-6" style={{ color: "var(--gms-navy)" }} />
              </div>
            </div>
            <h1 className="font-display text-[24px] font-semibold text-center" style={{ color: "var(--shell)" }}>Reset your password</h1>
            <p className="mt-2 text-[13.5px] text-center" style={{ color: "var(--muted-ink)" }}>
              Enter your business email. If an account exists, we’ll send a single-use recovery link.
            </p>
            <form onSubmit={requestRecovery} className="mt-5 space-y-4" noValidate>
              <div>
                <label htmlFor="rec-email" className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>Business email</label>
                <input id="rec-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full touch-target rounded-lg px-3.5 text-[14px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} placeholder="you@company.com" />
              </div>
              {err && <div role="alert" className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "rgba(180,69,47,0.08)", color: "var(--danger)" }}>{err}</div>}
              <PrimaryButton type="submit" disabled={submitting} className="w-full">{submitting ? "Sending…" : "Send recovery link"}</PrimaryButton>
            </form>
          </div>
        )}

        {!token && sent && (
          <div className="portal-card p-6 sm:p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(46,125,91,0.12)" }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: "var(--success)" }} />
              </div>
            </div>
            <h1 className="font-display text-[24px] font-semibold" style={{ color: "var(--shell)" }}>Check your email</h1>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--muted-ink)" }}>
              If an account is associated with that address, a recovery link is on its way. The link expires
              shortly and can be used only once. For your security, we don’t confirm whether the account exists.
            </p>
            <div className="mt-6">
              <Link to="/sign-in" className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline focus-ring rounded" style={{ color: "var(--gms-navy)" }}>
                <ArrowLeft className="w-4 h-4" /> Return to sign-in
              </Link>
            </div>
          </div>
        )}

        {token && !done && (
          <div className="portal-card p-6 sm:p-8">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--gms-champagne)" }}>
                <ShieldCheck className="w-6 h-6" style={{ color: "var(--gms-navy)" }} />
              </div>
            </div>
            <h1 className="font-display text-[24px] font-semibold text-center" style={{ color: "var(--shell)" }}>Set a new password</h1>
            <p className="mt-2 text-[13.5px] text-center" style={{ color: "var(--muted-ink)" }}>
              Choose a strong password. You may be asked to verify with MFA after resetting.
            </p>
            <form onSubmit={completeRecovery} className="mt-5 space-y-4" noValidate>
              <div>
                <label htmlFor="newpw" className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>New password</label>
                <input id="newpw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  className="w-full touch-target rounded-lg px-3.5 text-[14px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} />
              </div>
              <ul className="grid grid-cols-1 gap-1 text-[11.5px]">
                {STRENGTH.map((s) => {
                  const ok = s.re.test(newPw);
                  return <li key={s.label} className="flex items-center gap-1.5" style={{ color: ok ? "var(--success)" : "var(--muted-ink)" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> {s.label}
                  </li>;
                })}
              </ul>
              <div>
                <label htmlFor="confirm" className="block text-[12.5px] font-semibold mb-1.5" style={{ color: "var(--ink-2)" }}>Confirm new password</label>
                <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full touch-target rounded-lg px-3.5 text-[14px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} />
              </div>
              {err && <div role="alert" className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "rgba(180,69,47,0.08)", color: "var(--danger)" }}>{err}</div>}
              <PrimaryButton type="submit" disabled={submitting} className="w-full">{submitting ? "Saving…" : "Reset password"}</PrimaryButton>
            </form>
          </div>
        )}

        {token && done && (
          <div className="portal-card p-6 sm:p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(46,125,91,0.12)" }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: "var(--success)" }} />
              </div>
            </div>
            <h1 className="font-display text-[24px] font-semibold" style={{ color: "var(--shell)" }}>Password updated</h1>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--muted-ink)" }}>Your password has been changed. You can now sign in with your new credentials.</p>
            <div className="mt-6">
              <button onClick={() => navigate("/sign-in", { replace: true })} className="touch-target inline-flex items-center gap-1.5 px-4 rounded-lg text-[13px] font-semibold text-white focus-ring" style={{ background: "var(--shell)" }}>
                <ArrowLeft className="w-4 h-4" /> Return to sign-in
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 text-center">
          <Link to="/sign-in" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:underline focus-ring rounded" style={{ color: "var(--muted-ink)" }}>
            <ArrowLeft className="w-4 h-4" /> Back to sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}