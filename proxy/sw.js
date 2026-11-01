importScripts('portal/uv.bundle.js', 'portal/uv.config.js', 'portal/uv.sw.js');
const uv = new UVServiceWorker();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { if (uv.route(e)) e.respondWith(uv.fetch(e)); });
