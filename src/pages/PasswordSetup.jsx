import { useEffect, useState } from 'react';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import '@/lib/firebaseClient';

export default function PasswordSetup() {
  const [code] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('code') || '');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState('checking'), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    window.history.replaceState(null, '', '/set-password');
    if (!code) { setStatus('invalid'); return; }
    verifyPasswordResetCode(getAuth(), code).then(value => { if (active) { setEmail(value); setStatus('ready'); } }).catch(() => { if (active) setStatus('invalid'); });
    return () => { active = false; };
  }, [code]);
  const save = async event => {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setStatus('saving');
    try { await confirmPasswordReset(getAuth(), code, password); setPassword(''); setConfirmation(''); setStatus('complete'); }
    catch (e) { setError(e.code === 'auth/weak-password' ? 'Please choose a stronger password that meets the account policy.' : 'This link could not be used. Request a new setup email from your GMS administrator.'); setStatus('ready'); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] p-5"><section className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-sm"><header className="border-t-4 border-[#C9A24B] bg-[#001922] p-8"><img src="/brand/gms-logo-horizontal-transparent.png" alt="Golden Marketing Services" className="w-60 max-w-full" /><p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#DEC687]">Personal account setup</p></header><div className="p-8"><h1 className="mb-3 text-3xl font-semibold text-[#001922]">Create your password.</h1>{status === 'checking' && <p role="status">Checking your personal setup link…</p>}{status === 'invalid' && <p role="alert">This link is missing, expired, or already used. Open your latest GMS setup email or ask your administrator to send a new one.</p>}{['ready','saving'].includes(status) && <form onSubmit={save} className="space-y-4"><p className="text-sm text-[#66777B]">Set a password for {email}. Your password is yours to choose and keep private.</p><div><label htmlFor="new-password" className="mb-1 block text-sm font-semibold">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border p-3" /><p className="mt-1 text-xs text-[#66777B]">Use at least 8 characters. Any additional account password requirements still apply.</p></div><div><label htmlFor="confirm-password" className="mb-1 block text-sm font-semibold">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="w-full rounded-lg border p-3" /></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={status === 'saving'} className="w-full rounded-lg bg-[#001922] p-3 font-semibold text-white disabled:opacity-50">{status === 'saving' ? 'Saving…' : 'Save my password'}</button></form>}{status === 'complete' && <div><p role="status" className="mb-5">Your password has been saved. Sign in using your registered email and the password you just chose.</p><a href="/login" className="inline-block rounded-lg bg-[#001922] px-5 py-3 font-semibold text-white">Sign in to my portal →</a></div>}<p className="mt-7 border-t pt-5 text-sm"><a className="text-[#14857F] underline" href="/getting-started.html">Quick-start guide: sign in and add your desktop app</a></p></div></section></main>;
}
