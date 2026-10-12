// Minimal service worker so the app can be installed to the home screen.
// Always fetches fresh from the network; customer data is never cached here.
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
