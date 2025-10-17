/* service-worker.js — OFFLINE LOCKDOWN */
const APP_VERSION  = 'lock-1.0.0';
const CACHE_STATIC = `static-${APP_VERSION}`;

const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

// 📦 Cài đặt: cache tất cả tài nguyên cần thiết
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(CACHE_ASSETS))
  );
  self.skipWaiting(); // kích hoạt ngay
});

// ♻️ Kích hoạt: dọn cache cũ khi cập nhật phiên bản
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
    );
  })());
  self.clients.claim();
});

/**
 * 🧠 Chiến lược:
 * - HTML (điều hướng): Luôn từ cache → mở app ngay cả khi repo bị xoá / hosting 404.
 * - Static (png, js, css): Cache-first, cập nhật ngầm khi có mạng.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // ✅ Trường hợp HTML (điều hướng)
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');
      return (
        cached ||
        new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><p style="font-family:system-ui">Ứng dụng đã được cài đặt offline.<br>Không thể tải nội dung mới vì máy chủ không khả dụng.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      );
    })());
    return;
  }

  // ✅ Static asset: cache-first + background refresh
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      // Cập nhật ngầm nếu online
      fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE_STATIC).then(c => c.put(req, res.clone()));
      }).catch(() => {});
      return cached;
    }

    // Nếu chưa có trong cache → cố gắng tải online
    try {
      const res = await fetch(req);
      caches.open(CACHE_STATIC).then(c => c.put(req, res.clone()));
      return res;
    } catch {
      // Nếu cả cache lẫn mạng đều không có
      return new Response('', { status: 204 });
    }
  })());
});