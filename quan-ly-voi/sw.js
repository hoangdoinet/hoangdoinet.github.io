const CACHE_NAME = 'voi-pro-v1';
// Danh sách các file cần lưu để chạy offline
const ASSETS = [
  '/quan-ly-voi/',
  '/quan-ly-voi/index.html',
  '/quan-ly-voi/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// 1. Cài đặt Service Worker và lưu tài nguyên
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Kích hoạt và dọn dẹp cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// 3. Chiến lược: Ưu tiên lấy từ Cache, nếu không có mới tải từ mạng
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
