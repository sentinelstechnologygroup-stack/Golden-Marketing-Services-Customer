const TONES = {
  teal: { bg: "var(--gms-champagne)", fg: "var(--gms-deep)", border: "rgba(20,133,127,0.25)" },
  gold: { bg: "var(--gold-soft)", fg: "var(--gold-2)", border: "rgba(201,162,75,0.3)" },
  neutral: { bg: "var(--line-2)", fg: "var(--ink-2)", border: "var(--line)" },
  success: { bg: "rgba(46,125,91,0.10)", fg: "var(--success)", border: "rgba(46,125,91,0.25)" },
  danger: { bg: "rgba(180,69,47,0.10)", fg: "var(--danger)", border: "rgba(180,69,47,0.25)" },
  warn: { bg: "rgba(176,122,30,0.10)", fg: "var(--warn)", border: "rgba(176,122,30,0.25)" },
  shell: { bg: "rgba(11,42,46,0.08)", fg: "var(--shell)", border: "rgba(11,42,46,0.15)" },
};

export default function Badge({ children, tone = "neutral", className = "" }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}
      style={{ background: t.bg, color: t.fg, borderColor: t.border }}
    >
      {children}
    </span>
  );
}

export function stageTone(stage) {
  const map = {
    "Lead received": "neutral", "Rapid response": "neutral", "Conversation": "teal",
    "Qualified": "teal", "Qualification": "teal", "Appointment set": "gold",
    "Live transfer": "gold", "Handed off": "success", "No contact": "warn",
    "Disqualified": "danger", "Closed — won": "success", "Closed — lost": "danger",
  };
  return map[stage] || "neutral";
}