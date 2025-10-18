/* service-worker.js — OFFLINE LOCKDOWN (GH Pages friendly) */
const APP_VERSION  = 'lock-1.0.1';
const CACHE_STATIC = `static-${APP_VERSION}`;

// Tự tính base path theo vị trí SW (hợp với GitHub Pages subpath)
const BASE = new URL(self.location.href).pathname.replace(/[^/]+$/, ''); // ví dụ: /pha-thuoc/

// Các tài nguyên cốt lõi (dùng đường dẫn tuyệt đối theo BASE cho chắc)
const CORE = [
  '',                // thư mục
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
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
    // addAll sẽ fail nguyên lô nếu thiếu 1 file ⇒ dùng từng request + reload
    await Promise.all(CORE.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (_) {
        // Bỏ qua file thiếu để không chặn install (tránh “atomic fail”)
      }
    }));
  })());
  self.skipWaiting(); // cho SW mới kích hoạt ngay
});

// Cho phép client chủ động kích hoạt SW mới (từ code: navigator.serviceWorker.controller.postMessage('SKIP_WAITING'))
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// (Tuỳ chọn) Bật Navigation Preload cho tốc độ tốt hơn
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch(_) {}
    }
    // Dọn cache cũ
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ========== CHIẾN LƯỢC ==========
/**
 * - Điều hướng (HTML): luôn trả index.html từ cache (App Shell) ⇒ mở app ngay cả khi 404/đứt mạng.
 * - Tài nguyên same-origin (png/css/js): cache-first + làm mới ngầm (stale-while-revalidate).
 * - Cross-origin/CDN: bỏ qua (trả thẳng mạng); nếu cần có thể thêm nhánh SWR riêng.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;

  // 1) HTML / điều hướng
  const isNavigate = req.mode === 'navigate' ||
                     (req.headers.get('accept') || '').includes('text/html');

  if (isNavigate) {
    event.respondWith((async () => {
      // Dùng preload nếu sẵn có
      const preload = await event.preloadResponse;
      if (preload) return preload;

      // Luôn cố lấy index.html từ cache (App Shell)
      const cached = await caches.match(BASE + 'index.html', { ignoreSearch: true });
      if (cached) return cached;

      // Fallback tối giản nếu cache chưa có
      return new Response(
        '<!doctype html><meta charset="utf-8">' +
        '<title>Offline</title>' +
        '<p style="font-family:system-ui">Ứng dụng đã được cài đặt offline.<br>' +
        'Không thể tải nội dung mới do máy chủ không khả dụng.</p>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })());
    return;
  }

  // 2) Static same-origin: cache-first + refresh ngầm
  if (isSameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) {
        // Làm mới im lặng
        fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
        }).catch(() => {});
        return cached;
      }
      // Chưa có cache ⇒ thử mạng và lưu
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

  // 3) Cross-origin: để mặc định (network-first), tránh cache nhầm tài nguyên bên ngoài
  // event.respondWith(fetch(req)); // (không bắt buộc, có thể bỏ vì default là vậy)
});