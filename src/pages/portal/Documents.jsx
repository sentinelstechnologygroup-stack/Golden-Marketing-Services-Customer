import { useMemo, useState } from "react";
import { Search, Upload, Download, FileText, ShieldCheck, History } from "lucide-react";
import portalAdapter from "@/services/portalAdapter";
import { usePortalData } from "@/lib/usePortalData";
import PageHeader, { PrimaryButton } from "@/components/portal/PageHeader";
import SectionCard from "@/components/portal/SectionCard";
import Badge from "@/components/portal/Badge";
import { TableSkeleton } from "@/components/portal/Skeleton";
import ErrorState from "@/components/portal/ErrorState";
import EmptyState from "@/components/portal/EmptyState";
import { fmtDate, fmtFileSize } from "@/lib/portalUtils";

const CATEGORIES = ["all", "Service agreement", "Approved scripts", "Qualification criteria", "Routing instructions", "Performance reports", "Invoices", "Compliance documents", "Customer-uploaded files"];

export default function Documents() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const { data, loading, error, retry } = usePortalData(() => portalAdapter.getDocuments(), []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, search, category]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = e.target.elements.file?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", e.target.elements.category?.value || "Customer-uploaded files");
      await portalAdapter.createDocument(fd);
      setUploadOpen(false);
      retry();
    } catch {
      /* ignore in preview */
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Private customer documents — agreements, scripts, criteria, reports, invoices, and compliance files."
        actions={<PrimaryButton onClick={() => setUploadOpen((s) => !s)}><Upload className="w-4 h-4" /> Upload document</PrimaryButton>}
      />

      <div className="portal-card p-3 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-ink)" }} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="w-full touch-target rounded-lg pl-10 pr-3 text-[14px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }} />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring sm:w-56" style={{ borderColor: "var(--line)" }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
          </select>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11.5px]" style={{ color: "var(--muted-ink)" }}>
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--gms-navy)" }} /> Files are private to your account and never served as public media.
        </div>
      </div>

      {uploadOpen && (
        <form onSubmit={handleUpload} className="portal-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div><label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--ink-2)" }}>File</label><input name="file" type="file" required className="text-[13px]" /></div>
          <div><label className="block text-[12px] font-semibold mb-1" style={{ color: "var(--ink-2)" }}>Category</label><select name="category" className="touch-target rounded-lg px-3 text-[13px] bg-white border focus-ring" style={{ borderColor: "var(--line)" }}>{CATEGORIES.filter((c) => c !== "all").map((c) => <option key={c}>{c}</option>)}</select></div>
          <button type="submit" disabled={uploading} className="touch-target px-4 rounded-lg text-[13px] font-semibold text-white focus-ring disabled:opacity-50" style={{ background: "var(--shell)" }}>{uploading ? "Uploading…" : "Upload"}</button>
        </form>
      )}

      {loading ? <div className="portal-card"><TableSkeleton rows={6} cols={4} /></div> :
       error ? <ErrorState error={error} onRetry={retry} /> :
       rows.length === 0 ? <div className="portal-card"><EmptyState title="No documents found" description="Try a different search or category." /></div> :
       (
        <div className="portal-card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--line-2)", background: "var(--offwhite)" }}>
                {["Document", "Category", "Uploaded", "Updated", "Uploaded by", "Size", "Access", ""].map((h) => <th key={h} className="px-3 py-3 eyebrow font-semibold" style={{ color: "var(--muted-ink)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b last:border-0" style={{ borderColor: "var(--line-2)" }}>
                    <td className="px-3 py-3"><button onClick={() => setSelected(d)} className="flex items-center gap-2 text-left hover:underline"><FileText className="w-4 h-4 shrink-0" style={{ color: "var(--gms-navy)" }} /><span className="font-semibold" style={{ color: "var(--shell)" }}>{d.name}</span></button></td>
                    <td className="px-3 py-3"><Badge tone="neutral">{d.category}</Badge></td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(d.uploaded)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(d.updated)}</td>
                    <td className="px-3 py-3">{d.uploadedBy}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{fmtFileSize(d.size)}</td>
                    <td className="px-3 py-3 text-[11.5px]" style={{ color: "var(--muted-ink)" }}>{d.access}</td>
                    <td className="px-3 py-3 text-right"><button aria-label={`Download ${d.name}`} onClick={() => alert(`Download of "${d.name}" is handled by the production API. (preview)`)} className="touch-target w-9 h-9 rounded-lg inline-flex items-center justify-center focus-ring" style={{ color: "var(--gms-navy)" }}><Download className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <DocumentDrawer doc={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DocumentDrawer({ doc, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={doc.name}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md h-full bg-white shadow-2xl overflow-y-auto safe-b">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white" style={{ borderColor: "var(--line-2)" }}>
          <h2 className="font-display text-[17px] font-semibold" style={{ color: "var(--shell)" }}>Document details</h2>
          <button onClick={onClose} aria-label="Close" className="touch-target w-9 h-9 rounded-lg flex items-center justify-center focus-ring" style={{ color: "var(--muted-ink)" }}>✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3"><FileText className="w-10 h-10 rounded-lg p-2" style={{ background: "var(--gms-champagne)", color: "var(--gms-navy)" }} /><div><div className="font-semibold text-[14px]" style={{ color: "var(--shell)" }}>{doc.name}</div><div className="text-[12px]" style={{ color: "var(--muted-ink)" }}>{fmtFileSize(doc.size)} · v{doc.version}</div></div></div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Category</dt><dd style={{ color: "var(--shell)" }}>{doc.category}</dd></div>
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Uploaded</dt><dd style={{ color: "var(--shell)" }}>{fmtDate(doc.uploaded)}</dd></div>
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Last updated</dt><dd style={{ color: "var(--shell)" }}>{fmtDate(doc.updated)}</dd></div>
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Uploaded by</dt><dd style={{ color: "var(--shell)" }}>{doc.uploadedBy}</dd></div>
            <div className="flex justify-between"><dt style={{ color: "var(--muted-ink)" }}>Access</dt><dd className="text-right" style={{ color: "var(--shell)" }}>{doc.access}</dd></div>
          </dl>
          <div className="pt-3 border-t" style={{ borderColor: "var(--line-2)" }}>
            <div className="eyebrow mb-2 flex items-center gap-1.5" style={{ color: "var(--muted-ink)" }}><History className="w-3.5 h-3.5" /> Version history</div>
            <ul className="space-y-1.5 text-[12.5px]">
              <li className="flex justify-between"><span style={{ color: "var(--ink-2)" }}>v{doc.version}</span><span style={{ color: "var(--muted-ink)" }}>{fmtDate(doc.updated)} · {doc.uploadedBy}</span></li>
              <li className="flex justify-between"><span style={{ color: "var(--muted-ink)" }}>v1.0</span><span style={{ color: "var(--muted-ink)" }}>{fmtDate(doc.uploaded)} · {doc.uploadedBy}</span></li>
            </ul>
          </div>
          <button onClick={() => alert(`Download of "${doc.name}" is handled by the production API. (preview)`)} className="touch-target w-full inline-flex items-center justify-center gap-2 px-4 rounded-lg text-[13px] font-semibold text-white focus-ring" style={{ background: "var(--shell)" }}><Download className="w-4 h-4" /> Download</button>
        </div>
      </div>
    </div>
  );
}