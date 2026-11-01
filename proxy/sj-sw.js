if (navigator.userAgent.includes('Firefox')) Object.defineProperty(globalThis, 'crossOriginIsolated', { value: true, writable: false });
importScripts('scramjet/scramjet.all.js');
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
async function handle(e) {
  await scramjet.loadConfig();
  return scramjet.route(e) ? scramjet.fetch(e) : fetch(e.request);
}
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith(handle(e)));
