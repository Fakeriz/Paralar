// Paralar service worker — offline support beneran.
// Strategi:
// - Install: precache app shell (halaman /, manifest, ikon)
// - Navigasi: network-first, fallback ke cache '/' saat offline
// - Aset Next.js (/_next/static): cache-first (hash di nama file = aman)
// - Aset lain: stale-while-revalidate
// - API (/api/*): selalu network-only (data jangan di-cache)

const VERSION = 'paralar-v3';

// Cache khusus untuk Web Share Target: menampung file gambar yang di-share
// dari aplikasi lain. Terpisah dari cache app shell agar tidak ikut terhapus
// saat versi SW diperbarui.
const SHARE_CACHE = 'paralar-share-v1';
const SHARE_KEY = '/__paralar_shared_receipt__';

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
        Promise.all(keys.filter((k) => k !== VERSION && k !== SHARE_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (!response || response.status !== 200) return;
  const copy = response.clone();
  caches.open(VERSION).then((cache) => cache.put(request, copy));
}

async function handleShareTarget(request) {
  const done = (location) =>
    Response.redirect(new URL(location, self.location.origin).href, 303);
  // Penanda diagnosis: catat setiap share yang dicegat SW agar bisa dibaca
  // halaman lewat ?swinfo=1.
  const dbg = { at: new Date().toISOString(), hadFile: false, size: 0, cached: false, error: null };
  try {
    const form = await request.formData();
    const file = form.get('receipt');
    dbg.hadFile = !!(file && file.size > 0);
    dbg.size = file && file.size > 0 ? file.size : 0;
    if (file && file.size > 0 && file.size <= 25 * 1024 * 1024) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARE_KEY,
        new Response(file, {
          headers: { 'Content-Type': file.type || 'image/jpeg' },
        })
      );
      dbg.cached = true;
    }
  } catch (e) {
    dbg.error = String((e && e.message) || e);
  }
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(
      '__share_debug__',
      new Response(JSON.stringify(dbg), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (e) {
    // Abaikan: page.js akan membuka sheet scan kosong sebagai fallback.
  }
  return done('/?sharedReceipt=1');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Web Share Target: cegat POST /share langsung di service worker.
  // File gambar dibaca di perangkat dan disimpan ke Cache Storage — tidak
  // dikirim ke server, jadi tidak kena limit ukuran upload serverless (±4.5MB).
  // Lalu redirect (303) ke aplikasi dengan flag ?sharedReceipt=1.
  if (
    request.method === 'POST' &&
    url.origin === self.location.origin &&
    url.pathname === '/share'
  ) {
    event.respondWith(handleShareTarget(request));
    return;
  }

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
