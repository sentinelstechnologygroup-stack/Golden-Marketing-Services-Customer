import { useState } from 'react';
import portalAdapter from '@/services/portalAdapter';

export default function CallEvidence({callId}) {
  const [evidence,setEvidence]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [downloads,setDownloads]=useState({});
  async function load() {
    setBusy(true);setError('');
    try {setEvidence(await portalAdapter.getCallEvidence(callId));}
    catch {setError('Call evidence could not be loaded. Please try again.');}
    finally {setBusy(false);}
  }
  async function download(recordingId) {
    setBusy(true);setError('');
    try {
      const result=await portalAdapter.getCallRecordingDownload(callId,recordingId);
      const url=new URL(result.url);
      if(url.protocol!=='https:' || url.hostname!=='storage.googleapis.com' || result.expiresAtMs<=Date.now()) throw new Error('Invalid download.');
      setDownloads(values=>({...values,[recordingId]:result}));
    } catch {setError('The verified recording download is not ready. Please try again.');}
    finally {setBusy(false);}
  }
  return <div className="mt-3 border-t pt-3" style={{borderColor:'var(--line-2)'}}>
    <button type="button" onClick={load} disabled={busy} className="touch-target font-semibold hover:underline focus-ring disabled:opacity-50" style={{color:'var(--teal)'}}>{busy?'Loading…':evidence?'Refresh call evidence':'View recording, transcript and scorecard'}</button>
    {error && <p role="alert" className="mt-2">{error}</p>}
    {evidence && !evidence.recordings?.length && <p className="mt-2">No verified recording is available yet.</p>}
    {evidence?.recordings?.map(recording=><div key={recording.id} className="mt-3 space-y-2">
      <p>Recording securely archived and backed up.</p>
      {downloads[recording.id]?.expiresAtMs>Date.now()
        ? <a href={downloads[recording.id].url} target="_blank" rel="noreferrer" className="touch-target inline-flex font-semibold hover:underline focus-ring" style={{color:'var(--teal)'}}>Download recording</a>
        : <button type="button" onClick={()=>download(recording.id)} disabled={busy} className="touch-target font-semibold hover:underline focus-ring disabled:opacity-50" style={{color:'var(--teal)'}}>Prepare secure download</button>}
      <p>Transcript: {String(recording.transcriptStatus || 'pending').replace(/_/g,' ')}</p>
      {recording.transcript && <details><summary className="cursor-pointer focus-ring">Read transcript</summary><p className="mt-2 whitespace-pre-wrap">{recording.transcript}</p></details>}
      <p>Scorecard: {recording.scorecard?.score!=null?`${recording.scorecard.score}/100`:'Pending review'} · {String(recording.scorecardStatus || 'pending').replace(/_/g,' ')}</p>
      {recording.scorecard && <details><summary className="cursor-pointer focus-ring">Review AI scorecard</summary><p className="my-2">AI assessment requires human review.</p>{recording.scorecard.items?.map(item=><div key={item.id} className="mb-3"><p className="font-semibold">{item.label}: {String(item.outcome).replace(/_/g,' ')}</p>{item.quote && <blockquote className="my-1 border-l-2 pl-2">“{item.quote}”</blockquote>}<p>{item.explanation}</p></div>)}</details>}
    </div>)}
  </div>;
}
