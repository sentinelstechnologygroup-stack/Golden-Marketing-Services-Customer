import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { initializeTracking, readConsent, saveConsent, trackPage } from '../lib/campaignTracking';
import './campaign-consent.css';

export default function CampaignConsent() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [choice, setChoice] = useState({ analytics: false, ads: false });
  const gpc = typeof navigator !== 'undefined' && /** @type {any} */ (navigator).globalPrivacyControl === true;
  useEffect(() => {
    initializeTracking();const openSettings=()=>{setSettings(true);setOpen(true);};window.addEventListener('gms-cookie-settings',openSettings);
    const saved = readConsent();
    if (saved) setChoice(saved);
    setOpen(!saved);return()=>window.removeEventListener('gms-cookie-settings',openSettings);
  }, []);
  useEffect(() => { trackPage(); }, [location.pathname]);
  const save = (value) => {
    const consent = saveConsent(value);
    setChoice(consent || value);
    setOpen(false);
    setSettings(false);
    trackPage();
  };
  return <>

    {open && <section className="privacy-panel" aria-label="Cookie preferences">
      <div className="privacy-copy">
        <strong>{settings ? 'Cookie settings' : 'We use cookies'}</strong>
        <p>We use essential cookies to make this site work. With your permission, we also use cookies to understand site usage and measure our marketing. <a href="/privacy">Privacy policy</a></p>
        {settings && <div className="privacy-options">
          <label><input type="checkbox" checked={choice.analytics} onChange={e => setChoice({ ...choice, analytics: e.target.checked })} /> Analytics cookies</label>
          <label><input type="checkbox" disabled={gpc} checked={choice.ads && !gpc} onChange={e => setChoice({ ...choice, ads: e.target.checked })} /> Marketing cookies</label>
          {gpc && <p>Your browser’s privacy preference keeps marketing cookies off.</p>}
        </div>}
      </div>
      <div className="privacy-actions">
        <button onClick={() => save({ analytics: false, ads: false })}>Reject optional</button>
        {settings ? <button onClick={() => save(choice)}>Save preferences</button> : <button onClick={() => setSettings(true)}>Cookie settings</button>}
        <button className="privacy-accept" onClick={() => save({ analytics: true, ads: !gpc })}>Accept all</button>
      </div>
    </section>}
  </>;
}
