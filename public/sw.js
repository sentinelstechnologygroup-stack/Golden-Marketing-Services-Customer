// Network-only: never store CRM records, credentials, or portal pages offline.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' && new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => new Response(
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>GMS Portal</title><body><h1>You are offline</h1><p>Reconnect to the internet, then reload to open your portal.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )));
  }
});
