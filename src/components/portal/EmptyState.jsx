import { Inbox } from "lucide-react";

export default function EmptyState({ title = "Nothing here yet", description = "", action = null, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--gms-champagne)" }}>
        <Icon className="w-5 h-5" style={{ color: "var(--gms-navy)" }} />
      </div>
      <h3 className="font-display text-lg font-semibold" style={{ color: "var(--shell)" }}>{title}</h3>
      {description && <p className="mt-1 text-sm max-w-sm" style={{ color: "var(--muted-ink)" }}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}