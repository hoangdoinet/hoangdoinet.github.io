/* service-worker.js — OFFLINE LOCKDOWN
const APP_VERSION  = 'lock-1.0.4';
const CACHE_STATIC = `static-${APP_VERSION}`;

// Tự tính base path theo vị trí SW
const BASE = new URL(self.location.href).pathname.replace(/[^/]+$/, ''); // ví dụ: /pha-thuoc/

// Các tài nguyên cốt lõi
const CORE = [
  '',                 // thư mục
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'icons/icon-96.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-1024.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png'
].map(p => BASE + p);

// ========== CÀI ĐẶT ==========
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    // Tránh "atomic fail": add từng file, bỏ qua file thiếu
    await Promise.all(CORE.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (_) { /* bỏ qua để không chặn install */ }
    }));
  })());
  self.skipWaiting(); // cho SW mới kích hoạt ngay
});

// Cho phép client chủ động kích hoạt SW mới
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// (Tuỳ chọn) Bật Navigation Preload và dọn cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch(_) {}
    }
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/**
 * - Điều hướng (HTML): App Shell → luôn trả index.html từ cache để đảm bảo offline;
 *   đồng thời nếu có mạng thì tải mới và cập nhật cache ngầm.
 * - Static same-origin (png/css/js): cache-first + refresh ngầm (SWR).
 * - Cross-origin: để mặc định (network-first).
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const acceptsHTML = (req.headers.get('accept') || '').includes('text/html');
  const isNavigate = req.mode === 'navigate' || acceptsHTML;

  // 1) HTML / điều hướng (App Shell)
  if (isNavigate) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);

      // A. ưu tiên index.html từ cache (bỏ qua query)
      const cached = await cache.match(BASE + 'index.html', { ignoreSearch: true });
      if (cached) {
        // B. làm mới trong nền nếu có mạng (preload hoặc fetch)
        (async () => {
          try {
            const preload = await event.preloadResponse;
            const fresh = preload || await fetch(new Request(BASE + 'index.html', { cache: 'reload' }));
            if (fresh && fresh.ok) await cache.put(BASE + 'index.html', fresh.clone());
          } catch (_) { /* im lặng */ }
        })();
        return cached;
      }

      // C. chưa có cache ⇒ thử mạng, rồi lưu để lần sau offline vẫn chạy
      try {
        const preload = await event.preloadResponse;
        const netRes  = preload || await fetch(new Request(BASE + 'index.html', { cache: 'reload' }));
        if (netRes && netRes.ok) await cache.put(BASE + 'index.html', netRes.clone());
        return netRes;
      } catch {
        // D. hoàn toàn offline & chưa có cache
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="font-family:system-ui;padding:24px;line-height:1.5">' +
          '<h1>🔌 Không có mạng</h1>' +
          '<p>Ứng dụng chưa có dữ liệu trong bộ nhớ. ' +
          'Hãy kết nối Internet và mở lại một lần để dùng được offline về sau.</p>' +
          '</body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // 2) Static same-origin: cache-first + refresh ngầm
  if (isSameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) {
        // Làm mới im lặng khi có mạng
        fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
        }).catch(() => {});
        return cached;
      }
      // Chưa có trong cache → thử mạng và lưu
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        // Không có cache & mạng: trả 204 để im lặng
        return new Response('', { status: 204 });
      }
    })());
    return;
  }

  // 3) Cross-origin: để mặc định (network-first)
  // event.respondWith(fetch(req));
});