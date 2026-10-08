import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isStandalone, requestDesktopInstall } from '@/lib/desktopApp';

export default function DesktopInstallButton() {
  const [installed, setInstalled] = useState(isStandalone);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => setInstalled(true);
    window.addEventListener('appinstalled', update);
    return () => window.removeEventListener('appinstalled', update);
  }, []);
  if (installed) return null;
  const install = async () => {
    setBusy(true);
    try {
      if (!await requestDesktopInstall()) setInstructions(true);
    } catch { setInstructions(true); }
    finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={install} disabled={busy} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#001922]/15 bg-white px-3 py-2 text-xs font-semibold text-[#001922] shadow-sm hover:bg-[#F7F1E6]" aria-label="Install desktop app">
      <Download size={16} /><span>{busy ? 'Opening…' : 'Install app'}</span>
    </button>
    <Dialog open={instructions} onOpenChange={setInstructions}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Open your portal from your desktop</DialogTitle></DialogHeader>
        <p className="text-sm">Open this portal directly in Chrome or Edge to install it as an app. Your desktop shortcut opens this portal in its own window.</p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li><strong>Chrome:</strong> Open the three-dot menu, then Cast, save, and share → Install page as app.</li>
          <li><strong>Edge:</strong> Open the three-dot menu, then Apps → Install this site as an app.</li>
          <li><strong>iPhone or iPad:</strong> Open in Safari, tap Share, then Add to Home Screen.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Already installed? Open it from your browser’s Apps list and pin it to your taskbar or create a desktop shortcut. You still sign in with your own account.</p>
      </DialogContent>
    </Dialog>
  </>;
}
