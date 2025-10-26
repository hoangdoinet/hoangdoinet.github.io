/* service-worker.js — NO-SILENT-UPDATE for TÍNH CÂN LÚA */
const APP_VERSION  = 'can-lua-v1.0.3';
const CACHE_STATIC = `static-${APP_VERSION}`;

// Xác định base path (ví dụ: /can-lua/)
const BASE = new URL(self.location.href).pathname.replace(/[^/]+$/, '');

// Danh sách file cốt lõi (app shell)
const CORE = [
  '',
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'service-worker.js',
  'icons/icon-96.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-1024.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
].map(p => BASE + p);

// ========== INSTALL ==========
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    await Promise.all(CORE.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (_) { /* bỏ qua file lỗi */ }
    }));
  })());
  // ❌ KHÔNG skipWaiting — đợi người dùng xác nhận từ app
});

// ========== MESSAGE ==========
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    try { self.skipWaiting(); } catch (_) {}
  }
  if (event.data.type === 'CLIENTS_CLAIM') {
    try { self.clients.claim(); } catch (_) {}
  }
});

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // ❌ KHÔNG bật navigationPreload để tránh “tươi” ngầm
    // Dọn cache cũ chỉ khi SW này trở thành active
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
    );
    // ❌ KHÔNG clients.claim() tự động — chỉ claim khi người dùng cho phép
  })());
});

// Helper
const isHTML = (req) => (req.headers.get('accept') || '').includes('text/html');

// ========== FETCH ==========
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;

  // 🚫 Luôn bỏ qua SW cho version.json → NetworkOnly, no-store
  if (isSameOrigin && url.pathname === BASE + 'version.json') {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 1️⃣ HTML (App Shell) — CACHE FIRST, KHÔNG revalidate ngầm
  if (isSameOrigin && (req.mode === 'navigate' || isHTML(req))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(BASE + 'index.html', { ignoreSearch: true });
      if (cached) return cached;

      try {
        const fresh = await fetch(new Request(BASE + 'index.html', { cache: 'reload' }));
        if (fresh?.ok) await cache.put(BASE + 'index.html', fresh.clone());
        return fresh;
      } catch {
        const offline = await cache.match(BASE + 'offline.html');
        return offline || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 2️⃣ Static same-origin — CACHE FIRST, KHÔNG refresh ngầm
  if (isSameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const res = await fetch(new Request(req, { cache: 'no-store' }));
        if (res?.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 204 });
      }
    })());
    return;
  }

  // 3️⃣ Ngoài origin: để mặc định trình duyệt xử lý
});