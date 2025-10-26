/* service-worker.js — OFFLINE LOCKDOWN cho TÍNH CÂN LÚA */
const APP_VERSION  = 'can-lua-v1.0.2';
const CACHE_STATIC = `static-${APP_VERSION}`;

// Xác định base path (ví dụ: /can-lua/)
const BASE = new URL(self.location.href).pathname.replace(/[^/]+$/, '');

// Danh sách file cốt lõi
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
  // ❌ Không skipWaiting — đợi người dùng xác nhận từ index.html
});

// ========== MESSAGE ==========
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    try { self.skipWaiting(); } catch (_) {}
  }
});

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch(_) {}
    }
    // Xóa cache cũ
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
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
  const isNavigate = req.mode === 'navigate' || isHTML(req);

  // 1️⃣ HTML (App Shell)
  if (isNavigate && isSameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(BASE + 'index.html', { ignoreSearch: true });
      if (cached) {
        // Làm mới ngầm
        (async () => {
          try {
            const preload = await event.preloadResponse;
            const fresh = preload || await fetch(new Request(BASE + 'index.html', { cache: 'reload' }));
            if (fresh?.ok) await cache.put(BASE + 'index.html', fresh.clone());
          } catch (_) {}
        })();
        return cached;
      }
      try {
        const preload = await event.preloadResponse;
        const fresh = preload || await fetch(new Request(BASE + 'index.html', { cache: 'reload' }));
        if (fresh?.ok) await cache.put(BASE + 'index.html', fresh.clone());
        return fresh;
      } catch {
        const offline = await cache.match(BASE + 'offline.html');
        return offline || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 2️⃣ Static same-origin
  if (isSameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) {
        // Làm mới ngầm khi có mạng
        fetch(new Request(req, { cache: 'no-store' }))
          .then(res => { if (res?.ok) cache.put(req, res.clone()); })
          .catch(() => {});
        return cached;
      }
      // Nếu chưa có cache → tải và lưu
      try {
        const res = await fetch(new Request(req, { cache: 'no-store' }));
        if (res?.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 204 });
      }
    })());
    return; // ✅ thêm return để dừng đúng luồng
  }
});