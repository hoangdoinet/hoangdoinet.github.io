/* service-worker.js — OFFLINE LOCKDOWN cho TÍNH CÂN LÚA */
const APP_VERSION  = 'can-lua-v1.0.1';       // 🔁 Bump khi phát hành
const CACHE_STATIC = `static-${APP_VERSION}`;

// Tự tính base path theo vị trí SW (ví dụ: /can-lua/)
const BASE = new URL(self.location.href).pathname.replace(/[^/]+$/, '');

// Tài nguyên cốt lõi cần có để offline/refresh hoạt động
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
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (_) { /* bỏ qua file thiếu để không fail install */ }
    }));
  })());
  self.skipWaiting();
});

// Cho phép client kích hoạt SW mới
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'CHECK_UPDATE_AND_RELOAD') {
    (async () => {
      try {
        await self.skipWaiting();
        const clis = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of clis) c.navigate(c.url);
      } catch (e) {}
    })();
  }
});

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch(_) {}
    }
    // dọn cache cũ
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Helpers
const isHTML = (req) => (req.headers.get('accept') || '').includes('text/html');

// ========== FETCH ==========
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const isNavigate = req.mode === 'navigate' || isHTML(req);

  // 1) App shell cho điều hướng/HTML: luôn có index.html từ cache
  if (isNavigate && isSameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);

      // Ưu tiên index.html trong cache
      const cached = await cache.match(BASE + 'index.html', { ignoreSearch: true });
      if (cached) {
        // Làm mới ngầm
        (async () => {
          try {
            const preload = await event.preloadResponse;
            const fresh = preload || await fetch(new Request(BASE + 'index.html', { cache: 'reload' }));
            if (fresh && fresh.ok) await cache.put(BASE + 'index.html', fresh.clone());
          } catch (_) {}
        })();
        return cached;
      }

      // Chưa có cache → thử mạng
      try {
        const preload = await event.preloadResponse;
        const fresh  = preload || await fetch(new Request(BASE + 'index.html', { cache: 'reload' }));
        if (fresh && fresh.ok) await cache.put(BASE + 'index.html', fresh.clone());
        return fresh;
      } catch {
        // Hoàn toàn offline & chưa có cache → trả offline.html
        const offline = await cache.match(BASE + 'offline.html');
        return offline || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 2) Static same-origin: cache-first + refresh ngầm
  if (isSameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) {
        // làm mới im lặng khi có mạng
        fetch(new Request(req, { cache: 'no-store' }))
          .then(res => { if (res && res.ok) cache.put(req, res.clone()); })
          .catch(() => {});
        return cached;
      }
      // chưa có trong cache → thử mạng & lưu
      try {
        const res = await fetch(new Request(req, { cache: 'no-store' }));
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        // im lặng khi thiếu
        return new Response('', { status: 204 });
      }
    })());
    return;
  }

  // 3) Cross-origin: để trình duyệt xử lý (network-first mặc định)
  // event.respondWith(fetch(req));
});