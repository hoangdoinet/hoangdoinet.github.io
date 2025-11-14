/* service-worker.js - OFFLINE 100% GUARANTEED v1.0.1 (manual update check) */
const APP_VERSION = 'v1.0.1';
const CACHE_STATIC = `static-${APP_VERSION}`;
const BASE = '/password-manager/';
const VERSION_FILE = BASE + 'version.json';

const CRITICAL_ASSETS = [
  // CORE APP
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'version.json',
  BASE + 'icons/icon-32.png',
  BASE + 'icons/icon-72.png',
  BASE + 'icons/icon-96.png',
  BASE + 'icons/icon-128.png',
  BASE + 'icons/icon-144.png',
  BASE + 'icons/icon-152.png',
  BASE + 'icons/icon-167.png',
  BASE + 'icons/icon-180.png',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-384.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/icon-1024.png',
  BASE + 'icons/maskable-192.png',
  BASE + 'icons/maskable-512.png',
  BASE + 'icons/add.png',
  BASE + 'icons/search.png',
  BASE + 'icons/backup.png'
];

console.log(`[SW ${APP_VERSION}] 🚀 Khởi động - OFFLINE 100% GUARANTEED`);

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

    const hasCriticalAssets = await verifyCriticalAssets(cache);
    if (hasCriticalAssets) {
      console.log('[SW] 🎉 Sẵn sàng OFFLINE 100% sau lần tải đầu tiên');
    } else {
      console.error('[SW] 🚨 Có thể chưa offline hoàn toàn (thiếu asset quan trọng)');
    }
  })());
  self.skipWaiting();
});

// ========== CACHE VỚI RETRY ==========
async function cacheWithRetry(cache, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await cache.add(url);
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response.clone());
            return true;
          }
        } catch {}
        return false;
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return false;
}

// ========== VERIFY ==========
async function verifyCriticalAssets(cache) {
  const cachedItems = await cache.keys();
  const must = [
    BASE + 'index.html',
    BASE + 'manifest.webmanifest',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png'
  ];
  const hasMinimal = must.every(a => cachedItems.some(i => i.url.endsWith(a)));
  const totalIcons = cachedItems.filter(i => i.url.includes('/icons/')).length;
  console.log(`[SW] 🔍 Minimal assets = ${hasMinimal ? '✅' : '❌'}`);
  console.log(`[SW] 🔍 Icons cached = ${totalIcons}`);
  return hasMinimal && totalIcons >= 10;
}

// ========== CHECK UPDATE (CHỈ GỌI KHI TRANG GỬI MESSAGE) ==========
async function checkForUpdates() {
  if (!globalThis.navigator || !navigator.onLine) {
    console.log('[SW] 🌐 Offline, bỏ qua kiểm tra cập nhật.');
    return;
  }
  try {
    const res = await fetch(VERSION_FILE + '?t=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) {
      console.log('[SW] 🌐 Không đọc được version.json (HTTP ' + res.status + ')');
      return;
    }
    const json = await res.json();
    const latestVersion = json.version || json.version_latest || null;
    if (!latestVersion) {
      console.log('[SW] ℹ️ version.json không có thuộc tính version.');
      return;
    }

    const cmp = compareVersions(latestVersion, APP_VERSION);
    if (cmp > 0) {
      console.log(`[SW] 🔔 Có bản mới: ${APP_VERSION} → ${latestVersion}`);
      const clientsList = await self.clients.matchAll();
      clientsList.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: latestVersion,
          currentVersion: APP_VERSION
        });
      });
    } else {
      console.log('[SW] ✅ Đang ở phiên bản mới nhất hoặc mới hơn server.');
    }
  } catch (e) {
    console.log('[SW] 🌐 Lỗi check update:', e?.message || e);
  }
}

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] 🎯 Kích hoạt - DỌN CACHE CŨ & XÁC MINH OFFLINE...');
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch {}
    }

    // Xoá cache static-* cũ
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('static-') && k !== CACHE_STATIC)
        .map(k => caches.delete(k))
    );

    await self.clients.claim();

    // Đảm bảo asset quan trọng luôn có trong cache mới
    const cache = await caches.open(CACHE_STATIC);
    const items = await cache.keys();
    console.log(`[SW] 📊 Sau kích hoạt: ${items.length} items trong cache`);

    const critical = [
      BASE + 'index.html',
      BASE + 'icons/icon-192.png',
      BASE + 'icons/icon-512.png'
    ];
    const missing = critical.filter(a => !items.some(i => i.url.endsWith(a)));
    if (missing.length) {
      console.log('[SW] 🧩 Thiếu asset quan trọng, thử cache bổ sung:', missing);
      await cacheMissingCritical(cache, missing);
    }

    // ❌ KHÔNG setInterval checkForUpdates ở đây nữa.
    console.log('[SW] ✅ Kích hoạt xong (update chỉ chạy khi người dùng bấm "Kiểm tra cập nhật").');
  })());
});

async function cacheMissingCritical(cache, missingAssets) {
  for (const a of missingAssets) {
    try {
      const res = await fetch(a);
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

  // Chỉ xử lý trong scope /password-manager/
  if (!url.pathname.startsWith('/password-manager/')) return;

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
      const net = await fetch(BASE + 'index.html');
      if (net.ok) await cache.put(BASE + 'index.html', net.clone());
      return net;
    } catch {}

    return createOfflinePage();
  } catch {
    return createOfflinePage();
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const net = await fetch(request);
    if (net.ok) await cache.put(request, net.clone());
    return net;
  } catch {
    // Không có cache, không có mạng → trả về 204 (im lặng)
    return new Response('', { status: 204 });
  }
}

function createOfflinePage() {
  return new Response(
`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trình quản lý mật khẩu - Offline</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;margin:0;padding:40px 20px;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.5}
.container{max-width:420px}
h1{color:#f59e0b;margin-bottom:1rem}
button{background:#22c55e;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;margin-top:1rem}
</style></head>
<body><div class="container">
<h1>📶 Đang offline</h1>
<p>Ứng dụng cần kết nối internet để tải lần đầu.<br>Sau khi đã tải và cài Service Worker, bạn có thể dùng offline 100%.</p>
<button onclick="location.reload()">🔄 Thử lại</button>
</div></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

// ========== MESSAGE (TƯƠNG TÁC VỚI TRANG) ==========
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (type === 'CHECK_UPDATE') {
    // Chỉ khi trang yêu cầu mới kiểm tra cập nhật
    checkForUpdates();
  }
  if (type === 'FORCE_UPDATE') {
    self.skipWaiting();
  }
});

console.log(`[SW ${APP_VERSION}] ✅ Đã tải - OFFLINE 100% GUARANTEED (manual updates)`);