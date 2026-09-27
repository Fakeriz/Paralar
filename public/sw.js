// Paralar service worker — offline support beneran.
// Strategi:
// - Install: precache app shell (halaman /, manifest, ikon)
// - Navigasi: network-first, fallback ke cache '/' saat offline
// - Aset Next.js (/_next/static): cache-first (hash di nama file = aman)
// - Aset lain: stale-while-revalidate
// - API (/api/*): selalu network-only (data jangan di-cache)

const VERSION = 'paralar-v1';

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // jangan gagal install kalau satu aset miss
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (!response || response.status !== 200) return;
  const copy = response.clone();
  caches.open(VERSION).then((cache) => cache.put(request, copy));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API: network-only

  // 1. Navigasi halaman -> network-first, fallback offline ke '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          putInCache('/', res);
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 2. Aset static Next.js -> cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            putInCache(request, res);
            return res;
          })
      )
    );
    return;
  }

  // 3. Sisanya -> stale-while-revalidate
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          putInCache(request, res);
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
