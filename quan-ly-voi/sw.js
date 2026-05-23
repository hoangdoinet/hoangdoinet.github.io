const CACHE_NAME = 'voi-pro-v3';

// Tối ưu danh sách tài nguyên cần lưu trữ
const ASSETS = [
  '/quan-ly-voi/',
  '/quan-ly-voi/index.html',
  '/quan-ly-voi/manifest.json',
  '/quan-ly-voi/libs/tailwind.min.js',
  '/quan-ly-voi/libs/lucide.min.js',
  // Thêm các icon quan trọng nhất để hiển thị offline
  '/quan-ly-voi/icons/icon-192.png',
  '/quan-ly-voi/icons/icon-512.png',
  '/quan-ly-voi/icons/maskable-192.png',
  '/quan-ly-voi/icons/maskable-512.png'
];

// 1. Cài đặt Service Worker và lưu tài nguyên
self.addEventListener('install', (event) => {
  // force SW kích hoạt ngay lập tức không cần chờ đóng tab
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Vôi QT: Đang lưu trữ tài nguyên hệ thống...');
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
  // Kiểm soát các client ngay lập tức
  return self.clients.claim();
});

// 3. Chiến lược: Ưu tiên lấy từ Cache (Cache First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Trả về từ cache nếu có, ngược lại đi tải từ mạng
      return cachedResponse || fetch(event.request).catch(() => {
        // Có thể thêm trang fallback offline ở đây nếu muốn
      });
    })
  );
});
