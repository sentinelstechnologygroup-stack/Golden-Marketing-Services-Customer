import { useEffect, useRef } from "react";

export default function PortalSplash({ onComplete, mode = "entry" }) {
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const timer = window.setTimeout(
      () => onCompleteRef.current(),
      reduceMotion ? 120 : mode === "dashboard" ? 3100 : 3600
    );
    return () => window.clearTimeout(timer);
  }, [mode]);

  return (
    <div className={`portal-splash portal-splash--${mode}`} role="status" aria-live="polite" aria-label={mode === "dashboard" ? "Opening customer dashboard" : "Opening customer portal"}>
      <div className="portal-splash__aura" aria-hidden="true" />
      <div className="portal-splash__content">
        <div className="portal-splash__logo-stage">
          <img
            src="/brand/gms-logo-horizontal-transparent.png"
            alt="Golden Marketing Services Customer Portal"
            className="portal-splash__logo"
            width="2081"
            height="756"
            decoding="sync"
          />
          <span className="portal-splash__light-sweep" aria-hidden="true" />
          <span className="portal-splash__energy-line" aria-hidden="true" />
        </div>
        <div className="portal-splash__status">
          <span>{mode === "dashboard" ? "Access verified" : "Secure customer access"}</span>
          <span className="portal-splash__status-line" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
