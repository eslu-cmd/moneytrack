const CACHE = 'vault-v3';

const PRECACHE = [
  './',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }))
  );
});

// Periodic background sync — fires once a day on installed PWAs (Chrome/Edge)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'vault-daily-nudge') {
    e.waitUntil(checkIdleAndNotify());
  }
});

async function checkIdleAndNotify() {
  // Read lastTxAt from cache-stored db snapshot
  const cache = await caches.open(CACHE);
  const resp = await cache.match('vault-db');
  if (!resp) return;
  try {
    const db = await resp.json();
    const last = db?.settings?.lastTxAt;
    if (!last) return;
    if (Date.now() - new Date(last).getTime() > 23 * 3600 * 1000) {
      self.registration.showNotification('Vault — log today\'s transactions', {
        body: 'You haven\'t logged anything in over 24 hours. Keep your data current.',
        icon: './icon-192.png',
        badge: './icon-96.png',
        tag: 'vault-idle',
        renotify: false,
      });
    }
  } catch {}
}
