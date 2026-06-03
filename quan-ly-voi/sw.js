/* sw.js - v1.0.4 */
const APP_VERSION = 'v1.0.4';
const CACHE_STATIC = `voi-qt-${APP_VERSION}`;

// Tự động lấy đường dẫn gốc của app dựa trên vị trí file sw.js
const BASE = new URL('./', self.location).pathname; 
const VERSION_FILE = BASE + 'version.json';

// Danh sách các file bắt buộc để app chạy Offline 100%
const CRITICAL_ASSETS = [
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'version.json',
  BASE + 'libs/tailwind.min.js',
  BASE + 'libs/lucide.min.js'
];

console.log(`[SW ${APP_VERSION}] 🚀 Khởi động - OFFLINE 100% GUARANTEED`);

// ========== TIỆN ÍCH GỬI MESSAGE ==========
async function broadcastMessage(payload) {
  try {
    const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
    clientsList.forEach(client => {
      try { client.postMessage(payload); } catch {}
    });
  } catch {}
}

// ========== CACHE VỚI RETRY ==========
async function cacheWithRetry(cache, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await cache.add(url);
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        try {
          const response = await fetch(url, { cache: 'no-store' });
          if (response.ok) {
            await cache.put(url, response.clone());
            return true;
          }
        } catch {}
        return false;
      }
      await new Promise(r => setTimeout(r, 800 * attempt));
    }
  }
  return false;
}

// ========== VERIFY ==========
async function verifyCriticalAssets(cache) {
  const cachedItems = await cache.keys();
  const must = [
    BASE + 'index.html',
    BASE + 'libs/tailwind.min.js',
    BASE + 'libs/lucide.min.js'
  ];
  
  const hasMinimal = must.every(a => cachedItems.some(i => new URL(i.url).pathname === a));
  console.log(`[SW] 🔍 Minimal assets = ${hasMinimal ? '✅' : '❌'}`);
  return hasMinimal;
}

// ========== CÀI ĐẶT ==========
self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Đang cài đặt - ĐẢM BẢO OFFLINE 100%...');
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    const results = { success: [], failed: [] };

    // Cache index trước (quan trọng nhất)
    const indexSuccess = await cacheWithRetry(cache, BASE + 'index.html', 3);
    if (!indexSuccess) console.error('[SW] 💥 CRITICAL FAIL: Không thể cache index.html');

    // Cache các asset còn lại
    for (const url of CRITICAL_ASSETS.filter(a => a !== BASE + 'index.html')) {
      const ok = await cacheWithRetry(cache, url, 2);
      (ok ? results.success : results.failed).push(url);
    }

    console.log(`[SW] ✅ Thành công: ${results.success.length}/${CRITICAL_ASSETS.length}`);
    if (results.failed.length) console.error('[SW] ❌ Lỗi cache:', results.failed);

    const okMinimal = await verifyCriticalAssets(cache);

    if (okMinimal) {
      console.log('[SW] 🎉 Sẵn sàng OFFLINE 100% sau lần tải đầu tiên');
      self.skipWaiting();
    } else {
      console.error('[SW] 🚨 Thiếu asset tối thiểu → KHÔNG skipWaiting để tránh SW lỗi lên active');
    }
  })());
});

// ========== CHECK UPDATE ==========
async function checkForUpdates() {
  try {
    const res = await fetch(VERSION_FILE + '?t=' + Date.now(), { cache: 'no-cache' });

    if (!res.ok) {
      console.log('[SW] 🌐 Không đọc được version.json (HTTP ' + res.status + ')');
      await broadcastMessage({ type: 'UPDATE_ERROR', reason: 'HTTP_STATUS', status: res.status });
      return;
    }

    let json;
    try {
      json = await res.json();
    } catch (eJson) {
      console.log('[SW] 🌐 Lỗi phân tích JSON version.json:', eJson?.message || eJson);
      await broadcastMessage({ type: 'UPDATE_ERROR', reason: 'INVALID_JSON' });
      return;
    }

    let latestVersion = json.version || null;

    if (!latestVersion) {
      console.log('[SW] ℹ️ Không tìm được phiên bản mới nhất trong version.json.');
      await broadcastMessage({ type: 'UPDATE_ERROR', reason: 'INVALID_JSON' });
      return;
    }

    const cmp = compareVersions(latestVersion, APP_VERSION);
    if (cmp > 0) {
      console.log(`[SW] 🔔 Có bản mới: ${APP_VERSION} → ${latestVersion}`);
      await broadcastMessage({ type: 'UPDATE_AVAILABLE', version: latestVersion, currentVersion: APP_VERSION });
    } else {
      console.log('[SW] ✅ Đang ở phiên bản mới nhất.');
      await broadcastMessage({ type: 'NO_UPDATE', version: latestVersion, currentVersion: APP_VERSION });
    }
  } catch (e) {
    console.log('[SW] 🌐 Lỗi check update:', e?.message || e);
    await broadcastMessage({ type: 'UPDATE_ERROR', reason: 'NETWORK_ERROR' });
  }
}

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] 🎯 Kích hoạt - DỌN CACHE CŨ & XÁC MINH OFFLINE...');
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch {}
    }

    // Xoá cache cũ
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('voi-qt-') && k !== CACHE_STATIC).map(k => caches.delete(k))
    );

    await self.clients.claim();

    const cache = await caches.open(CACHE_STATIC);
    const items = await cache.keys();
    console.log(`[SW] 📊 Sau kích hoạt: ${items.length} items trong cache`);

    const critical = [BASE + 'index.html', BASE + 'libs/tailwind.min.js', BASE + 'libs/lucide.min.js'];
    const missing = critical.filter(a => !items.some(i => new URL(i.url).pathname === a));
    
    if (missing.length) {
      console.log('[SW] 🧩 Thiếu asset quan trọng, thử cache bổ sung:', missing);
      await cacheMissingCritical(cache, missing);
    }

    console.log('[SW] ✅ Kích hoạt xong.');
  })());
});

