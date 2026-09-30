import { Info } from "lucide-react";

export default function PreviewBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 px-4 py-2.5 text-[12.5px] border-b"
      style={{ background: "var(--gold-soft)", borderColor: "var(--gold)", color: "var(--shell)" }}
    >
      <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--gold-2)" }} />
      <p>
        <span className="font-semibold">GMS preview workspace:</span> Sample program data is shown until the
        production customer API and identity provider are connected.
      </p>
    </div>
  );
}
