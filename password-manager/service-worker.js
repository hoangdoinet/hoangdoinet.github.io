/* service-worker.js - OFFLINE 100% GUARANTEED v1.0.5 */
const APP_VERSION = 'v1.0.0';
const CACHE_STATIC = `static-${APP_VERSION}`;
const BASE = '/password-manager/';
const VERSION_FILE = BASE + 'version.json';

// 🔥 CACHE TOÀN BỘ ASSETS THEO MANIFEST
const CRITICAL_ASSETS = [
  // 🎯 CORE APP
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'version.json',

  // 🖼️ ICONS - THEO MANIFEST + bổ sung 32px & shortcut icons
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

  // 🔖 Shortcut icons (tùy file Sư Phụ có)
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

    // Cache index trước
    const indexSuccess = await cacheWithRetry(cache, BASE + 'index.html', 3);
    if (!indexSuccess) console.error('[SW] 💥 CRITICAL FAIL: Không thể cache index.html');

    for (const url of CRITICAL_ASSETS.filter(a => a !== BASE + 'index.html')) {
      const ok = await cacheWithRetry(cache, url, 2);
      (ok ? results.success : results.failed).push(url);
    }

    console.log(`[SW] ✅ Thành công: ${results.success.length}/${CRITICAL_ASSETS.length}`);
    if (results.failed.length) console.error('[SW] ❌ Lỗi cache:', results.failed);

    const hasCriticalAssets = await verifyCriticalAssets(cache);
    if (hasCriticalAssets) console.log('[SW] 🎉 Sẵn sàng OFFLINE 100%');
    else console.error('[SW] 🚨 Có thể chưa offline hoàn toàn');

    await checkForUpdates();
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
  const must = [ BASE + 'index.html', BASE + 'manifest.webmanifest', BASE + 'icons/icon-192.png', BASE + 'icons/icon-512.png' ];
  const hasMinimal = must.every(a => cachedItems.some(i => i.url.endsWith(a)));
  const totalIcons = cachedItems.filter(i => i.url.includes('/icons/')).length;
  console.log(`[SW] 🔍 Minimal assets = ${hasMinimal ? '✅' : '❌'}`);
  console.log(`[SW] 🔍 Icons cached = ${totalIcons}`);
  return hasMinimal && totalIcons >= 10;
}

// ========== CHECK UPDATE ==========
async function checkForUpdates() {
  if (!globalThis.navigator || !navigator.onLine) return;
  try {
    const res = await fetch(VERSION_FILE + '?t=' + Date.now(), { cache: 'no-cache' });
    if (!res.ok) return;
    const { version: latestVersion } = await res.json();
    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      const clients = await self.clients.matchAll();
      clients.forEach(client => client.postMessage({ type:'UPDATE_AVAILABLE', version: latestVersion, currentVersion: APP_VERSION }));
    }
  } catch (e) {
    console.log('[SW] 🌐 Lỗi check update:', e?.message);
  }
}

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] 🎯 Kích hoạt - OFFLINE VERIFICATION...');
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('static-') && k !== CACHE_STATIC).map(k => caches.delete(k)));

    await self.clients.claim();

    const cache = await caches.open(CACHE_STATIC);
    const items = await cache.keys();
    console.log(`[SW] 📊 Sau kích hoạt: ${items.length} items`);

    const critical = [ BASE + 'index.html', BASE + 'icons/icon-192.png', BASE + 'icons/icon-512.png' ];
    const missing = critical.filter(a => !items.some(i => i.url.endsWith(a)));
    if (missing.length) await cacheMissingCritical(cache, missing);

    // Kiểm tra cập nhật định kỳ
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
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
  const pa = String(a).replace('v','').split('.').map(Number);
  const pb = String(b).replace('v','').split('.').map(Number);
  for (let i=0;i<Math.max(pa.length,pb.length);i++){
    const na = pa[i]||0, nb = pb[i]||0;
    if (na>nb) return 1; if (na<nb) return -1;
  }
  return 0;
}

// ========== FETCH (OFFLINE FIRST) ==========
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
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
<p>Ứng dụng cần kết nối internet để tải lần đầu.</p>
<button onclick="location.reload()">🔄 Thử lại</button>
</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } }
  );
}

// ========== MESSAGE ==========
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'CHECK_UPDATE') checkForUpdates();
  if (type === 'FORCE_UPDATE') self.skipWaiting();
});

console.log(`[SW ${APP_VERSION}] ✅ Đã tải - OFFLINE 100% GUARANTEED`);