async function cacheMissingCritical(cache, missingAssets) {
  for (const a of missingAssets) {
    try {
      const res = await fetch(a, { cache: 'no-store' });
      if (res.ok) await cache.put(a, res.clone());
    } catch {}
  }
}

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map(Number);
  const pb = String(b).replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ========== FETCH (OFFLINE FIRST) ==========
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Chỉ xử lý trong scope của thư mục app
  if (!url.pathname.startsWith(BASE)) return;

  // Xử lý riêng cho version.json
  if (url.pathname === VERSION_FILE) {
    event.respondWith(handleVersionJsonRequest(req));
    return;
  }

  const isNavigation = req.mode === 'navigate';
  if (isNavigation) {
    event.respondWith(handleNavigationRequest());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticRequest(req));
  }
});

async function handleNavigationRequest() {
  try {
    const cache = await caches.open(CACHE_STATIC);
    const cached = await cache.match(BASE + 'index.html', { ignoreSearch: true });
    if (cached) return cached;

    try {
      const net = await fetch(BASE + 'index.html', { cache: 'no-store' });
      if (net.ok) {
        await cache.put(BASE + 'index.html', net.clone());
        return net;
      }
    } catch {}

    return createOfflinePage();
  } catch {
    return createOfflinePage();
  }
}

async function handleVersionJsonRequest(request) {
  const cache = await caches.open(CACHE_STATIC);
  try {
    const net = await fetch(request, { cache: 'no-store' });
    if (net && net.ok) {
      await cache.put(VERSION_FILE, net.clone());
      return net;
    }
  } catch {}

  const cached = await cache.match(VERSION_FILE, { ignoreSearch: true });
  if (cached) return cached;

  return new Response(
    JSON.stringify({ version: APP_VERSION }),
    { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const net = await fetch(request, { cache: 'no-store' });
    if (net.ok) {
      await cache.put(request, net.clone());
      return net;
    }
  } catch {}
  
  return new Response('Offline & not cached', { status: 404 });
}

function createOfflinePage() {
  return new Response(
`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <title>Quản lý Vôi - Offline</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f3f4f6; color: #1f2937; margin: 0; padding: 40px 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.5; }
    .container { max-width: 420px; background: white; padding: 40px; border-radius: 2rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    h1 { color: #0f766e; margin-bottom: 1rem; font-weight: 900; }
    p { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    button { background: #0f766e; color: #fff; border: none; padding: 16px 32px; border-radius: 16px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; transition: all 0.2s; }
    button:active { transform: scale(0.95); }
  </style>
</head>
<body>
  <div class="container">
    <svg style="width:64px;height:64px;color:#9ca3af;margin:0 auto 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"></path></svg>
    <h1>Đang ngoại tuyến</h1>
    <p>Không tìm thấy dữ liệu nền. Ứng dụng cần kết nối internet để tải tài nguyên trong lần đầu tiên truy cập.</p>
    <button onclick="location.reload()">Thử lại ngay</button>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }
  );
}

// ========== MESSAGE (TƯƠNG TÁC VỚI TRANG) ==========
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'CHECK_UPDATE') checkForUpdates();
  if (type === 'FORCE_UPDATE') self.skipWaiting();
});

console.log(`[SW ${APP_VERSION}] ✅ Đã tải - Sẵn sàng phục vụ kho Vôi`);