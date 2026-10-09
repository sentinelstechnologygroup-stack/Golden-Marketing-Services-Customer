import ClientCallTree from '@/components/ClientCallTree';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import portalAdapter from '@/services/portalAdapter';
import { usePortalAuth } from '@/lib/PortalAuthContext';
import PageHeader from '@/components/portal/PageHeader';

export default function Onboarding() {
  const { session } = usePortalAuth();
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tree,setTree]=useState(null);
  const [notes, setNotes] = useState({});
  const platformAdmin = session?.gmsSuperAdmin === true;
  const clientAdmin = ['client_admin', 'client_supervisor'].includes(session?.user?.role);
  const refresh = () => portalAdapter.onboarding.get().then(value=>{setRecord(value);setTree(value.data?.callTree || {mode:'fixed',ringSeconds:25,recipients:[]});});
  useEffect(() => { refresh().catch(e => setMessage(e.message)); }, []);
  const decide = async (c, decision) => {
    if (!window.confirm(decision === 'approved' ? 'Approve this exact campaign, ad copy and attached creative files?' : 'Request changes and pause this campaign?')) return;
    setBusy(true); setMessage('');
    try { await portalAdapter.onboarding.approve({ campaignId: c.id, version: record.campaignVersions[c.id], decision, note: notes[c.id] || '' }); await refresh(); setMessage('Your decision was recorded in the shared client cabinet and audit history.'); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  };
  const download = async doc => { try { const url = await portalAdapter.downloadDocument(doc); if (url) window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { setMessage(e.message); } };
  return <div className="space-y-5"><PageHeader title="Campaign Approvals" description="Review your program, ad copy and creative files. Decisions are shared with your GMS team." />{platformAdmin && <p className="rounded-xl border bg-white p-4 text-sm">You are reviewing {session?.company?.name || 'this client'} as GMS staff. Customer approval must come from their own account. <a className="font-semibold underline" href="https://agentcrm.goldenmarketingservices.com/clients">Manage all clients in the Agent Portal</a>.</p>}{message && <p role="status" className="rounded-xl border bg-white p-4 text-sm">{message}</p>}{!record && !message && <p>Loading your campaign cabinet…</p>}{record?.tenantId && <section className="rounded-xl border bg-white p-5"><ClientCallTree value={tree} onChange={setTree} disabled={busy || !clientAdmin || platformAdmin}/>{clientAdmin && !platformAdmin && <button disabled={busy} type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={async()=>{setBusy(true);try{await portalAdapter.onboarding.saveCallTree({callTree:tree,revision:record.revision});await refresh();setMessage('Realtor handoff call tree saved.');}catch(e){setMessage(e.message);}finally{setBusy(false);}}}>Save handoff call tree</button>}</section>}{record && !(record.data?.campaigns || []).length && <div className="rounded-xl border bg-white p-8"><p>No campaigns awaiting review yet.</p><Link className="mt-3 inline-block underline" to="/documents">View shared documents</Link></div>}{(record?.data?.campaigns || []).map(c => <section key={c.id} className="space-y-4 rounded-xl border bg-white p-5"><h2 className="font-heading text-xl">{c.name || 'Campaign in preparation'}</h2><p className="text-sm">{c.type} · {c.source}</p><h3 className="font-semibold">Ad copy</h3><p className="whitespace-pre-wrap text-sm">{c.adCopy || 'Your team is preparing the ad copy.'}</p><h3 className="font-semibold">Creative files</h3>{(record.documents || []).filter(d => c.documentIds?.includes(d.id)).map(d => <button type="button" key={d.id} onClick={() => download(d)} className="block text-sm underline">{d.name}</button>)}<details><summary className="cursor-pointer text-sm font-semibold">Program instructions and qualification</summary><p className="mt-3 whitespace-pre-wrap text-sm">{c.script}</p><p className="mt-3 whitespace-pre-wrap text-sm">{c.qualification}</p><p className="mt-3 whitespace-pre-wrap text-sm">{c.consent}</p></details><p className="text-sm">Status: {record.approvals[c.id]?.version === record.campaignVersions[c.id] ? record.approvals[c.id]?.status.replaceAll('_',' ') : 'Awaiting review of this version'}</p>{record.approvals[c.id]?.note && <p className="text-sm">Last feedback: {record.approvals[c.id].note}</p>}{clientAdmin && !platformAdmin && <div className="space-y-3"><label className="block text-sm">Feedback<textarea className="mt-1 w-full rounded-lg border p-3" value={notes[c.id] || ''} onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))} /></label><div className="flex flex-wrap gap-3"><button disabled={busy || !c.adCopy || !c.documentIds?.length} type="button" onClick={() => decide(c,'approved')} className="rounded-lg px-4 py-2 text-white disabled:opacity-50" style={{ background: 'var(--shell)' }}>Approve campaign</button><button disabled={busy} type="button" onClick={() => decide(c,'changes_requested')} className="rounded-lg border px-4 py-2">Request changes</button></div></div>}</section>)}</div>;
}
