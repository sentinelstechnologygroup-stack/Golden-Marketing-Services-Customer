import { useState } from 'react';
import accountClient from '@/services/portalAdapter';

export default function InitialPasswordChange() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      await accountClient.auth.completeInitialPasswordChange(password);
      setPassword(''); setConfirm(''); setDone(true);
    } catch (failure) { setError(failure.message || 'Unable to update your password.'); }
    finally { setBusy(false); }
  }
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: '#0B1F33' }}>
      <section className="w-full max-w-md rounded-2xl p-8 shadow-xl" style={{ background: '#F8F6EF', color: '#0B1F33' }}>
        <p className="text-xs tracking-widest mb-4">GOLDEN MARKETING SERVICES</p>
        <h1 className="text-2xl font-semibold mb-3">{done ? 'Password changed' : 'Change your temporary password'}</h1>
        <p className="text-sm mb-6">{done ? 'Your administrator access is ready in both portals. Sign in again using your new password.' : 'Choose your own password before accessing either dashboard. This changes the password for both portals.'}</p>
        {done ? <a className="underline" href="/login">Sign in with your new password</a> : (
          <form onSubmit={submit} className="space-y-4">
            <div><label htmlFor="initial-new-password" className="block text-sm mb-2">New password</label>
              <input id="initial-new-password" className="w-full rounded-lg border p-3" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} aria-describedby="password-requirements" /></div>
            <p id="password-requirements" className="text-xs">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
            <div><label htmlFor="initial-confirm-password" className="block text-sm mb-2">Confirm new password</label>
              <input id="initial-confirm-password" className="w-full rounded-lg border p-3" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={(event) => setConfirm(event.target.value)} disabled={busy} /></div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button className="w-full rounded-lg p-3 font-semibold disabled:opacity-60" style={{ background: '#D4AF37' }} disabled={busy} type="submit">{busy ? 'Updating…' : 'Change password'}</button>
            <a className="block text-sm underline" href="/login">Return to sign-in</a>
          </form>
        )}
      </section>
    </main>
  );
}
