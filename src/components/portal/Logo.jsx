export default function Logo({ variant = "dark", size = 30, showWord = true, className = "" }) {
  const width = Math.max(showWord ? 220 : 72, Math.round(size * (showWord ? 8.25 : 2.4)));

  return (
    <div
      className={`inline-flex max-w-full items-center ${variant === "light" ? "drop-shadow-[0_8px_18px_rgba(0,0,0,.2)]" : ""} ${className}`}
      aria-label="Golden Marketing Services Customer Portal"
    >
      <img
        src="/brand/gms-logo-horizontal-transparent.png"
        alt="Golden Marketing Services Customer Portal"
        className="block h-auto max-w-full object-contain"
        style={{ width }}
        width="2172"
        height="724"
        decoding="async"
      />
    </div>
  );
}
