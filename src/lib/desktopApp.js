let installPrompt = null;
export function initializeDesktopApp() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    window.dispatchEvent(new Event('gms-install-ready'));
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    window.dispatchEvent(new Event('gms-install-ready'));
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    }, { once: true });
  }
}
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
export async function requestDesktopInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  await prompt.userChoice;
  return true;
}
