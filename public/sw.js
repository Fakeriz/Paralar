// Paralar service worker — offline support beneran.
// Strategi:
// - Install: precache app shell (halaman /, manifest, ikon)
// - Navigasi: network-first, fallback ke cache '/' saat offline
// - Aset Next.js (/_next/static): cache-first (hash di nama file = aman)
// - Aset lain: stale-while-revalidate
// - API (/api/*): selalu network-only (data jangan di-cache)

const VERSION = 'paralar-v7';

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
  const dbg = { at: new Date().toISOString(), hadFile: false, size: 0, cached: false, error: null, fields: [] };
  // Header mentah untuk diagnosis: apakah Chrome benar-benar mengirim body?
  try {
    dbg.contentType = request.headers.get('content-type') || '(tidak ada)';
    dbg.contentLength = request.headers.get('content-length') || '(tidak ada)';
    const raw = await request.clone().arrayBuffer();
    dbg.rawBytes = raw.byteLength;
  } catch (e) {
    dbg.headerError = String((e && e.message) || e);
  }
  try {
    const form = await request.formData();
    // Catat semua field untuk diagnosis (nama, jenis, ukuran).
    try {
      for (const [name, value] of form.entries()) {
        if (typeof value === 'string') {
          dbg.fields.push({ name, kind: 'text', len: value.length, preview: value.slice(0, 60) });
        } else {
          dbg.fields.push({ name, kind: 'file', type: value.type || '?', size: value.size || 0, fname: value.name || '?' });
        }
      }
    } catch (e) {}
    let file = form.get('receipt');
    // Fallback: kalau field 'receipt' kosong, ambil file gambar apapun yang ada.
    if (!(file && typeof file !== 'string' && file.size > 0)) {
      for (const [, value] of form.entries()) {
        if (value && typeof value !== 'string' && value.size > 0 &&
            String(value.type || '').startsWith('image/')) {
          file = value;
          dbg.fallbackField = true;
          break;
        }
      }
    }
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
  // Catat diagnosis ke Cache Storage (dibaca via ?swinfo=1).
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(
      '__share_debug__',
      new Response(JSON.stringify(dbg), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (e) {}
  // Halaman perantara: Chrome menampilkan response POST tapi tidak mengikuti
  // redirect 303 dengan benar, jadi kita redirect sendiri via JavaScript
  // (instant) ke aplikasi dengan flag ?sharedReceipt=1.
  const bridgeHtml = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#09090b"><title>Paralar</title>
<script>location.replace("/?sharedReceipt=1");</script></head>
<body style="margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#09090b;color:#fff;font-family:system-ui,sans-serif;gap:12px">
<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="4" width="40" height="40" rx="12" stroke="#fff" stroke-width="3"/><path d="M17 30V18h8a6 6 0 0 1 0 12h-8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
<p style="margin:0;font-size:15px;opacity:.85">Menerima gambar struk&hellip;</p>
<noscript><a href="/?sharedReceipt=1" style="color:#fff">Buka Paralar</a></noscript>
</body></html>`;
  return new Response(bridgeHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Web Share Target: cegat POST /share langsung di service worker.
  // File gambar dibaca di perangkat dan disimpan ke Cache Storage — tidak
  // dikirim ke server, jadi tidak kena limit ukuran upload serverless (±4.5MB).
  // Response-nya halaman perantara yang redirect sendiri via JS ke
  // /?sharedReceipt=1 (Chrome tidak mengikuti redirect 303 dari SW).
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
